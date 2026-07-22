import { createHash } from "node:crypto";
import { basename, join, relative } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  RepetitionMemorySchema,
  type RepetitionMemory,
  type RepetitionMemorySource,
  type RepetitionPattern,
  type RepetitionPatternCategory,
} from "../domain/repetition-memory.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { readBook } from "../project/store.js";

const DEFAULT_RECENT_CHAPTERS = 3;
const MAX_RECENT_CHAPTERS = 10;
const MAX_PATTERNS = 40;
const MAX_AVOID = 8;
const MAX_SNIPPETS = 2;
const MAX_SNIPPET_CHARS = 80;
const STOPWORDS = new Set(["a", "an", "and", "as", "at", "be", "but", "by", "for", "from", "had", "has", "he", "her", "his", "i", "in", "is", "it", "of", "on", "or", "she", "that", "the", "their", "them", "they", "this", "to", "was", "we", "were", "with", "you"]);
const CATEGORY_PRIORITY: Record<RepetitionPatternCategory, number> = {
  "sentence-opening": 0,
  gesture: 1,
  transition: 2,
  "verbal-tic": 3,
  "dialogue-tag": 4,
  ngram: 5,
  metaphor: 6,
  "chapter-opening": 7,
  "scene-ending": 8,
};

interface PatternAccumulator {
  category: RepetitionPatternCategory;
  text: string;
  count: number;
  snippets: string[];
}

export interface BuildProjectRepetitionMemoryOptions {
  recentChapterCount?: number;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function normalizedPhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET_CHARS).trim();
}

function proseText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function words(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.map((word) => normalizedPhrase(word)).filter(Boolean) ?? [];
}

function addPattern(
  patterns: Map<string, PatternAccumulator>,
  category: RepetitionPatternCategory,
  rawText: string,
  snippet: string,
  increment = 1,
): void {
  const text = normalizedPhrase(rawText).slice(0, 160).trim();
  const compact = compactSnippet(snippet);
  if (!text || !compact) return;
  const key = `${category}\u0000${text}`;
  const existing = patterns.get(key) ?? { category, text, count: 0, snippets: [] };
  existing.count += increment;
  if (!existing.snippets.includes(compact) && existing.snippets.length < MAX_SNIPPETS) existing.snippets.push(compact);
  patterns.set(key, existing);
}

function collectSentenceOpenings(patterns: Map<string, PatternAccumulator>, chapterSentences: readonly string[]): void {
  for (const sentence of chapterSentences) {
    const opening = words(sentence).slice(0, 3);
    if (opening.length === 3) addPattern(patterns, "sentence-opening", opening.join(" "), sentence);
  }
}

function collectNgrams(patterns: Map<string, PatternAccumulator>, chapterSentences: readonly string[]): void {
  for (const sentence of chapterSentences) {
    const tokens = words(sentence);
    for (let index = 0; index <= tokens.length - 3; index += 1) {
      const gram = tokens.slice(index, index + 3);
      if (gram.every((word) => STOPWORDS.has(word))) continue;
      addPattern(patterns, "ngram", gram.join(" "), sentence);
    }
  }
}

function collectRegexFamilies(patterns: Map<string, PatternAccumulator>, sentence: string): void {
  const families: Array<{ category: RepetitionPatternCategory; pattern: RegExp }> = [
    { category: "gesture", pattern: /\b(?:his|her|their|the)?\s*jaw tightened\b/giu },
    { category: "gesture", pattern: /\bsilence stretched\b/giu },
    { category: "gesture", pattern: /\b(?:his|her|their)\s+(?:breath|pulse|shoulders?|stomach)\s+(?:caught|hitched|tightened|dropped|knotted)\b/giu },
    { category: "transition", pattern: /\b(?:a moment later|for a moment|seconds later|a beat later|then again|by the time)\b/giu },
    { category: "dialogue-tag", pattern: /\b(?:he|she|they|[A-Z][\p{L}'’-]+)\s+(?:said|asked|whispered|murmured|replied|shouted)\b/gu },
    { category: "metaphor", pattern: /\blike\s+(?:a|an|the)\s+[\p{L}\p{N}'’-]+(?:\s+[\p{L}\p{N}'’-]+){0,3}\b/giu },
  ];
  for (const family of families) {
    for (const match of sentence.matchAll(family.pattern)) addPattern(patterns, family.category, match[0], sentence);
  }
}

function collectQuotedTics(patterns: Map<string, PatternAccumulator>, text: string): void {
  const quotePattern = /["“]([^"”]{2,120})["”]/g;
  for (const match of text.matchAll(quotePattern)) {
    const phrase = normalizedPhrase(match[1] ?? "");
    const tokenCount = words(phrase).length;
    if (tokenCount >= 2 && tokenCount <= 8) addPattern(patterns, "verbal-tic", phrase, match[0]);
  }
}

function chapterEdgePhrase(chapterSentences: readonly string[], side: "opening" | "ending"): { phrase: string; snippet: string } | null {
  const sentence = side === "opening" ? chapterSentences[0] : chapterSentences.at(-1);
  if (!sentence) return null;
  const tokens = words(sentence);
  const selected = side === "opening" ? tokens.slice(0, 6) : tokens.slice(-6);
  return selected.length >= 3 ? { phrase: selected.join(" "), snippet: sentence } : null;
}

function minimumCount(category: RepetitionPatternCategory): number {
  return category === "ngram" ? 3 : 2;
}

function finalizedPatterns(patterns: Map<string, PatternAccumulator>): RepetitionPattern[] {
  return [...patterns.values()]
    .filter((pattern) => pattern.count >= minimumCount(pattern.category))
    .sort((left, right) =>
      right.count - left.count
      || CATEGORY_PRIORITY[left.category] - CATEGORY_PRIORITY[right.category]
      || left.text.localeCompare(right.text))
    .slice(0, MAX_PATTERNS)
    .map((pattern) => ({
      category: pattern.category,
      text: pattern.text,
      count: pattern.count,
      snippets: pattern.snippets.slice(0, MAX_SNIPPETS),
    }));
}

function avoidList(patterns: readonly RepetitionPattern[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const category of ["sentence-opening", "gesture", "transition", "verbal-tic", "dialogue-tag", "ngram", "metaphor", "chapter-opening", "scene-ending"] as const) {
    const match = patterns.find((pattern) => pattern.category === category && !seen.has(pattern.text));
    if (!match) continue;
    selected.push(match.text);
    seen.add(match.text);
    if (selected.length >= MAX_AVOID) return selected;
  }
  for (const pattern of patterns) {
    if (seen.has(pattern.text)) continue;
    selected.push(pattern.text);
    seen.add(pattern.text);
    if (selected.length >= MAX_AVOID) break;
  }
  return selected;
}

function stableMemoryId(value: Omit<RepetitionMemory, "memory_id">): string {
  return `REP-${hashText(JSON.stringify(value)).slice(0, 16).toUpperCase()}`;
}

export function buildProjectRepetitionMemory(
  root: string,
  options: BuildProjectRepetitionMemoryOptions = {},
): RepetitionMemory {
  const requested = options.recentChapterCount ?? DEFAULT_RECENT_CHAPTERS;
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_RECENT_CHAPTERS) {
    throw new Error(`Recent repetition chapter count must be an integer from 1 to ${MAX_RECENT_CHAPTERS}.`);
  }
  const book = readBook(root);
  const bookRoot = join(root, "books", book.book_id);
  const selected = listChapterFiles(bookRoot)
    .map((path) => ({ path, chapter: chapterNumber(path) }))
    .filter((item): item is { path: string; chapter: number } => item.chapter !== null)
    .sort((left, right) => left.chapter - right.chapter)
    .slice(-requested);

  const sources: RepetitionMemorySource[] = [];
  const patterns = new Map<string, PatternAccumulator>();
  for (const item of selected) {
    const raw = readText(item.path) ?? "";
    const sourcePath = normalizedRelative(root, item.path);
    sources.push({ path: sourcePath, hash: hashText(raw), chapter: item.chapter });
    const text = proseText(raw);
    const chapterSentences = sentences(text);
    collectSentenceOpenings(patterns, chapterSentences);
    collectNgrams(patterns, chapterSentences);
    for (const sentence of chapterSentences) collectRegexFamilies(patterns, sentence);
    collectQuotedTics(patterns, text);
    const opening = chapterEdgePhrase(chapterSentences, "opening");
    if (opening) addPattern(patterns, "chapter-opening", opening.phrase, opening.snippet);
    const ending = chapterEdgePhrase(chapterSentences, "ending");
    if (ending) addPattern(patterns, "scene-ending", ending.phrase, ending.snippet);
  }

  const recentChapters = selected.map((item) => item.chapter);
  const finalPatterns = finalizedPatterns(patterns);
  const withoutId: Omit<RepetitionMemory, "memory_id"> = {
    schema_version: "1.0.0",
    book_id: book.book_id,
    recent_chapters: recentChapters,
    source_hashes: sources,
    patterns: finalPatterns,
    avoid_list: avoidList(finalPatterns),
  };
  const memory: RepetitionMemory = { ...withoutId, memory_id: stableMemoryId(withoutId) };
  if (!Value.Check(RepetitionMemorySchema, memory)) throw new Error("Compiled repetition memory is invalid.");
  return memory;
}

export function repetitionMemoryIsStale(root: string, memory: RepetitionMemory): boolean {
  return memory.source_hashes.some((source) => {
    const current = readText(join(root, source.path));
    return current === null || hashText(current) !== source.hash;
  });
}

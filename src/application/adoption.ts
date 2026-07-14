import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { countWords, listChapterFiles, safeSlug } from "../infrastructure/files.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readBook } from "../project/store.js";
import { applyGuidedProjectEvent } from "./handoff.js";

export interface AdoptionResult {
  chapters: number;
  words: number;
  paths: string[];
  reportPath: string;
}

interface ImportedChapter {
  number: number;
  title: string;
  content: string;
  source: string;
}

function numericPrefix(name: string): number | null {
  const match = name.match(/^0*(\d+)(?:\D|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function titleFromFilename(path: string, fallback: string): string {
  const withoutExtension = basename(path, extname(path));
  const cleaned = withoutExtension.replace(/^0*\d+\s*[-_. ]*\s*/, "").trim();
  return cleaned || fallback;
}

function directoryChapters(sourcePath: string): ImportedChapter[] {
  const files = readdirSync(sourcePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|txt)$/i.test(entry.name))
    .map((entry) => join(sourcePath, entry.name))
    .sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
  return files.map((path, index) => ({
    number: numericPrefix(basename(path)) ?? index + 1,
    title: titleFromFilename(path, `Chapter ${index + 1}`),
    content: readFileSync(path, "utf8").trim(),
    source: path,
  }));
}

function singleFileChapters(sourcePath: string): ImportedChapter[] {
  const text = readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const heading = /^(?:#{1,6}\s*)?Chapter\s+(\d+)(?:\s*[-:–—.]?\s*(.*))?$/gim;
  const matches = [...text.matchAll(heading)];
  if (!matches.length) return [{ number: 1, title: titleFromFilename(sourcePath, "Chapter 1"), content: text, source: sourcePath }];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const number = Number.parseInt(match[1] ?? String(index + 1), 10);
    const title = (match[2] ?? "").trim() || `Chapter ${number}`;
    return { number, title, content: text.slice(start, end).trim(), source: sourcePath };
  });
}

function discover(sourcePath: string): ImportedChapter[] {
  if (!existsSync(sourcePath)) throw new Error(`Manuscript source does not exist: ${sourcePath}`);
  const stat = statSync(sourcePath);
  if (stat.isDirectory()) return directoryChapters(sourcePath);
  if (stat.isFile() && /\.(md|txt)$/i.test(sourcePath)) return singleFileChapters(sourcePath);
  throw new Error("Adoption accepts a directory of .md/.txt chapters or one .md/.txt manuscript file.");
}

export function adoptManuscript(root: string, sourcePath: string): AdoptionResult {
  const source = resolve(sourcePath);
  const book = structuredClone(readBook(root));
  const bookRoot = join(root, "books", book.book_id);
  if (listChapterFiles(bookRoot).length) throw new Error(`The active book already contains manuscript chapters; adoption will not overwrite them.`);
  const discovered = discover(source);
  if (!discovered.length) throw new Error("No manuscript content was found for adoption.");
  if (discovered.length > 999) throw new Error("Adoption supports at most 999 chapters in one operation.");

  const seen = new Set<number>();
  const chapters = discovered.map((chapter, index) => {
    const preferred = chapter.number > 0 ? chapter.number : index + 1;
    const number = seen.has(preferred) ? index + 1 : preferred;
    if (seen.has(number)) throw new Error(`Duplicate imported chapter number ${number}. Rename source files or headings before adoption.`);
    seen.add(number);
    const slug = safeSlug(chapter.title.replace(/^Chapter\s+\d+\s*[-:–—.]?\s*/i, "")) || `chapter-${number}`;
    return { ...chapter, number, path: `books/${book.book_id}/manuscript/chapters/${String(number).padStart(2, "0")}-imported-${slug}.md` };
  }).sort((left, right) => left.number - right.number);

  const words = chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
  book.current_chapter = Math.max(...chapters.map((chapter) => chapter.number));
  book.actual_words = words;
  const reportPath = `books/${book.book_id}/adoption-report.md`;
  const report = [
    "# Manuscript Adoption Report",
    "",
    `- Source: ${source}`,
    `- Imported chapters: ${chapters.length}`,
    `- Imported words: ${words}`,
    `- Imported at: ${new Date().toISOString()}`,
    "- Source files were read only and were not changed.",
    "- No plot, canon, approval, queue, or reader-evidence state was invented.",
    "",
    "## Chapter map",
    "",
    ...chapters.map((chapter) => `- ${chapter.path} ← ${chapter.source}`),
    "",
  ].join("\n");
  const changes = [
    ...chapters.map((chapter) => ({ path: chapter.path, content: `${chapter.content}\n` })),
    { path: reportPath, content: report },
    { path: `books/${book.book_id}/BOOK.yaml`, content: stringifyYaml(book) },
  ];
  const applied = applyGuidedProjectEvent(root, changes, "Novel Forge: adopt manuscript", { lastAction: `Adopted ${chapters.length} manuscript chapters` });
  return { chapters: chapters.length, words, paths: applied.changed.filter((path) => /manuscript\/chapters\/.+\.md$/i.test(path)), reportPath };
}
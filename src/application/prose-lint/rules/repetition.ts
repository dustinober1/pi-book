import type { LintFinding, LintRule, ManuscriptDocument, ProseLintInput } from "../types.js";

const VERSION = "1.0.0";
const STOP_PHRASE_VERSION = "1.0.0";
const MAX_LOCATIONS = 5;
const FUNCTION_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have", "he", "her",
  "him", "his", "i", "if", "in", "is", "it", "its", "me", "my", "not", "of", "on", "or", "our", "she", "so",
  "that", "the", "their", "them", "they", "this", "to", "was", "we", "were", "with", "you", "your",
]);
const STOP_PHRASES = new Set([
  "in the middle of", "in the middle of the", "at the end of", "as a matter of", "one of the", "there was a", "there were a",
  "i don't know", "i do not know", "do you know", "what do you", "said to the", "looked at the",
]);

interface LocatedText {
  document: ManuscriptDocument;
  line: number;
  text: string;
  tokens: readonly string[];
  spanId: string;
  kind: "paragraph" | "sentence";
  paragraphIndex: number;
}

interface Occurrence {
  document: ManuscriptDocument;
  line: number;
  excerpt: string;
}

function bounded(text: string): string {
  return text.trim().slice(0, 160);
}

function location(occurrence: Occurrence): string {
  return `${occurrence.document.path}:${occurrence.line}`;
}

function ordered(occurrences: readonly Occurrence[]): Occurrence[] {
  return [...occurrences].sort((left, right) => left.document.order - right.document.order || left.line - right.line || left.excerpt.localeCompare(right.excerpt));
}

function evidenceForOccurrences(occurrences: readonly Occurrence[]): {
  count: number;
  chapterCount: number;
  densestChapterCount: number;
  documentCount: number;
  densestDocumentCount: number;
  locations: string;
} {
  const byDocument = new Map<string, number>();
  for (const occurrence of occurrences) byDocument.set(occurrence.document.path, (byDocument.get(occurrence.document.path) ?? 0) + 1);
  return {
    count: occurrences.length,
    chapterCount: byDocument.size,
    densestChapterCount: Math.max(0, ...byDocument.values()),
    documentCount: byDocument.size,
    densestDocumentCount: Math.max(0, ...byDocument.values()),
    locations: ordered(occurrences).slice(0, MAX_LOCATIONS).map(location).join(", "),
  };
}

function reachesRepetitionThreshold(occurrences: readonly Occurrence[]): boolean {
  const evidence = evidenceForOccurrences(occurrences);
  return (evidence.count >= 3 && evidence.chapterCount >= 2) || evidence.densestChapterCount >= 4;
}

function isStoppedPhrase(tokens: readonly string[]): boolean {
  const phrase = tokens.join(" ");
  if (tokens.every((token) => FUNCTION_WORDS.has(token))) return true;
  for (const stopped of STOP_PHRASES) {
    const padded = ` ${stopped} `;
    if (padded.includes(` ${phrase} `)) return true;
  }
  return false;
}

function repeatedSequences(
  input: ProseLintInput,
  source: (document: ManuscriptDocument) => Array<{ tokens: readonly string[]; line: number; text: string }>,
  lengths: readonly number[],
): Map<string, Occurrence[]> {
  const groups = new Map<string, Occurrence[]>();
  for (const document of input.documents) {
    for (const item of source(document)) {
      for (const length of lengths) {
        for (let index = 0; index + length <= item.tokens.length; index += 1) {
          const tokens = item.tokens.slice(index, index + length);
          if (isStoppedPhrase(tokens)) continue;
          const phrase = tokens.join(" ");
          const occurrence = { document, line: item.line, excerpt: bounded(item.text) };
          groups.set(phrase, [...(groups.get(phrase) ?? []), occurrence]);
        }
      }
    }
  }
  return groups;
}

function sequenceFinding(ruleId: string, label: "phrase" | "opening", value: string, occurrences: readonly Occurrence[]): LintFinding {
  const first = ordered(occurrences)[0] as Occurrence;
  const measured = evidenceForOccurrences(occurrences);
  return {
    ruleId,
    ruleVersion: VERSION,
    class: "repetition",
    confidence: "review",
    location: { path: first.document.path, line: first.line },
    excerpt: first.excerpt,
    message: label === "phrase" ? "This phrase recurs often enough to merit contextual review." : "This three-word opening recurs often enough to merit contextual review.",
    evidence: { [label]: value, ...measured, stopPhraseVersion: STOP_PHRASE_VERSION },
    reviewAction: "Review the listed uses in context and keep intentional repetition unchanged.",
  };
}

const ngramRule: LintRule = {
  id: "repetition/ngram",
  version: VERSION,
  run(input) {
    const groups = repeatedSequences(input, (document) => document.paragraphs.map((paragraph) => ({
      tokens: paragraph.tokens,
      line: paragraph.line,
      text: paragraph.text,
    })), [2, 3, 4, 5]);
    return [...groups.entries()]
      .filter(([, occurrences]) => reachesRepetitionThreshold(occurrences))
      .map(([phrase, occurrences]) => sequenceFinding(this.id, "phrase", phrase, occurrences));
  },
};

function openingRule(id: string, source: (document: ManuscriptDocument) => Array<{ tokens: readonly string[]; line: number; text: string }>): LintRule {
  return {
    id,
    version: VERSION,
    run(input) {
      const groups = repeatedSequences(input, source, [3]);
      return [...groups.entries()]
        .filter(([, occurrences]) => reachesRepetitionThreshold(occurrences))
        .map(([opening, occurrences]) => sequenceFinding(this.id, "opening", opening, occurrences));
    },
  };
}

const sentenceOpeningRule = openingRule("repetition/sentence-opening", (document) => document.sentences
  .filter((sentence) => sentence.text.match(/[\p{L}\p{N}]+/gu)?.length !== undefined)
  .map((sentence) => ({ tokens: normalizedTokens(sentence.text).slice(0, 3), line: sentence.line, text: sentence.text }))
  .filter((sentence) => sentence.tokens.length === 3));

const paragraphOpeningRule = openingRule("repetition/paragraph-opening", (document) => document.paragraphs
  .map((paragraph) => ({ tokens: paragraph.tokens.slice(0, 3), line: paragraph.line, text: paragraph.text }))
  .filter((paragraph) => paragraph.tokens.length === 3));

function normalizedTokens(text: string): string[] {
  return (text.normalize("NFKC").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).map((token) => token.toLocaleLowerCase("en-US"));
}

function paragraphIndexForLine(document: ManuscriptDocument, line: number): number {
  for (let index = document.paragraphs.length - 1; index >= 0; index -= 1) {
    if ((document.paragraphs[index]?.line ?? Number.MAX_SAFE_INTEGER) <= line) return index;
  }
  return -1;
}

function passages(document: ManuscriptDocument): LocatedText[] {
  const sentencePassages = document.sentences.map((sentence, sentenceIndex): LocatedText => {
    const tokens = normalizedTokens(sentence.text);
    const paragraphIndex = paragraphIndexForLine(document, sentence.line);
    return {
      document,
      line: sentence.line,
      text: sentence.text,
      tokens,
      spanId: `sentence:${sentenceIndex}`,
      kind: "sentence",
      paragraphIndex,
    };
  });
  const paragraphPassages = document.paragraphs.flatMap((paragraph, paragraphIndex): LocatedText[] => {
    const containedSentences = sentencePassages.filter((sentence) => sentence.paragraphIndex === paragraphIndex);
    if (containedSentences.length === 1 && containedSentences[0]?.tokens.join(" ") === paragraph.tokens.join(" ")) return [];
    return [{
      document,
      line: paragraph.line,
      text: paragraph.text,
      tokens: paragraph.tokens,
      spanId: `paragraph:${paragraphIndex}`,
      kind: "paragraph",
      paragraphIndex,
    }];
  });
  return [
    ...paragraphPassages,
    ...sentencePassages,
  ];
}

function spansOverlap(first: LocatedText, second: LocatedText): boolean {
  if (first.document.path !== second.document.path || first.paragraphIndex !== second.paragraphIndex) return false;
  return first.kind === "paragraph" || second.kind === "paragraph";
}

function pairFinding(ruleId: string, first: LocatedText, second: LocatedText, evidence: LintFinding["evidence"]): LintFinding {
  return {
    ruleId,
    ruleVersion: VERSION,
    class: "repetition",
    confidence: ruleId === "repetition/exact-duplicate" ? "high" : "review",
    location: { path: first.document.path, line: first.line },
    excerpt: bounded(first.text),
    message: ruleId === "repetition/exact-duplicate"
      ? "The same prose passage appears at another manuscript location."
      : "Two prose passages have high token-trigram overlap.",
    evidence: {
      firstLocation: `${first.document.path}:${first.line}`,
      secondLocation: `${second.document.path}:${second.line}`,
      firstSpan: first.spanId,
      secondSpan: second.spanId,
      ...evidence,
    },
    reviewAction: "Compare both locations and confirm whether the reuse is intentional.",
  };
}

const exactDuplicateRule: LintRule = {
  id: "repetition/exact-duplicate",
  version: VERSION,
  run(input) {
    const groups = new Map<string, LocatedText[]>();
    for (const passage of input.documents.flatMap(passages)) {
      if (passage.tokens.length < 2) continue;
      const key = passage.tokens.join(" ");
      groups.set(key, [...(groups.get(key) ?? []), passage]);
    }
    const findings: LintFinding[] = [];
    for (const occurrences of groups.values()) {
      for (let left = 0; left < occurrences.length; left += 1) {
        for (let right = left + 1; right < occurrences.length; right += 1) {
          const first = occurrences[left] as LocatedText;
          const second = occurrences[right] as LocatedText;
          if (spansOverlap(first, second)) continue;
          findings.push(pairFinding(this.id, first, second, {
            tokenCount: first.tokens.length,
          }));
        }
      }
    }
    return findings;
  },
};

function trigrams(tokens: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index + 3 <= tokens.length; index += 1) result.add(tokens.slice(index, index + 3).join(" "));
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

const nearDuplicateRule: LintRule = {
  id: "repetition/near-duplicate",
  version: VERSION,
  run(input) {
    const candidates = input.documents.flatMap(passages).filter((passage) => passage.tokens.length >= 12);
    const findings: LintFinding[] = [];
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const first = candidates[left] as LocatedText;
        const second = candidates[right] as LocatedText;
        if (spansOverlap(first, second)) continue;
        if (first.tokens.join(" ") === second.tokens.join(" ")) continue;
        const similarity = jaccard(trigrams(first.tokens), trigrams(second.tokens));
        if (similarity < 0.85) continue;
        findings.push(pairFinding(this.id, first, second, {
          similarity: Math.round(similarity * 10_000) / 10_000,
          threshold: 0.85,
          firstTokenCount: first.tokens.length,
          secondTokenCount: second.tokens.length,
        }));
      }
    }
    return findings;
  },
};

export const repetitionRules: readonly LintRule[] = [
  ngramRule,
  sentenceOpeningRule,
  paragraphOpeningRule,
  exactDuplicateRule,
  nearDuplicateRule,
];

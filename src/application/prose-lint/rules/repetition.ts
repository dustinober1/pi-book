import type { LintFinding, LintRule, ManuscriptDocument, ProseLintInput } from "../types.js";
import { compareDeterministicText } from "../order.js";

const VERSION = "1.0.0";
const STOP_PHRASE_VERSION = "1.0.0";
const MAX_LOCATIONS = 5;
export const REPETITION_FINDING_LIMIT = 40;
const FUNCTION_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have", "he", "her",
  "him", "his", "i", "if", "in", "is", "it", "its", "me", "my", "not", "of", "on", "or", "our", "she", "so",
  "that", "the", "their", "them", "they", "this", "to", "was", "we", "were", "with", "you", "your",
]);
const STOP_PHRASES = new Set([
  "in the middle of", "in the middle of the", "at the end of", "as a matter of", "one of the", "there was a", "there were a",
  "i don't know", "i do not know", "do you know", "what do you", "said to the", "looked at the",
]);
const BODY_LANGUAGE_TERMS = new Set(["hand", "hands", "eye", "eyes", "gaze", "breath", "shoulder", "shoulders", "jaw", "heart", "stomach", "throat"]);

interface LocatedText {
  document: ManuscriptDocument;
  line: number;
  text: string;
  tokens: readonly string[];
  spanId: string;
  kind: "paragraph" | "sentence";
  paragraphIndex: number;
}

interface DuplicateCandidate extends LocatedText {
  normalized: string;
  trigramSet: ReadonlySet<string>;
  sequence: number;
}

interface DuplicateGroup {
  normalized: string;
  occurrences: DuplicateCandidate[];
  representative: DuplicateCandidate;
  trigramSet: ReadonlySet<string>;
  tokenCount: number;
  sequence: number;
  spanCounts: ReadonlyMap<string, { paragraphs: number; sentences: number }>;
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
  return [...occurrences].sort((left, right) => left.document.order - right.document.order || left.line - right.line || compareDeterministicText(left.excerpt, right.excerpt));
}

function evidenceForOccurrences(occurrences: readonly Occurrence[]): {
  count: number;
  chapterCount: number;
  densestChapterCount: number;
  documentCount: number;
  densestDocumentCount: number;
  locations: string;
  omittedLocationCount: number;
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
    omittedLocationCount: Math.max(0, occurrences.length - MAX_LOCATIONS),
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
          const occurrences = groups.get(phrase);
          if (occurrences === undefined) groups.set(phrase, [occurrence]);
          else occurrences.push(occurrence);
        }
      }
    }
  }
  return groups;
}

function sequenceFinding(
  ruleId: string,
  label: "phrase" | "opening",
  value: string,
  occurrences: readonly Occurrence[],
  fullFindingCount: number,
  omittedFindingCount: number,
): LintFinding {
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
    evidence: { [label]: value, ...measured, stopPhraseVersion: STOP_PHRASE_VERSION, fullFindingCount, omittedFindingCount },
    reviewAction: "Review the listed uses in context and keep intentional repetition unchanged.",
  };
}

function cappedSequenceFindings(
  ruleId: string,
  label: "phrase" | "opening",
  groups: ReadonlyMap<string, Occurrence[]>,
  eligible: (occurrences: readonly Occurrence[]) => boolean,
): LintFinding[] {
  const qualifying = [...groups.entries()].filter(([, occurrences]) => eligible(occurrences));
  qualifying.sort((left, right) =>
    right[1].length - left[1].length
    || right[0].split(" ").length - left[0].split(" ").length
    || compareDeterministicText(left[0], right[0]));
  const fullFindingCount = qualifying.length;
  const retained = qualifying.slice(0, REPETITION_FINDING_LIMIT);
  const omittedFindingCount = fullFindingCount - retained.length;
  return retained.map(([value, occurrences]) => sequenceFinding(
    ruleId,
    label,
    value,
    occurrences,
    fullFindingCount,
    omittedFindingCount,
  ));
}

export function createNgramRule(options: { minimumCount?: number } = {}): LintRule {
  const minimumCount = options.minimumCount;
  return {
    id: "repetition/ngram",
    version: VERSION,
    run(input) {
      const groups = repeatedSequences(input, (document) => document.paragraphs.map((paragraph) => ({
        tokens: paragraph.tokens,
        line: paragraph.line,
        text: paragraph.text,
      })), [2, 3, 4, 5]);
      return cappedSequenceFindings(this.id, "phrase", groups, (occurrences) => minimumCount === undefined
        ? reachesRepetitionThreshold(occurrences)
        : occurrences.length >= minimumCount);
    },
  };
}

const ngramRule = createNgramRule();

function openingRule(id: string, source: (document: ManuscriptDocument) => Array<{ tokens: readonly string[]; line: number; text: string }>): LintRule {
  return {
    id,
    version: VERSION,
    run(input) {
      const groups = repeatedSequences(input, source, [3]);
      return cappedSequenceFindings(this.id, "opening", groups, reachesRepetitionThreshold);
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

const bodyLanguageRule: LintRule = {
  id: "repetition/body-language",
  version: VERSION,
  run(input) {
    const groups = new Map<string, Occurrence[]>();
    for (const document of input.documents) {
      for (const paragraph of document.paragraphs) {
        for (const token of paragraph.tokens) {
          if (!BODY_LANGUAGE_TERMS.has(token)) continue;
          const occurrence = { document, line: paragraph.line, excerpt: bounded(paragraph.text) };
          const occurrences = groups.get(token);
          if (occurrences === undefined) groups.set(token, [occurrence]);
          else occurrences.push(occurrence);
        }
      }
    }
    return [...groups.entries()]
      .filter(([, occurrences]) => reachesRepetitionThreshold(occurrences))
      .map(([term, occurrences]) => {
        const first = ordered(occurrences)[0] as Occurrence;
        return {
          ruleId: this.id,
          ruleVersion: VERSION,
          class: "repetition" as const,
          confidence: "review" as const,
          location: { path: first.document.path, line: first.line },
          excerpt: first.excerpt,
          message: "This body-language term recurs often enough to merit contextual review.",
          evidence: { term, ...evidenceForOccurrences(occurrences) },
          reviewAction: "Review the listed gestures in context and preserve intentional physical motifs.",
        };
      });
  },
};

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

// Duplicate rules calculate complete counts but retain only this many serialized findings.
export const DUPLICATE_FINDING_LIMIT = REPETITION_FINDING_LIMIT;
export const DUPLICATE_LOCATION_LIMIT = 8;
// Jaccard cannot reach 0.85 when the smaller unique-trigram count is below 85% of the larger count.
export const NEAR_DUPLICATE_MIN_LENGTH_RATIO = 0.85;

function trigrams(tokens: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index + 3 <= tokens.length; index += 1) result.add(tokens.slice(index, index + 3).join(" "));
  return result;
}

function duplicateCandidates(input: ProseLintInput): DuplicateCandidate[] {
  return input.documents.flatMap(passages).map((passage, sequence) => ({
    ...passage,
    normalized: passage.tokens.join(" "),
    trigramSet: trigrams(passage.tokens),
    sequence,
  }));
}

function exactPairCount(occurrences: readonly DuplicateCandidate[]): number {
  let count = (occurrences.length * (occurrences.length - 1)) / 2;
  const overlapping = new Map<string, { paragraphs: number; sentences: number }>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.document.path}\u0000${occurrence.paragraphIndex}`;
    const item = overlapping.get(key) ?? { paragraphs: 0, sentences: 0 };
    item[occurrence.kind === "paragraph" ? "paragraphs" : "sentences"] += 1;
    overlapping.set(key, item);
  }
  for (const item of overlapping.values()) count -= item.paragraphs * item.sentences;
  return count;
}

function exactGroupFinding(
  ruleId: string,
  occurrences: readonly DuplicateCandidate[],
  pairCount: number,
  fullFindingCount: number,
  omittedFindingCount: number,
): LintFinding {
  const retained = occurrences.slice(0, DUPLICATE_LOCATION_LIMIT);
  const first = retained[0] as DuplicateCandidate;
  const second = retained[1] as DuplicateCandidate;
  return pairFinding(ruleId, first, second, {
    tokenCount: first.tokens.length,
    occurrenceCount: occurrences.length,
    pairCount,
    locations: retained.map((item) => `${item.document.path}:${item.line} (${item.spanId})`).join(", "),
    omittedLocationCount: occurrences.length - retained.length,
    fullFindingCount,
    omittedFindingCount,
  });
}

const exactDuplicateRule: LintRule = {
  id: "repetition/exact-duplicate",
  version: VERSION,
  run(input) {
    const groups = new Map<string, DuplicateCandidate[]>();
    for (const passage of duplicateCandidates(input)) {
      if (passage.tokens.length < 2) continue;
      const occurrences = groups.get(passage.normalized);
      if (occurrences === undefined) groups.set(passage.normalized, [passage]);
      else occurrences.push(passage);
    }
    let fullFindingCount = 0;
    for (const occurrences of groups.values()) if (exactPairCount(occurrences) > 0) fullFindingCount += 1;
    const omittedFindingCount = Math.max(0, fullFindingCount - DUPLICATE_FINDING_LIMIT);
    const findings: LintFinding[] = [];
    for (const occurrences of groups.values()) {
      const pairCount = exactPairCount(occurrences);
      if (pairCount === 0) continue;
      if (findings.length === DUPLICATE_FINDING_LIMIT) break;
      findings.push(exactGroupFinding(this.id, occurrences, pairCount, fullFindingCount, omittedFindingCount));
    }
    return findings;
  },
};

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function spanCounts(occurrences: readonly DuplicateCandidate[]): ReadonlyMap<string, { paragraphs: number; sentences: number }> {
  const counts = new Map<string, { paragraphs: number; sentences: number }>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.document.path}\u0000${occurrence.paragraphIndex}`;
    const item = counts.get(key) ?? { paragraphs: 0, sentences: 0 };
    item[occurrence.kind === "paragraph" ? "paragraphs" : "sentences"] += 1;
    counts.set(key, item);
  }
  return counts;
}

function nearDuplicateGroups(input: ProseLintInput): DuplicateGroup[] {
  const byNormalized = new Map<string, DuplicateCandidate[]>();
  for (const candidate of duplicateCandidates(input)) {
    if (candidate.tokens.length < 12) continue;
    const occurrences = byNormalized.get(candidate.normalized);
    if (occurrences === undefined) byNormalized.set(candidate.normalized, [candidate]);
    else occurrences.push(candidate);
  }
  return [...byNormalized.entries()].map(([normalized, occurrences]) => {
    const representative = occurrences[0] as DuplicateCandidate;
    return {
      normalized,
      occurrences,
      representative,
      trigramSet: representative.trigramSet,
      tokenCount: representative.tokens.length,
      sequence: representative.sequence,
      spanCounts: spanCounts(occurrences),
    };
  }).sort((left, right) =>
    left.trigramSet.size - right.trigramSet.size
    || left.tokenCount - right.tokenCount
    || left.sequence - right.sequence
    || compareDeterministicText(left.normalized, right.normalized));
}

function nonOverlappingMultiplicity(left: DuplicateGroup, right: DuplicateGroup): number {
  let invalid = 0;
  for (const [key, leftCounts] of left.spanCounts) {
    const rightCounts = right.spanCounts.get(key);
    if (rightCounts === undefined) continue;
    const leftTotal = leftCounts.paragraphs + leftCounts.sentences;
    const rightTotal = rightCounts.paragraphs + rightCounts.sentences;
    invalid += leftTotal * rightTotal - leftCounts.sentences * rightCounts.sentences;
  }
  return left.occurrences.length * right.occurrences.length - invalid;
}

function firstNonOverlappingPair(left: DuplicateGroup, right: DuplicateGroup): [DuplicateCandidate, DuplicateCandidate] {
  for (const first of left.occurrences) {
    for (const second of right.occurrences) if (!spansOverlap(first, second)) return [first, second];
  }
  throw new Error("Near-duplicate multiplicity did not have a representative pair.");
}

function minimumIntersection(leftSize: number, rightSize: number): number {
  return Math.ceil((0.85 * (leftSize + rightSize)) / 1.85 - 1e-12);
}

const nearDuplicateRule: LintRule = {
  id: "repetition/near-duplicate",
  version: VERSION,
  run(input) {
    const groups = nearDuplicateGroups(input);
    const inverted = new Map<string, number[]>();
    const retained: Array<{
      first: DuplicateCandidate;
      second: DuplicateCandidate;
      firstGroup: DuplicateGroup;
      secondGroup: DuplicateGroup;
      similarity: number;
      pairMultiplicity: number;
    }> = [];
    let fullFindingCount = 0;
    let fullUniquePairCount = 0;
    let retainedMultiplicity = 0;
    for (let rightIndex = 0; rightIndex < groups.length; rightIndex += 1) {
      const right = groups[rightIndex] as DuplicateGroup;
      const intersections = new Map<number, number>();
      for (const trigram of right.trigramSet) {
        for (const leftIndex of inverted.get(trigram) ?? []) {
          intersections.set(leftIndex, (intersections.get(leftIndex) ?? 0) + 1);
        }
      }
      const candidates = [...intersections.entries()].filter(([leftIndex, intersection]) => {
        const left = groups[leftIndex] as DuplicateGroup;
        if (left.trigramSet.size / right.trigramSet.size < NEAR_DUPLICATE_MIN_LENGTH_RATIO) return false;
        return intersection >= minimumIntersection(left.trigramSet.size, right.trigramSet.size);
      }).sort((left, rightItem) => left[0] - rightItem[0]);
      for (const [leftIndex] of candidates) {
        const left = groups[leftIndex] as DuplicateGroup;
        const similarity = jaccard(left.trigramSet, right.trigramSet);
        if (similarity < 0.85) continue;
        const pairMultiplicity = nonOverlappingMultiplicity(left, right);
        if (pairMultiplicity === 0) continue;
        fullFindingCount += pairMultiplicity;
        fullUniquePairCount += 1;
        if (retained.length < DUPLICATE_FINDING_LIMIT) {
          const [first, second] = firstNonOverlappingPair(left, right);
          retained.push({ first, second, firstGroup: left, secondGroup: right, similarity, pairMultiplicity });
          retainedMultiplicity += pairMultiplicity;
        }
      }
      for (const trigram of right.trigramSet) {
        const postings = inverted.get(trigram);
        if (postings === undefined) inverted.set(trigram, [rightIndex]);
        else postings.push(rightIndex);
      }
    }
    const omittedFindingCount = fullFindingCount - retainedMultiplicity;
    const commonEvidence = {
      threshold: 0.85,
      trigramCardinalityRatioThreshold: NEAR_DUPLICATE_MIN_LENGTH_RATIO,
      fullFindingCount,
      omittedFindingCount,
      fullUniquePairCount,
      omittedUniquePairCount: fullUniquePairCount - retained.length,
    };
    return retained.map(({ first, second, firstGroup, secondGroup, similarity, pairMultiplicity }) => pairFinding(this.id, first, second, {
      ...commonEvidence,
      similarity: Math.round(similarity * 10_000) / 10_000,
      firstTokenCount: first.tokens.length,
      secondTokenCount: second.tokens.length,
      firstOccurrenceCount: firstGroup.occurrences.length,
      secondOccurrenceCount: secondGroup.occurrences.length,
      pairMultiplicity,
      omittedLocationCount: firstGroup.occurrences.length + secondGroup.occurrences.length - 2,
    }));
  },
};

export const repetitionRules: readonly LintRule[] = [
  ngramRule,
  bodyLanguageRule,
  sentenceOpeningRule,
  paragraphOpeningRule,
  exactDuplicateRule,
  nearDuplicateRule,
];

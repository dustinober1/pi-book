import type { VoiceAuditRecordPhase5 } from "../domain/v1-3-audit-schemas.js";

export interface VoiceMetrics {
  [key: string]: number;
  word_count: number;
  sentence_count: number;
  average_sentence_words: number;
  median_sentence_words: number;
  average_paragraph_sentences: number;
  dialogue_ratio: number;
  fragment_ratio: number;
  rhetorical_question_ratio: number;
  filter_word_rate_per_1000: number;
  body_language_repeat_rate_per_1000: number;
  interiority_rate_per_1000: number;
  sentence_length_variance: number;
  telling_emotion_rate_per_1000: number;
  ai_transition_rate_per_1000: number;
}

export interface VoiceAuditInput {
  id: string;
  currentText: string;
  baselineMetrics: Record<string, number>;
  baselineHash: string;
  scope: string;
  pov?: string;
  chapters?: number[];
  protectedExceptions: string[];
  runAt?: string;
}

export type BuiltVoiceAuditRecord = VoiceAuditRecordPhase5 & {
  signals: VoiceMetrics;
  baseline_metrics: Record<string, number>;
  deltas: Record<string, number>;
  protected_exceptions: string[];
  assessment: "evidence-only";
};

const FILTER_WORDS = new Set(["saw", "felt", "heard", "noticed", "realized", "seemed", "thought", "knew", "wondered"]);
const BODY_LANGUAGE = new Set(["hand", "hands", "eye", "eyes", "gaze", "breath", "shoulder", "shoulders", "jaw", "heart", "stomach", "throat"]);
const INTERIORITY = new Set(["thought", "knew", "wondered", "felt", "remembered", "wanted", "feared", "hoped", "believed"]);

function round4(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10_000) / 10_000 : 0;
}

function words(text: string): string[] {
  return (text.normalize("NFKC").match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).map((value) => value.toLocaleLowerCase("en-US"));
}

function sentences(text: string): string[] {
  return (text.replace(/\r\n?/g, "\n").match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? []).map((value) => value.trim()).filter(Boolean);
}

function termRate(tokens: string[], terms: Set<string>): number {
  if (!tokens.length) return 0;
  const count = tokens.reduce((total, token) => total + (terms.has(token) ? 1 : 0), 0);
  return round4((count / tokens.length) * 1000);
}

export function extractVoiceMetrics(text: string): VoiceMetrics {
  const normalized = text.replace(/\r\n?/g, "\n");
  const tokens = words(normalized);
  const sentenceList = sentences(normalized);
  const sentenceLengths = sentenceList.map((item) => words(item).length).filter((value) => value > 0).sort((a, b) => a - b);
  const paragraphs = normalized.split(/\n\s*\n+/).map((value) => value.trim()).filter(Boolean);
  const paragraphSentenceCounts = paragraphs.map((paragraph) => sentences(paragraph).length).filter((value) => value > 0);
  const dialogueText = normalized.split("\n").filter((line) => /^\s*[“\"]/.test(line)).join(" ");
  const dialogueWords = words(dialogueText).length;
  const fragmentCount = sentenceLengths.filter((length) => length <= 3).length;
  const questionCount = sentenceList.filter((sentence) => /\?+\s*$/.test(sentence)).length;
  const bodyCounts = new Map<string, number>();
  for (const token of tokens) if (BODY_LANGUAGE.has(token)) bodyCounts.set(token, (bodyCounts.get(token) ?? 0) + 1);
  const bodyRepeats = [...bodyCounts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  const middle = sentenceLengths.length ? Math.floor(sentenceLengths.length / 2) : 0;
  const median = sentenceLengths.length === 0
    ? 0
    : sentenceLengths.length % 2 === 1
      ? sentenceLengths[middle] ?? 0
      : ((sentenceLengths[middle - 1] ?? 0) + (sentenceLengths[middle] ?? 0)) / 2;
  const average_sentence_words = round4(sentenceLengths.length ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length : 0);
  const variance = sentenceLengths.length > 1
    ? sentenceLengths.reduce((sum, length) => sum + Math.pow(length - average_sentence_words, 2), 0) / (sentenceLengths.length - 1)
    : 0;

  return {
    word_count: tokens.length,
    sentence_count: sentenceLengths.length,
    average_sentence_words,
    median_sentence_words: round4(median),
    average_paragraph_sentences: round4(paragraphSentenceCounts.length ? paragraphSentenceCounts.reduce((sum, value) => sum + value, 0) / paragraphSentenceCounts.length : 0),
    dialogue_ratio: round4(tokens.length ? dialogueWords / tokens.length : 0),
    fragment_ratio: round4(sentenceLengths.length ? fragmentCount / sentenceLengths.length : 0),
    rhetorical_question_ratio: round4(sentenceLengths.length ? questionCount / sentenceLengths.length : 0),
    filter_word_rate_per_1000: termRate(tokens, FILTER_WORDS),
    body_language_repeat_rate_per_1000: round4(tokens.length ? (bodyRepeats / tokens.length) * 1000 : 0),
    interiority_rate_per_1000: termRate(tokens, INTERIORITY),
    sentence_length_variance: round4(variance),
    telling_emotion_rate_per_1000: termRate(tokens, new Set(["angry", "sad", "happy", "afraid", "scared", "furious", "terrified", "joyful", "depressed", "nervous"])),
    ai_transition_rate_per_1000: termRate(tokens, new Set(["delving", "furthermore", "tapestry", "symphony"])),
  };
}



export function compareVoiceMetrics(current: VoiceMetrics, baseline: Record<string, number>): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof baseline[key] !== "number") continue;
    deltas[key] = round4(value - (baseline[key] ?? 0));
  }
  return deltas;
}

function materialDelta(key: string, value: number): boolean {
  if (["word_count", "sentence_count"].includes(key)) return false;
  if (["average_sentence_words", "median_sentence_words", "average_paragraph_sentences"].includes(key)) return Math.abs(value) >= 2;
  if (key.endsWith("_ratio")) return Math.abs(value) >= 0.08;
  return Math.abs(value) >= 2;
}

export function buildVoiceAuditRecord(input: VoiceAuditInput): BuiltVoiceAuditRecord {
  const signals = extractVoiceMetrics(input.currentText);
  const deltas = compareVoiceMetrics(signals, input.baselineMetrics);
  const findings = Object.entries(deltas)
    .filter(([key, value]) => materialDelta(key, value))
    .map(([key, value]) => `${key} changed by ${value > 0 ? "+" : ""}${value} from the accepted baseline.`);
  const protectedExceptions = [...new Set(input.protectedExceptions.map((value) => value.trim()).filter(Boolean))];
  const verdict = protectedExceptions.length ? "accepted-variation" : findings.length ? "drift-review" : "stable";
  return {
    id: input.id,
    scope: input.scope,
    baseline_hash: input.baselineHash,
    run_at: input.runAt ?? new Date().toISOString(),
    signals,
    findings,
    verdict,
    status: "draft",
    ...(input.pov ? { pov: input.pov } : {}),
    ...(input.chapters?.length ? { chapters: [...new Set(input.chapters)].sort((a, b) => a - b) } : {}),
    baseline_metrics: { ...input.baselineMetrics },
    deltas,
    protected_exceptions: protectedExceptions,
    assessment: "evidence-only",
  };
}

export function isVoiceAuditMilestone(input: { chapter?: number | undefined; scope?: string | undefined; explicit?: boolean | undefined }): boolean {
  if (input.explicit) return true;
  if (input.chapter === 1 || input.chapter === 3) return true;
  const scope = input.scope?.trim().toLocaleLowerCase("en-US") ?? "";
  return scope === "act" || scope.startsWith("act-") || scope === "manuscript" || scope === "recalibration";
}

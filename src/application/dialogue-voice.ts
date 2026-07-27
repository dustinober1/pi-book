/**
 * Per-character dialogue differentiation.
 *
 * Everything else in the project that mentions "voice" means the narrator:
 * `pov_signatures` in voice-guardrails, `pov` on the style card, the voice audit
 * metrics. Nothing asked whether two characters sound like different people —
 * and undifferentiated dialogue, where every character shares one articulate
 * register, is among the most recognisable qualities of generated fiction.
 *
 * This is deterministic and needs no model call. It attributes speech to named
 * speakers, measures each speaker's dialogue independently, and reports pairs
 * that are indistinguishable across every measure.
 *
 * It reports similarity, never authorship. Two characters legitimately can share
 * a register — siblings, colleagues, a deliberate doubling — so findings are
 * review evidence for a writer, not a defect list.
 */

const SPEECH_VERBS = [
  "said", "says", "asked", "asks", "replied", "answered", "whispered", "shouted",
  "murmured", "muttered", "called", "added", "continued", "snapped", "breathed",
  "told", "growled", "hissed", "offered", "admitted", "insisted", "warned", "repeated",
] as const;

const VERBS = SPEECH_VERBS.join("|");
const NAME = "[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?";
const SPEECH = "[^“”\"]+";

/** “…,” said Mara. — quote first, verb before the name. */
const QUOTE_VERB_NAME = new RegExp(`[“"](${SPEECH})[”"][^.!?\\n]{0,20}?\\b(?:${VERBS})\\s+(${NAME})`, "g");
/** “…,” Mara said. — quote first, name before the verb. */
const QUOTE_NAME_VERB = new RegExp(`[“"](${SPEECH})[”"][^.!?\\n]{0,20}?\\b(${NAME})\\s+(?:${VERBS})\\b`, "g");
/** Mara said, “…” — name first. */
const NAME_VERB_QUOTE = new RegExp(`\\b(${NAME})\\s+(?:${VERBS})\\b[^“"\\n]{0,20}[“"](${SPEECH})[”"]`, "g");

/** Words that look like names but never are, at a sentence start or otherwise. */
const NOT_NAMES = new Set(["The", "He", "She", "They", "It", "But", "And", "Then", "There", "That", "This", "What", "When", "Why", "How", "You", "Her", "His", "Their"]);

export interface SpeakerSample {
  speaker: string;
  lines: string[];
}

export interface SpeakerMetrics {
  speaker: string;
  lineCount: number;
  wordCount: number;
  sentenceCount: number;
  wordsPerSentence: number;
  contractionsPer100Words: number;
  questionsPer100Sentences: number;
  averageWordLength: number;
  typeTokenRatio: number;
}

export interface DialogueVoiceFinding {
  speakers: [string, string];
  message: string;
  metrics: Record<string, number>;
}

/** A speaker below this contributes too little dialogue to characterise. */
export const MINIMUM_SPEAKER_WORDS = 60;
export const MINIMUM_SPEAKER_SENTENCES = 6;

/**
 * Two speakers are called indistinguishable only when every measure agrees, so
 * one shared trait never produces a finding on its own.
 */
const TOLERANCES = {
  wordsPerSentence: 0.15, // relative
  contractionsPer100Words: 2,
  questionsPer100Sentences: 8,
  averageWordLength: 0.3,
  typeTokenRatio: 0.08,
} as const;

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function cleanName(value: string): string | null {
  const name = value.trim();
  const first = name.split(/\s+/)[0] ?? "";
  if (NOT_NAMES.has(first)) return null;
  return name;
}

export function extractSpeakerSamples(text: string): SpeakerSample[] {
  const samples = new Map<string, string[]>();
  const add = (rawName: string, speech: string) => {
    const name = cleanName(rawName);
    if (name === null) return;
    const line = speech.trim();
    if (line.length === 0) return;
    samples.set(name, [...(samples.get(name) ?? []), line]);
  };

  for (const match of text.matchAll(QUOTE_VERB_NAME)) add(match[2] ?? "", match[1] ?? "");
  for (const match of text.matchAll(QUOTE_NAME_VERB)) add(match[2] ?? "", match[1] ?? "");
  for (const match of text.matchAll(NAME_VERB_QUOTE)) add(match[1] ?? "", match[2] ?? "");

  return [...samples.entries()]
    .map(([speaker, lines]) => ({ speaker, lines: [...new Set(lines)] }))
    .sort((left, right) => left.speaker.localeCompare(right.speaker, "en-US"));
}

function words(value: string): string[] {
  return (value.normalize("NFKC").match(/[\p{L}\p{N}]+(?:[’'][\p{L}]+)*/gu) ?? []).map((item) => item.toLocaleLowerCase("en-US"));
}

function sentences(value: string): string[] {
  return (value.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map((item) => item.trim()).filter(Boolean);
}

export function speakerMetrics(sample: SpeakerSample): SpeakerMetrics {
  const joined = sample.lines.join(" ");
  const tokens = words(joined);
  const sentenceList = sample.lines.flatMap(sentences);
  const contractions = tokens.filter((token) => /[’'][a-z]/.test(token)).length;
  const questions = sentenceList.filter((item) => /\?+["”]?\s*$/.test(item)).length;
  const letters = tokens.reduce((sum, token) => sum + token.length, 0);
  return {
    speaker: sample.speaker,
    lineCount: sample.lines.length,
    wordCount: tokens.length,
    sentenceCount: sentenceList.length,
    wordsPerSentence: round2(sentenceList.length === 0 ? 0 : tokens.length / sentenceList.length),
    contractionsPer100Words: round2(tokens.length === 0 ? 0 : (contractions / tokens.length) * 100),
    questionsPer100Sentences: round2(sentenceList.length === 0 ? 0 : (questions / sentenceList.length) * 100),
    averageWordLength: round2(tokens.length === 0 ? 0 : letters / tokens.length),
    typeTokenRatio: round2(tokens.length === 0 ? 0 : new Set(tokens).size / tokens.length),
  };
}

function measurable(metrics: SpeakerMetrics): boolean {
  return metrics.wordCount >= MINIMUM_SPEAKER_WORDS && metrics.sentenceCount >= MINIMUM_SPEAKER_SENTENCES;
}

function indistinguishable(left: SpeakerMetrics, right: SpeakerMetrics): boolean {
  const cadence = Math.max(left.wordsPerSentence, right.wordsPerSentence);
  if (cadence > 0 && Math.abs(left.wordsPerSentence - right.wordsPerSentence) / cadence >= TOLERANCES.wordsPerSentence) return false;
  if (Math.abs(left.contractionsPer100Words - right.contractionsPer100Words) >= TOLERANCES.contractionsPer100Words) return false;
  if (Math.abs(left.questionsPer100Sentences - right.questionsPer100Sentences) >= TOLERANCES.questionsPer100Sentences) return false;
  if (Math.abs(left.averageWordLength - right.averageWordLength) >= TOLERANCES.averageWordLength) return false;
  if (Math.abs(left.typeTokenRatio - right.typeTokenRatio) >= TOLERANCES.typeTokenRatio) return false;
  return true;
}

/**
 * Reports every pair of adequately-sampled speakers whose dialogue is
 * indistinguishable on all five measures.
 */
export function dialogueVoiceFindings(text: string): DialogueVoiceFinding[] {
  const measured = extractSpeakerSamples(text).map(speakerMetrics).filter(measurable);
  const findings: DialogueVoiceFinding[] = [];
  for (let left = 0; left < measured.length; left += 1) {
    for (let right = left + 1; right < measured.length; right += 1) {
      const a = measured[left] as SpeakerMetrics;
      const b = measured[right] as SpeakerMetrics;
      if (!indistinguishable(a, b)) continue;
      findings.push({
        speakers: [a.speaker, b.speaker],
        message: `${a.speaker} and ${b.speaker} are not distinguishable by their dialogue: sentence length (${a.wordsPerSentence} vs ${b.wordsPerSentence} words), contractions (${a.contractionsPer100Words} vs ${b.contractionsPer100Words} per 100 words), questions (${a.questionsPer100Sentences} vs ${b.questionsPer100Sentences} per 100 sentences), word length (${a.averageWordLength} vs ${b.averageWordLength}) and vocabulary range (${a.typeTokenRatio} vs ${b.typeTokenRatio}) all sit within tolerance. Characters who share one register read as a single writing voice wearing different names. A deliberate pairing is legitimate; an unexamined one usually is not.`,
        metrics: {
          [`${a.speaker}_words_per_sentence`]: a.wordsPerSentence,
          [`${b.speaker}_words_per_sentence`]: b.wordsPerSentence,
          [`${a.speaker}_contractions_per_100`]: a.contractionsPer100Words,
          [`${b.speaker}_contractions_per_100`]: b.contractionsPer100Words,
          [`${a.speaker}_type_token_ratio`]: a.typeTokenRatio,
          [`${b.speaker}_type_token_ratio`]: b.typeTokenRatio,
        },
      });
    }
  }
  return findings;
}

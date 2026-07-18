import { extractVoiceMetrics } from "../../voice-audit.js";
import { compareDeterministicText } from "../order.js";
import type { LintFinding, LintRule, ManuscriptDocument, ProseLintInput } from "../types.js";

const VERSION = "1.0.0";
const MINIMUM_WORDS = 2_000;
const MINIMUM_MATCHES = 4;
const FILTER_WORDS = new Set(["saw", "felt", "heard", "noticed", "realized", "seemed", "thought", "knew", "wondered"]);
const BODY_LANGUAGE = new Set(["hand", "hands", "eye", "eyes", "gaze", "breath", "shoulder", "shoulders", "jaw", "heart", "stomach", "throat"]);
const TRANSITIONS = ["however", "therefore", "meanwhile", "instead", "moreover", "nevertheless", "still", "then", "finally"];

interface PatternOccurrence {
  document: ManuscriptDocument;
  line: number;
  excerpt: string;
}

interface Measurement {
  count: number;
  rate: number;
}

interface PatternDefinition {
  id: string;
  baselineKey: string;
  message: string;
  occurrences(input: ProseLintInput): PatternOccurrence[];
  metric?: (text: string) => Measurement;
}

function round4(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10_000) / 10_000 : 0;
}

function tokens(text: string): string[] {
  return (text.normalize("NFKC").match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).map((token) => token.toLocaleLowerCase("en-US"));
}

function excerpt(text: string): string {
  return text.trim().slice(0, 160);
}

function metricText(document: ManuscriptDocument): string {
  return document.sentences.map((sentence) => /[.!?]\s*$/.test(sentence.text) ? sentence.text : `${sentence.text}.`).join("\n");
}

function corpusMetricText(documents: readonly ManuscriptDocument[]): string {
  return documents.map(metricText).join("\n");
}

function firstProseOccurrence(document: ManuscriptDocument): PatternOccurrence | undefined {
  const sentence = document.sentences[0];
  if (sentence !== undefined) return { document, line: sentence.line, excerpt: excerpt(sentence.text) };
  const paragraph = document.paragraphs[0];
  return paragraph === undefined ? undefined : { document, line: paragraph.line, excerpt: excerpt(paragraph.text) };
}

function sentenceOccurrences(document: ManuscriptDocument, predicate: (sentence: string) => boolean): PatternOccurrence[] {
  return document.sentences.filter((sentence) => predicate(sentence.text)).map((sentence) => ({
    document, line: sentence.line, excerpt: excerpt(sentence.text),
  }));
}

function ratePerThousand(count: number, wordCount: number): number {
  return round4(wordCount === 0 ? 0 : (count / wordCount) * 1_000);
}

function occurrenceMetric(input: ProseLintInput, occurrences: readonly PatternOccurrence[]): Measurement {
  return { count: occurrences.length, rate: ratePerThousand(occurrences.length, input.documents.reduce((sum, document) => sum + document.wordCount, 0)) };
}

function groupedDominant<T extends { key: string; occurrence: PatternOccurrence }>(items: readonly T[]): PatternOccurrence[] {
  const groups = new Map<string, PatternOccurrence[]>();
  for (const item of items) groups.set(item.key, [...(groups.get(item.key) ?? []), item.occurrence]);
  return [...groups.entries()].sort((left, right) => right[1].length - left[1].length || compareDeterministicText(left[0], right[0]))[0]?.[1] ?? [];
}

function metricOccurrences(input: ProseLintInput, terms: Set<string>, repeatsOnly = false): PatternOccurrence[] {
  const result: PatternOccurrence[] = [];
  const seen = new Map<string, number>();
  for (const document of input.documents) {
    for (const paragraph of document.paragraphs) {
      for (const token of paragraph.tokens) {
        if (!terms.has(token)) continue;
        const count = seen.get(token) ?? 0;
        seen.set(token, count + 1);
        if (!repeatsOnly || count > 0) result.push({ document, line: paragraph.line, excerpt: excerpt(paragraph.text) });
      }
    }
  }
  return result;
}

const patternDefinitions: readonly PatternDefinition[] = [
  {
    id: "style-pattern/negative-parallelism",
    baselineKey: "negative_parallelism_rate_per_1000",
    message: "Negative parallel constructions are concentrated in this manuscript scope.",
    occurrences: (input) => input.documents.flatMap((document) => sentenceOccurrences(document, (sentence) => /\b(?:not|never|no)\b[^.!?]{0,80}[,;—-]\s*(?:not|never|no)\b/i.test(sentence))),
  },
  {
    id: "style-pattern/not-x-but-y",
    baselineKey: "not_x_but_y_rate_per_1000",
    message: "‘Not X but Y’ constructions are concentrated in this manuscript scope.",
    occurrences: (input) => input.documents.flatMap((document) => sentenceOccurrences(document, (sentence) => /\bnot\b[^.!?]{1,100}\bbut\b/i.test(sentence))),
  },
  {
    id: "style-pattern/three-part-cadence",
    baselineKey: "three_part_cadence_rate_per_1000",
    message: "Three-part list or clause cadences are concentrated in this manuscript scope.",
    occurrences: (input) => input.documents.flatMap((document) => sentenceOccurrences(document, (sentence) => /[^,;.!?]{1,60},\s*[^,;.!?]{1,60},\s*(?:and|or)\s+[^,;.!?]{1,60}/i.test(sentence))),
  },
  {
    id: "style-pattern/aphoristic-close",
    baselineKey: "aphoristic_close_rate_per_1000",
    message: "Short declarative paragraph closes are concentrated in this manuscript scope.",
    occurrences: (input) => input.documents.flatMap((document) => document.paragraphs.flatMap((paragraph) => {
      const final = (paragraph.text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map((item) => item.trim()).filter(Boolean).at(-1);
      const length = final === undefined ? 0 : tokens(final).length;
      return final !== undefined && length >= 4 && length <= 9 && /[.!]\s*$/.test(final)
        ? [{ document, line: paragraph.line, excerpt: excerpt(final) }]
        : [];
    })),
  },
  {
    id: "style-pattern/rhetorical-question",
    baselineKey: "rhetorical_question_ratio",
    message: "Questions are concentrated relative to the selected scope or baseline.",
    occurrences: (input) => input.documents.flatMap((document) => sentenceOccurrences(document, (sentence) => /\?+\s*$/.test(sentence))),
    metric: (text) => {
      const metrics = extractVoiceMetrics(text);
      return { count: Math.round(metrics.rhetorical_question_ratio * metrics.sentence_count), rate: round4(metrics.rhetorical_question_ratio * 1_000) };
    },
  },
  {
    id: "style-pattern/fragment",
    baselineKey: "fragment_ratio",
    message: "Very short sentence fragments are concentrated relative to the selected scope or baseline.",
    occurrences: (input) => input.documents.flatMap((document) => sentenceOccurrences(document, (sentence) => {
      const length = tokens(sentence).length;
      return length > 0 && length <= 3;
    })),
    metric: (text) => {
      const metrics = extractVoiceMetrics(text);
      return { count: Math.round(metrics.fragment_ratio * metrics.sentence_count), rate: round4(metrics.fragment_ratio * 1_000) };
    },
  },
  {
    id: "style-pattern/em-dash",
    baselineKey: "em_dash_rate_per_1000",
    message: "Em dashes are concentrated in this manuscript scope.",
    occurrences: (input) => input.documents.flatMap((document) => document.paragraphs.flatMap((paragraph) =>
      [...paragraph.text.matchAll(/—/g)].map(() => ({ document, line: paragraph.line, excerpt: excerpt(paragraph.text) })))),
  },
  {
    id: "style-pattern/filter-word",
    baselineKey: "filter_word_rate_per_1000",
    message: "Filter words are concentrated relative to the selected scope or baseline.",
    occurrences: (input) => metricOccurrences(input, FILTER_WORDS),
    metric: (text) => {
      const metrics = extractVoiceMetrics(text);
      return { count: Math.round((metrics.filter_word_rate_per_1000 * metrics.word_count) / 1_000), rate: metrics.filter_word_rate_per_1000 };
    },
  },
  {
    id: "style-pattern/body-language-repetition",
    baselineKey: "body_language_repeat_rate_per_1000",
    message: "Repeated body-language nouns are concentrated relative to the selected scope or baseline.",
    occurrences: (input) => metricOccurrences(input, BODY_LANGUAGE, true),
    metric: (text) => {
      const metrics = extractVoiceMetrics(text);
      return { count: Math.round((metrics.body_language_repeat_rate_per_1000 * metrics.word_count) / 1_000), rate: metrics.body_language_repeat_rate_per_1000 };
    },
  },
  {
    id: "style-pattern/repeated-transition",
    baselineKey: "repeated_transition_rate_per_1000",
    message: "The same paragraph transition is concentrated in this manuscript scope.",
    occurrences: (input) => groupedDominant(input.documents.flatMap((document) => document.paragraphs.flatMap((paragraph) => {
      const first = tokens(paragraph.text)[0];
      return first !== undefined && TRANSITIONS.includes(first)
        ? [{ key: first, occurrence: { document, line: paragraph.line, excerpt: excerpt(paragraph.text) } }]
        : [];
    }))),
  },
  {
    id: "style-pattern/paragraph-shape",
    baselineKey: "paragraph_shape_rate_per_1000",
    message: "One paragraph sentence-count shape is concentrated in this manuscript scope.",
    occurrences: (input) => groupedDominant(input.documents.flatMap((document) => document.paragraphs.map((paragraph) => ({
      key: String((paragraph.text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).filter((item) => item.trim() !== "").length),
      occurrence: { document, line: paragraph.line, excerpt: excerpt(paragraph.text) },
    })))),
  },
  {
    id: "style-pattern/repeated-ending-syntax",
    baselineKey: "repeated_ending_syntax_rate_per_1000",
    message: "Multiple document endings share the same normalized sentence syntax.",
    occurrences: (input) => groupedDominant(input.documents.flatMap((document) => {
      const final = document.sentences.at(-1);
      if (final === undefined) return [];
      const signature = tokens(final.text).map(syntaxCategory).join(" ") + (/\?$/.test(final.text) ? " ?" : " .");
      return [{ key: signature, occurrence: { document, line: final.line, excerpt: excerpt(final.text) } }];
    })),
  },
];

function syntaxCategory(token: string): string {
  if (["i", "you", "he", "she", "it", "we", "they"].includes(token)) return "pronoun";
  if (["can", "could", "may", "might", "must", "shall", "should", "will", "would"].includes(token)) return "modal";
  if (["a", "an", "the", "this", "that", "these", "those"].includes(token)) return "determiner";
  if (["and", "but", "or", "nor", "yet", "so"].includes(token)) return "conjunction";
  if (["at", "before", "behind", "below", "by", "for", "from", "in", "into", "of", "on", "over", "through", "to", "under", "with"].includes(token)) return "preposition";
  return "word";
}

function ruleFor(definition: PatternDefinition): LintRule {
  return {
    id: definition.id,
    version: VERSION,
    requirements: { baselineMetrics: true },
    run(input) {
      const occurrences = definition.occurrences(input);
      const text = corpusMetricText(input.documents);
      const corpus = definition.metric?.(text) ?? occurrenceMetric(input, occurrences);
      const baseline = input.baselineMetrics?.[definition.baselineKey];
      let evidence: LintFinding["evidence"];
      let findingLocation: PatternOccurrence | undefined;

      if (baseline !== undefined) {
        const baselineRate = definition.baselineKey.endsWith("_ratio") ? baseline * 1_000 : baseline;
        const delta = round4(corpus.rate - baselineRate);
        const ratioSatisfied = baselineRate === 0 ? corpus.rate >= 2 : corpus.rate >= baselineRate * 1.5;
        if (Math.abs(delta) < 2 || !ratioSatisfied) return [];
        findingLocation = occurrences[0] ?? input.documents.map(firstProseOccurrence).find((item) => item !== undefined);
        evidence = {
          count: corpus.count,
          currentRate: corpus.rate,
          baselineRate: round4(baselineRate),
          delta,
          baselineMetric: definition.baselineKey,
          minimumDelta: 2,
          minimumRatio: 1.5,
        };
      } else {
        const totalWords = input.documents.reduce((sum, document) => sum + document.wordCount, 0);
        if (totalWords < MINIMUM_WORDS || corpus.count < MINIMUM_MATCHES) return [];
        const corpusConcentrationRate = ratePerThousand(corpus.count, totalWords);
        const local = input.documents.map((document) => {
          const localOccurrences = occurrences.filter((occurrence) => occurrence.document.path === document.path);
          const count = definition.metric?.(metricText(document)).count ?? localOccurrences.length;
          return { document, occurrences: localOccurrences, count, rate: ratePerThousand(count, document.wordCount) };
        }).sort((left, right) => right.rate - left.rate || left.document.order - right.document.order)[0];
        if (local === undefined || local.rate < corpusConcentrationRate * 2) return [];
        findingLocation = local.occurrences[0] ?? firstProseOccurrence(local.document);
        evidence = {
          count: corpus.count,
          corpusRate: corpusConcentrationRate,
          localRate: local.rate,
          localCount: local.count,
          localPath: local.document.path,
          minimumWords: MINIMUM_WORDS,
          minimumMatches: MINIMUM_MATCHES,
          concentrationRatio: round4(corpusConcentrationRate === 0 ? 0 : local.rate / corpusConcentrationRate),
        };
      }

      if (findingLocation === undefined) return [];
      return [{
        ruleId: this.id,
        ruleVersion: VERSION,
        class: "style-pattern",
        confidence: "review",
        location: { path: findingLocation.document.path, line: findingLocation.line },
        excerpt: findingLocation.excerpt,
        message: definition.message,
        evidence,
        reviewAction: "Review the concentration in manuscript context and preserve intentional voice choices.",
      }];
    },
  };
}

export const stylePatternRules: readonly LintRule[] = patternDefinitions.map(ruleFor);

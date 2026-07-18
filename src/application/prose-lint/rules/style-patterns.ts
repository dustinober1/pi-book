import { extractVoiceMetrics } from "../../voice-audit.js";
import type { LintFinding, LintRule, ProseLintInput } from "../types.js";

function pattern(id: string, label: string, regex: RegExp, input: ProseLintInput): LintFinding[] {
  const total = input.documents.reduce((sum, doc) => sum + doc.wordCount, 0);
  if (total < 2000) return [];
  const matches = input.documents.flatMap((doc) => [...doc.scanText.matchAll(regex)].map((match) => ({ doc, match })));
  if (matches.length < 4) return [];
  const first = matches[0];
  return [{ ruleId: `style-pattern/${id}`, ruleVersion: "1.0.0", class: "style-pattern", confidence: "review", location: { path: first?.doc.path ?? "", line: first ? first.doc.text.slice(0, first.match.index ?? 0).split("\n").length : 1 }, excerpt: (first?.match[0] ?? "").slice(0, 180), message: `${label} occurs ${matches.length} times in the review corpus.`, evidence: { count: matches.length, perThousandWords: Number(((matches.length / total) * 1000).toFixed(3)), minimumWords: 2000 }, reviewAction: "Review concentration and local context; do not treat the pattern as prohibited." }];
}

const rules: Array<[string, string, RegExp]> = [
  ["negative-parallelism", "Negative parallelism", /\bnot\s+[^.!?]{1,50}[.!?]\s+not\s+/gi],
  ["not-but", "Not-X-but-Y construction", /\bnot\s+[^,.;!?]{1,60}\s+but\s+/gi],
  ["three-part-cadence", "Three-part cadence", /\b\w+(?:,\s+\w+){2}(?:,?\s+and\s+\w+)?/gi],
  ["aphoristic-close", "Aphoristic close", /(?:that was|there it was|of course|the truth was|the problem was)[^.!?]{0,100}[.!?]/gi],
];

export const stylePatternRules: readonly LintRule[] = [
  ...rules.map(([id, label, regex]) => ({ id: `style-pattern/${id}`, version: "1.0.0", run: (input: ProseLintInput) => pattern(id, label, regex, input) })),
  { id: "style-pattern/voice-metrics", version: "1.0.0", run: (input) => {
    const current = extractVoiceMetrics(input.documents.map((doc) => doc.text).join("\n\n"));
    const baseline = input.baselineMetrics;
    if (!baseline) return [];
    const signals = ["rhetorical_question_ratio", "fragment_ratio", "filter_word_rate_per_1000", "body_language_repeat_rate_per_1000"];
    return signals.filter((key) => typeof baseline[key] === "number" && Math.abs((current[key] ?? 0) - (baseline[key] ?? 0)) >= 0.08).map((key) => ({ ruleId: "style-pattern/voice-metrics", ruleVersion: "1.0.0", class: "style-pattern", confidence: "review", location: { path: input.documents[0]?.path ?? "", line: 1 }, excerpt: key, message: `${key} differs from the accepted baseline.`, evidence: { metric: key, current: current[key] ?? 0, baseline: baseline[key] ?? 0, delta: Number(((current[key] ?? 0) - (baseline[key] ?? 0)).toFixed(4)) }, reviewAction: "Review against POV and protected voice exceptions; do not prescribe a target." }));
  } },
];

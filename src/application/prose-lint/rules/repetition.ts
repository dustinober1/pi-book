import type { LintFinding, LintRule, ProseLintInput } from "../types.js";

const STOP = new Set(["at the", "on the", "in the", "to the", "of the", "and the", "it was", "there was", "she said", "he said"]);
function phraseFindings(input: ProseLintInput): LintFinding[] {
  const counts = new Map<string, { count: number; docs: Set<string>; first: { path: string; line: number } }>();
  for (const doc of input.documents) for (let size = 2; size <= 5; size += 1) for (let index = 0; index <= doc.tokens.length - size; index += 1) {
    const phrase = doc.tokens.slice(index, index + size).join(" ");
    if (STOP.has(phrase) || (size === 2 && /^(?:the|a|an|and|of|to|in) /.test(phrase))) continue;
    const current = counts.get(phrase) ?? { count: 0, docs: new Set<string>(), first: { path: doc.path, line: 1 } };
    current.count += 1;
    current.docs.add(doc.path);
    counts.set(phrase, current);
  }
  return [...counts.entries()].filter(([, value]) => (value.docs.size >= 2 && value.count >= 3) || (value.docs.size === 1 && value.count >= 4)).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 80).map(([phrase, value]) => ({
    ruleId: "repetition/ngram", ruleVersion: "1.0.0", class: "repetition", confidence: "review", location: value.first, excerpt: `“${phrase}”`, message: `The phrase “${phrase}” repeats ${value.count} times across ${value.docs.size} chapter(s).`, evidence: { phrase, count: value.count, chapterCount: value.docs.size }, reviewAction: "Check whether recurrence is purposeful, character-specific, or prose fatigue.",
  }));
}

function openingFindings(input: ProseLintInput): LintFinding[] {
  const counts = new Map<string, { count: number; docs: Set<string>; first: { path: string; line: number } }>();
  for (const doc of input.documents) for (const sentence of doc.sentences) {
    const opening = sentence.text.split(/\s+/).slice(0, 3).join(" ").toLocaleLowerCase("en-US");
    if (opening.split(" ").length < 3) continue;
    const current = counts.get(opening) ?? { count: 0, docs: new Set<string>(), first: { path: doc.path, line: sentence.line } };
    current.count += 1; current.docs.add(doc.path); counts.set(opening, current);
  }
  return [...counts.entries()].filter(([, value]) => value.count >= 3 && value.docs.size >= 2).slice(0, 40).map(([opening, value]) => ({ ruleId: "repetition/sentence-opening", ruleVersion: "1.0.0", class: "repetition", confidence: "review", location: value.first, excerpt: opening, message: `The same three-word sentence opening recurs ${value.count} times across ${value.docs.size} chapter(s).`, evidence: { opening, count: value.count, chapterCount: value.docs.size }, reviewAction: "Compare the recurrence across POVs and scene functions." }));
}

export const repetitionRules: readonly LintRule[] = [
  { id: "repetition/ngram", version: "1.0.0", run: phraseFindings },
  { id: "repetition/sentence-opening", version: "1.0.0", run: openingFindings },
];

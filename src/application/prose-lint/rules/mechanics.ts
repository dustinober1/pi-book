import type { LintFinding, LintRule, ProseLintInput } from "../types.js";

function finding(ruleId: string, path: string, line: number, excerpt: string, message: string, reviewAction: string, confidence: LintFinding["confidence"] = "high"): LintFinding {
  return { ruleId, ruleVersion: "1.0.0", class: "mechanical", confidence, location: { path, line }, excerpt: excerpt.slice(0, 180), message, evidence: {}, reviewAction };
}

export const mechanicalRules: readonly LintRule[] = [
  { id: "mechanics/doubled-word", version: "1.0.0", run: ({ documents }) => documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => /\b(\w+)\s+\1\b/i.test(line) ? [finding("mechanics/doubled-word", doc.path, index + 1, line, "Adjacent words are duplicated.", "Confirm whether the duplicate is intentional.")] : [])) },
  { id: "mechanics/punctuation-spacing", version: "1.0.0", run: ({ documents }) => documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => /\s+[,.!?;:]/.test(line) ? [finding("mechanics/punctuation-spacing", doc.path, index + 1, line, "Whitespace appears before punctuation.", "Correct the spacing if it is not intentional.")] : [])) },
  { id: "mechanics/drafting-marker", version: "1.0.0", run: ({ documents }) => documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => /\[\[(?:TODO|FIXME):?[^\]]*\]\]|\bTKTK\b/i.test(line) ? [finding("mechanics/drafting-marker", doc.path, index + 1, line, "A drafting marker remains in manuscript prose.", "Resolve or deliberately preserve the marker before publication.")] : [])) },
  { id: "mechanics/meta-narrative-leakage", version: "1.0.0", run: ({ documents }) => documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => /^\s*#/.test(line) ? [] : /\b(?:in novels?|the novel|this chapter|the chapter|readers?)\b/i.test(line) ? [finding("mechanics/meta-narrative-leakage", doc.path, index + 1, line, "Narrative language may be referring to the construction of a novel rather than the story world.", "Review in context; literary metafiction may be intentional.", "review")] : [])) },
];

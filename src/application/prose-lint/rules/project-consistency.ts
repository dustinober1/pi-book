import type { LintRule, ProseLintInput } from "../types.js";

export const projectConsistencyRules: readonly LintRule[] = [
  { id: "consistency/canon-name-case", version: "1.0.0", run: ({ documents, projectContext }) => (projectContext?.canonNames ?? []).flatMap((name) => {
    if (name.length < 2) return [];
    const variant = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
    return documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => line.includes(name) || !variant.test(line) ? [] : [{ ruleId: "consistency/canon-name-case", ruleVersion: "1.0.0", class: "consistency" as const, confidence: "medium" as const, location: { path: doc.path, line: index + 1 }, excerpt: line.slice(0, 180), message: `Canon name ${name} appears with a different case.`, evidence: { canonical: name }, reviewAction: "Confirm whether this is a deliberate alias or a continuity error." }]));
  }) },
  { id: "consistency/temporal-marker", version: "1.0.0", run: ({ documents }) => documents.flatMap((doc) => doc.scanText.split("\n").flatMap((line, index) => /\b(?:tomorrow|yesterday|tonight|next (?:morning|week|month|year)|last (?:night|week|month|year)|soon)\b/i.test(line) ? [{ ruleId: "consistency/temporal-marker", ruleVersion: "1.0.0", class: "consistency" as const, confidence: "review" as const, location: { path: doc.path, line: index + 1 }, excerpt: line.slice(0, 180), message: "Temporal language requires chronology review.", evidence: {}, reviewAction: "Check the chronology ledger after chapter order or schedule changes." }] : [])) },
];

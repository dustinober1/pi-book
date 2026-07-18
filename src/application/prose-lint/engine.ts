import type { LintClass, LintFinding, ProseLintInput, ProseLintResult, LintRule } from "./types.js";

const classOrder: LintClass[] = ["mechanical", "consistency", "repetition", "style-pattern"];

export function runProseLint(input: ProseLintInput, rules: readonly LintRule[]): ProseLintResult {
  const findings: LintFinding[] = [];
  const failures: Array<{ ruleId: string; message: string }> = [];
  for (const rule of rules) {
    try { findings.push(...rule.run(input)); }
    catch (error) { failures.push({ ruleId: rule.id, message: error instanceof Error ? error.message : "Rule failed." }); }
  }
  findings.sort((left, right) => classOrder.indexOf(left.class) - classOrder.indexOf(right.class) || left.ruleId.localeCompare(right.ruleId) || (left.location.path.localeCompare(right.location.path)) || (left.location.line ?? 0) - (right.location.line ?? 0) || left.excerpt.localeCompare(right.excerpt));
  const counts: Record<LintClass, number> = { mechanical: 0, consistency: 0, repetition: 0, "style-pattern": 0 };
  for (const item of findings) counts[item.class] += 1;
  return { findings, failures, counts, wordCount: input.documents.reduce((sum, doc) => sum + doc.wordCount, 0) };
}

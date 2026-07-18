import type { LintClass, LintFinding, ProseLintInput, ProseLintResult } from "./types.js";
import { compareDeterministicText } from "./order.js";

const classOrder: Record<LintClass, number> = {
  mechanical: 0,
  consistency: 1,
  repetition: 2,
  "style-pattern": 3,
};

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runProseLint(input: ProseLintInput): ProseLintResult {
  const findings: LintFinding[] = [];
  const failures: Array<{ ruleId: string; message: string }> = [];

  for (const rule of input.rules) {
    try {
      findings.push(...rule.run(input));
    } catch (error) {
      failures.push({ ruleId: rule.id, message: messageFor(error) });
    }
  }

  const documentOrder = new Map(input.documents.map((document) => [document.path, document.order]));
  findings.sort((left, right) => {
    const classDifference = classOrder[left.class] - classOrder[right.class];
    if (classDifference !== 0) return classDifference;
    const ruleDifference = compareDeterministicText(left.ruleId, right.ruleId);
    if (ruleDifference !== 0) return ruleDifference;
    const orderDifference = (documentOrder.get(left.location.path) ?? Number.MAX_SAFE_INTEGER)
      - (documentOrder.get(right.location.path) ?? Number.MAX_SAFE_INTEGER);
    if (orderDifference !== 0) return orderDifference;
    const lineDifference = (left.location.line ?? Number.MAX_SAFE_INTEGER) - (right.location.line ?? Number.MAX_SAFE_INTEGER);
    if (lineDifference !== 0) return lineDifference;
    const excerptDifference = compareDeterministicText(left.excerpt, right.excerpt);
    if (excerptDifference !== 0) return excerptDifference;
    return compareDeterministicText(JSON.stringify(left.evidence), JSON.stringify(right.evidence));
  });

  const counts: Record<LintClass, number> = {
    mechanical: 0,
    consistency: 0,
    repetition: 0,
    "style-pattern": 0,
  };
  for (const finding of findings) counts[finding.class] += 1;

  return {
    findings,
    failures,
    counts,
    wordCount: input.documents.reduce((total, document) => total + document.wordCount, 0),
  };
}

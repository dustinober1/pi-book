export { runProseLint } from "./engine.js";
export { loadProseLintInput } from "./project.js";
export { normalizeDocument } from "./normalize.js";
export { renderProseLintJson, renderProseLintMarkdown, renderReviewLintEvidence } from "./report.js";
export { mechanicalRules } from "./rules/mechanics.js";
export { projectConsistencyRules } from "./rules/project-consistency.js";
export { createNgramRule, repetitionRules } from "./rules/repetition.js";
export { stylePatternRules } from "./rules/style-patterns.js";
export type {
  LintClass,
  LintConfidence,
  LintFinding,
  LintRule,
  LintRuleRequirements,
  LegacyReportKind,
  ManuscriptDocument,
  ProjectContextArtifact,
  ProjectLintContext,
  ProseLintInput,
  ProseLintResult,
  ReportOptions,
} from "./types.js";

import type { LintRule } from "./types.js";
import { mechanicalRules } from "./rules/mechanics.js";
import { projectConsistencyRules } from "./rules/project-consistency.js";
import { repetitionRules } from "./rules/repetition.js";
import { stylePatternRules } from "./rules/style-patterns.js";

export const defaultProseLintRules: readonly LintRule[] = [
  ...mechanicalRules,
  ...projectConsistencyRules,
  ...repetitionRules,
  ...stylePatternRules,
];

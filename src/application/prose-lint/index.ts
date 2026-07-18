export { runProseLint } from "./engine.js";
export { normalizeDocument } from "./normalize.js";
export { mechanicalRules } from "./rules/mechanics.js";
export { repetitionRules } from "./rules/repetition.js";
export { stylePatternRules } from "./rules/style-patterns.js";
export type {
  LintClass,
  LintConfidence,
  LintFinding,
  LintRule,
  ManuscriptDocument,
  ProseLintInput,
  ProseLintResult,
} from "./types.js";

import type { LintRule } from "./types.js";
import { mechanicalRules } from "./rules/mechanics.js";
import { repetitionRules } from "./rules/repetition.js";
import { stylePatternRules } from "./rules/style-patterns.js";

export const defaultProseLintRules: readonly LintRule[] = [
  ...mechanicalRules,
  ...repetitionRules,
  ...stylePatternRules,
];

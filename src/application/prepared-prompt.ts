import { resolveModelBudget } from "../domain/model-budget.js";
import type { RuntimeProfile } from "../domain/runtime-profile.js";
import { compilePrompt, type PromptSectionName } from "./prompt-compiler.js";
import type { StageSpec } from "./stage-specs/types.js";

export interface PreparedPrompt {
  text: string;
  instructionChars: number;
  evidenceChars: number;
  estimatedInputTokens: number;
  sectionCharacters: Readonly<Record<PromptSectionName, number>>;
}

export function preparePrompt(spec: StageSpec, evidence: string, profile: RuntimeProfile): PreparedPrompt {
  const instructions = compilePrompt(spec, profile);
  resolveModelBudget(profile.modelBudget, instructions.characterCount);
  const normalizedEvidence = evidence.trim();
  const evidenceChars = normalizedEvidence.length;
  if (evidenceChars > profile.modelBudget.maxEvidenceChars) {
    throw new Error(`Evidence budget exceeded for stage ${spec.id} under profile ${profile.id}: actual=${evidenceChars}, maximum=${profile.modelBudget.maxEvidenceChars}.`);
  }
  const text = normalizedEvidence
    ? `${instructions.text}\n\n## Evidence and bounded project context\n\n${normalizedEvidence}`
    : instructions.text;
  return {
    text,
    instructionChars: instructions.characterCount,
    evidenceChars,
    estimatedInputTokens: Math.ceil(text.length / 4),
    sectionCharacters: instructions.sectionCharacters,
  };
}

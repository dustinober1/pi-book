import { Type, type Static } from "@sinclair/typebox";

export const MODEL_JOB_TYPES = [
  "compile-chapter-contract",
  "compile-scene-contract",
  "plan-scene",
  "draft-scene",
  "extract-state-delta",
  "critic-continuity",
  "critic-causality",
  "critic-character-intent",
  "critic-style",
  "critic-factuality",
  "patch-spans",
  "stitch-chapter",
  "verify-chapter",
  "review-book-concern",
] as const;

export const ModelJobTypeSchema = Type.Union(MODEL_JOB_TYPES.map((value) => Type.Literal(value)));
export type ModelJobType = Static<typeof ModelJobTypeSchema>;

export interface DecodingPolicy {
  temperature: number;
  topP: number;
  maximumOutputTokens: number;
  repetitionPenalty?: number;
  thinking?: "off" | "minimal" | "low" | "medium";
}

export interface JobBudgetPolicy {
  maximumInstructionTokens: number;
  maximumEvidenceTokens: number;
  reservedOutputTokens: number;
  safetyMarginTokens: number;
}

export function isModelJobType(value: unknown): value is ModelJobType {
  return typeof value === "string" && (MODEL_JOB_TYPES as readonly string[]).includes(value);
}

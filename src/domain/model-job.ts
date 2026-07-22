import { Type, type Static } from "@sinclair/typebox";

export const MODEL_JOB_TYPES = [
  "compile-chapter-contract",
  "compile-scene-contract",
  "plan-scene",
  "draft-scene",
  "candidate-selection",
  "critic-combined",
  "extract-state-delta",
  "extract-factual-claims",
  "critic-continuity",
  "critic-causality",
  "critic-character-intent",
  "critic-style",
  "critic-factuality",
  "repair-factuality",
  "patch-spans",
  "synthesize-event-output",
  "stitch-chapter",
  "verify-chapter",
  "review-book-concern",
] as const;

export const ModelJobTypeSchema = Type.Union(MODEL_JOB_TYPES.map((value) => Type.Literal(value)));
export type ModelJobType = Static<typeof ModelJobTypeSchema>;

export function isModelJobType(value: unknown): value is ModelJobType {
  return typeof value === "string" && (MODEL_JOB_TYPES as readonly string[]).includes(value);
}

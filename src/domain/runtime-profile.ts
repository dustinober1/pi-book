import { Type, type Static } from "@sinclair/typebox";
import type { ModelBudgetEnvelope } from "./model-budget.js";

export const RuntimeProfileIdSchema = Type.Union([
  Type.Literal("tiny-local"),
  Type.Literal("local"),
  Type.Literal("full"),
]);
export type RuntimeProfileId = Static<typeof RuntimeProfileIdSchema>;

export type PromptStyle = "compact" | "standard";

export interface RuntimeProfile {
  id: RuntimeProfileId;
  maxContextChars: number;
  maxPromptChars: number;
  modelBudget: ModelBudgetEnvelope;
  graphDepth: 1 | 2;
  promptStyle: PromptStyle;
  maxArtifactsPerStage: number | null;
  maxChaptersPerRun: number | null;
  maxRevisionTickets: number | null;
  preferStructuredIR: boolean;
  maxRepairAttempts: number;
  stopOnContextWarning: boolean;
}

export const RUNTIME_PROFILE_IDS = ["tiny-local", "local", "full"] as const satisfies readonly RuntimeProfileId[];

export const RUNTIME_PROFILES: Readonly<Record<RuntimeProfileId, RuntimeProfile>> = Object.freeze({
  "tiny-local": Object.freeze({
    id: "tiny-local",
    maxContextChars: 12_000,
    maxPromptChars: 6_000,
    modelBudget: Object.freeze({
      maxInstructionChars: 6_000,
      maxEvidenceChars: 12_000,
      reservedOutputTokens: 2_000,
      safetyMarginTokens: 500,
    }),
    graphDepth: 1,
    promptStyle: "compact",
    maxArtifactsPerStage: 1,
    maxChaptersPerRun: 1,
    maxRevisionTickets: 1,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: true,
  }),
  local: Object.freeze({
    id: "local",
    maxContextChars: 24_000,
    maxPromptChars: 10_000,
    modelBudget: Object.freeze({
      maxInstructionChars: 10_000,
      maxEvidenceChars: 24_000,
      reservedOutputTokens: 4_000,
      safetyMarginTokens: 1_000,
    }),
    graphDepth: 2,
    promptStyle: "compact",
    maxArtifactsPerStage: 2,
    maxChaptersPerRun: 1,
    maxRevisionTickets: 2,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: false,
  }),
  full: Object.freeze({
    id: "full",
    maxContextChars: 72_000,
    maxPromptChars: 24_000,
    modelBudget: Object.freeze({
      maxInstructionChars: 24_000,
      maxEvidenceChars: 72_000,
      reservedOutputTokens: 8_000,
      safetyMarginTokens: 2_000,
    }),
    graphDepth: 2,
    promptStyle: "standard",
    maxArtifactsPerStage: null,
    maxChaptersPerRun: null,
    maxRevisionTickets: null,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: false,
  }),
});

export function parseRuntimeProfileId(value: unknown): RuntimeProfileId {
  if (typeof value === "string" && RUNTIME_PROFILE_IDS.includes(value as RuntimeProfileId)) return value as RuntimeProfileId;
  throw new Error(`Unknown runtime profile: ${String(value)}. Allowed: ${RUNTIME_PROFILE_IDS.join(", ")}.`);
}

import { Type, type Static } from "@sinclair/typebox";
import { MODEL_JOB_TYPES, type DecodingPolicy, type JobBudgetPolicy, type ModelJobType } from "./model-job.js";

export const MODEL_EXECUTION_PROFILE_IDS = ["host-default", "small-12b-q4", "custom"] as const;
export const ModelExecutionProfileIdSchema = Type.Union(MODEL_EXECUTION_PROFILE_IDS.map((value) => Type.Literal(value)));
export type ModelExecutionProfileId = Static<typeof ModelExecutionProfileIdSchema>;

export interface ModelExecutionProfile {
  schema_version: "1.0.0";
  id: ModelExecutionProfileId;
  display_name: string;
  reliable_context_tokens: number;
  maximum_output_tokens: number;
  preferred_scene_words: { minimum: number; maximum: number };
  capabilities: { json_schema: boolean; grammar: boolean; tool_calls: boolean };
  job_budgets: Record<ModelJobType, JobBudgetPolicy>;
  decoding: Record<ModelJobType, DecodingPolicy>;
}

function recordForJobs<T>(factory: (jobType: ModelJobType) => T): Record<ModelJobType, T> {
  return Object.fromEntries(MODEL_JOB_TYPES.map((jobType) => [jobType, factory(jobType)])) as Record<ModelJobType, T>;
}

const structuredJobs = new Set<ModelJobType>([
  "compile-chapter-contract", "compile-scene-contract", "plan-scene", "extract-state-delta",
  "critic-continuity", "critic-causality", "critic-character-intent", "critic-style",
  "critic-factuality", "verify-chapter", "review-book-concern",
]);

function hostProfile(): ModelExecutionProfile {
  return {
    schema_version: "1.0.0",
    id: "host-default",
    display_name: "Host default",
    reliable_context_tokens: 128_000,
    maximum_output_tokens: 16_000,
    preferred_scene_words: { minimum: 700, maximum: 1800 },
    capabilities: { json_schema: true, grammar: true, tool_calls: true },
    job_budgets: recordForJobs(() => ({ maximumInstructionTokens: 6000, maximumEvidenceTokens: 24000, reservedOutputTokens: 4000, safetyMarginTokens: 1000 })),
    decoding: recordForJobs((jobType) => ({ temperature: structuredJobs.has(jobType) ? 0 : 0.65, topP: structuredJobs.has(jobType) ? 0.9 : 0.95, maximumOutputTokens: 4000, thinking: structuredJobs.has(jobType) ? "minimal" : "low" })),
  };
}

function smallProfile(): ModelExecutionProfile {
  const job_budgets = recordForJobs((jobType) => {
    if (jobType === "draft-scene") return { maximumInstructionTokens: 1400, maximumEvidenceTokens: 5200, reservedOutputTokens: 2200, safetyMarginTokens: 800 };
    if (jobType === "stitch-chapter") return { maximumInstructionTokens: 1200, maximumEvidenceTokens: 7600, reservedOutputTokens: 2600, safetyMarginTokens: 800 };
    if (jobType === "extract-state-delta" || jobType.startsWith("critic-") || jobType === "verify-chapter") {
      return { maximumInstructionTokens: 1000, maximumEvidenceTokens: 4200, reservedOutputTokens: 900, safetyMarginTokens: 700 };
    }
    return { maximumInstructionTokens: 1100, maximumEvidenceTokens: 3600, reservedOutputTokens: 1200, safetyMarginTokens: 700 };
  });
  const decoding = recordForJobs((jobType) => {
    if (jobType === "draft-scene") return { temperature: 0.65, topP: 0.92, maximumOutputTokens: 2200, repetitionPenalty: 1.08, thinking: "off" };
    if (jobType === "stitch-chapter" || jobType === "patch-spans") return { temperature: 0.15, topP: 0.9, maximumOutputTokens: job_budgets[jobType].reservedOutputTokens, thinking: "off" };
    return { temperature: 0, topP: 0.9, maximumOutputTokens: job_budgets[jobType].reservedOutputTokens, thinking: "off" };
  });
  return {
    schema_version: "1.0.0",
    id: "small-12b-q4",
    display_name: "Small 12B 4-bit",
    reliable_context_tokens: 12_000,
    maximum_output_tokens: 2600,
    preferred_scene_words: { minimum: 650, maximum: 1100 },
    capabilities: { json_schema: true, grammar: true, tool_calls: false },
    job_budgets,
    decoding,
  };
}

export const MODEL_EXECUTION_PROFILES: Readonly<Record<Exclude<ModelExecutionProfileId, "custom">, ModelExecutionProfile>> = Object.freeze({
  "host-default": Object.freeze(hostProfile()),
  "small-12b-q4": Object.freeze(smallProfile()),
});

export function parseModelExecutionProfileId(value: unknown): ModelExecutionProfileId {
  if (typeof value === "string" && (MODEL_EXECUTION_PROFILE_IDS as readonly string[]).includes(value)) return value as ModelExecutionProfileId;
  throw new Error(`Unknown model execution profile: ${String(value)}. Allowed: ${MODEL_EXECUTION_PROFILE_IDS.join(", ")}.`);
}

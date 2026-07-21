import { Type, type Static } from "@sinclair/typebox";
import { MODEL_JOB_TYPES, type ModelJobType } from "./model-job.js";

export const MODEL_EXECUTION_PROFILE_IDS = ["host-default", "small-12b-q4", "custom"] as const;
export const ModelExecutionProfileIdSchema = Type.Union(MODEL_EXECUTION_PROFILE_IDS.map((value) => Type.Literal(value)));
export type ModelExecutionProfileId = Static<typeof ModelExecutionProfileIdSchema>;

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

export interface ModelExecutionProfile {
  schema_version: "1.0.0";
  id: ModelExecutionProfileId;
  display_name: string;
  reliable_context_tokens: number;
  maximum_output_tokens: number;
  preferred_scene_words: { minimum: number; maximum: number };
  capabilities: {
    json_schema: boolean;
    grammar: boolean;
    tool_calls: boolean;
  };
  job_budgets: Record<ModelJobType, JobBudgetPolicy>;
  decoding: Record<ModelJobType, DecodingPolicy>;
}

function jobRecord<T>(factory: (jobType: ModelJobType) => T): Record<ModelJobType, T> {
  return Object.fromEntries(MODEL_JOB_TYPES.map((jobType) => [jobType, factory(jobType)])) as Record<ModelJobType, T>;
}

function structuredBudget(evidence = 4_000, output = 1_000): JobBudgetPolicy {
  return {
    maximumInstructionTokens: 1_000,
    maximumEvidenceTokens: evidence,
    reservedOutputTokens: output,
    safetyMarginTokens: 512,
  };
}

function structuredDecoding(output = 1_000): DecodingPolicy {
  return {
    temperature: 0.1,
    topP: 0.3,
    maximumOutputTokens: output,
    thinking: "off",
  };
}

const hostBudgets = jobRecord<JobBudgetPolicy>(() => ({
  maximumInstructionTokens: 6_000,
  maximumEvidenceTokens: 24_000,
  reservedOutputTokens: 8_000,
  safetyMarginTokens: 2_000,
}));
const hostDecoding = jobRecord<DecodingPolicy>((jobType) => ({
  temperature: jobType === "draft-scene" ? 0.7 : 0.2,
  topP: jobType === "draft-scene" ? 0.95 : 0.5,
  maximumOutputTokens: jobType === "draft-scene" ? 8_000 : 4_000,
  thinking: jobType === "draft-scene" ? "low" : "minimal",
}));

const smallBudgets = jobRecord<JobBudgetPolicy>((jobType) => {
  switch (jobType) {
    case "draft-scene":
      return { maximumInstructionTokens: 1_200, maximumEvidenceTokens: 6_000, reservedOutputTokens: 2_600, safetyMarginTokens: 512 };
    case "stitch-chapter":
      return { maximumInstructionTokens: 1_100, maximumEvidenceTokens: 7_000, reservedOutputTokens: 2_200, safetyMarginTokens: 512 };
    case "review-book-concern":
      return { maximumInstructionTokens: 1_200, maximumEvidenceTokens: 10_000, reservedOutputTokens: 1_600, safetyMarginTokens: 768 };
    case "patch-spans":
      return { maximumInstructionTokens: 1_000, maximumEvidenceTokens: 5_000, reservedOutputTokens: 1_400, safetyMarginTokens: 512 };
    case "plan-scene":
    case "compile-chapter-contract":
    case "compile-scene-contract":
      return structuredBudget(5_000, 1_200);
    case "verify-chapter":
      return structuredBudget(7_000, 1_000);
    case "extract-state-delta":
      return structuredBudget(4_000, 900);
    default:
      return structuredBudget(5_000, 900);
  }
});

const smallDecoding = jobRecord<DecodingPolicy>((jobType) => {
  switch (jobType) {
    case "draft-scene":
      return { temperature: 0.65, topP: 0.9, maximumOutputTokens: 2_600, repetitionPenalty: 1.08, thinking: "off" };
    case "stitch-chapter":
      return { temperature: 0.25, topP: 0.6, maximumOutputTokens: 2_200, repetitionPenalty: 1.05, thinking: "off" };
    case "patch-spans":
      return { temperature: 0.15, topP: 0.4, maximumOutputTokens: 1_400, thinking: "off" };
    case "review-book-concern":
      return { temperature: 0.1, topP: 0.3, maximumOutputTokens: 1_600, thinking: "minimal" };
    case "plan-scene":
    case "compile-chapter-contract":
    case "compile-scene-contract":
      return structuredDecoding(1_200);
    case "extract-state-delta":
      return structuredDecoding(900);
    default:
      return structuredDecoding(1_000);
  }
});

export const MODEL_EXECUTION_PROFILES: Readonly<Record<"host-default" | "small-12b-q4", ModelExecutionProfile>> = Object.freeze({
  "host-default": Object.freeze({
    schema_version: "1.0.0",
    id: "host-default",
    display_name: "Host default model",
    reliable_context_tokens: 128_000,
    maximum_output_tokens: 32_000,
    preferred_scene_words: Object.freeze({ minimum: 1_000, maximum: 2_500 }),
    capabilities: Object.freeze({ json_schema: true, grammar: true, tool_calls: true }),
    job_budgets: Object.freeze(hostBudgets),
    decoding: Object.freeze(hostDecoding),
  }),
  "small-12b-q4": Object.freeze({
    schema_version: "1.0.0",
    id: "small-12b-q4",
    display_name: "Small 12B 4-bit model",
    reliable_context_tokens: 16_384,
    maximum_output_tokens: 4_096,
    preferred_scene_words: Object.freeze({ minimum: 700, maximum: 1_200 }),
    capabilities: Object.freeze({ json_schema: false, grammar: true, tool_calls: false }),
    job_budgets: Object.freeze(smallBudgets),
    decoding: Object.freeze(smallDecoding),
  }),
});

export function parseModelExecutionProfileId(value: unknown): ModelExecutionProfileId {
  if (typeof value === "string" && (MODEL_EXECUTION_PROFILE_IDS as readonly string[]).includes(value)) {
    return value as ModelExecutionProfileId;
  }
  throw new Error(`Unknown model execution profile: ${String(value)}. Allowed: ${MODEL_EXECUTION_PROFILE_IDS.join(", ")}.`);
}

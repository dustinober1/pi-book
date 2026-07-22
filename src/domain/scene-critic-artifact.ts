import { Type, type Static } from "@sinclair/typebox";
import { ModelCallReportSchema } from "./run-report.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const SCENE_CRITIC_JOB_TYPES = [
  "critic-continuity",
  "critic-causality",
  "critic-character-intent",
  "critic-style",
  "critic-factuality",
] as const;

export const SceneCriticJobTypeSchema = Type.Union(SCENE_CRITIC_JOB_TYPES.map((value) => Type.Literal(value)));
export type SceneCriticJobType = Static<typeof SceneCriticJobTypeSchema>;

export function isSceneCriticJobType(value: unknown): value is SceneCriticJobType {
  return typeof value === "string" && (SCENE_CRITIC_JOB_TYPES as readonly string[]).includes(value);
}

export const SceneCriticFindingSchema = Type.Object({
  severity: Type.Union([
    Type.Literal("blocker"),
    Type.Literal("high"),
    Type.Literal("medium"),
    Type.Literal("low"),
  ]),
  category: Type.String({ minLength: 1, maxLength: 80 }),
  evidence_quote: Type.String({ minLength: 1, maxLength: 240 }),
  required_change: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
export type SceneCriticFinding = Static<typeof SceneCriticFindingSchema>;

export const SceneCriticOutputSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  verdict: Type.Union([Type.Literal("pass"), Type.Literal("repair"), Type.Literal("block")]),
  findings: Type.Array(SceneCriticFindingSchema, { maxItems: 12 }),
}, { additionalProperties: false });
export type SceneCriticOutput = Static<typeof SceneCriticOutputSchema>;

export const SceneCriticArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  job_type: SceneCriticJobTypeSchema,
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  critic_attempt: Type.Integer({ minimum: 1 }),
  verdict: SceneCriticOutputSchema.properties.verdict,
  findings: Type.Array(SceneCriticFindingSchema, { maxItems: 12 }),
  usage: ModelCallReportSchema,
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type SceneCriticArtifact = Static<typeof SceneCriticArtifactSchema>;

export const SceneCriticSummaryArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  contract_hash: HashSchema,
  required_job_types: Type.Array(SceneCriticJobTypeSchema, { minItems: 1, uniqueItems: true }),
  critics: Type.Array(Type.Object({
    job_type: SceneCriticJobTypeSchema,
    critic_attempt: Type.Integer({ minimum: 1 }),
    verdict: SceneCriticOutputSchema.properties.verdict,
    finding_count: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }), { minItems: 1 }),
  blocker_count: Type.Integer({ minimum: 0 }),
  repair_count: Type.Integer({ minimum: 0 }),
  passed: Type.Boolean(),
  next_action: Type.Union([Type.Literal("state-delta"), Type.Literal("span-repair"), Type.Literal("blocked")]),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type SceneCriticSummaryArtifact = Static<typeof SceneCriticSummaryArtifactSchema>;

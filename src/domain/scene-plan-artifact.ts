import { Type, type Static } from "@sinclair/typebox";
import { ModelCallReportSchema } from "./run-report.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ScenePlanStepSchema = Type.Object({
  required_beat: Type.String({ minLength: 1, maxLength: 300 }),
  execution: Type.String({ minLength: 1, maxLength: 500 }),
  pressure: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
export type ScenePlanStep = Static<typeof ScenePlanStepSchema>;

export const ScenePlanOutputSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  steps: Type.Array(ScenePlanStepSchema, { minItems: 1, maxItems: 12 }),
  turn_execution: Type.String({ minLength: 1, maxLength: 500 }),
  ending_execution: Type.String({ minLength: 1, maxLength: 500 }),
  evidence_record_ids: Type.Array(Type.String({ minLength: 1 }), { maxItems: 24, uniqueItems: true }),
}, { additionalProperties: false });
export type ScenePlanOutput = Static<typeof ScenePlanOutputSchema>;

export const ScenePlanArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  plan_attempt: Type.Integer({ minimum: 1 }),
  steps: Type.Array(ScenePlanStepSchema, { minItems: 1, maxItems: 12 }),
  turn_execution: Type.String({ minLength: 1, maxLength: 500 }),
  ending_execution: Type.String({ minLength: 1, maxLength: 500 }),
  evidence_record_ids: Type.Array(Type.String({ minLength: 1 }), { maxItems: 24, uniqueItems: true }),
  usage: ModelCallReportSchema,
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ScenePlanArtifact = Static<typeof ScenePlanArtifactSchema>;

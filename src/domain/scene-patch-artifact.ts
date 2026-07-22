import { Type, type Static } from "@sinclair/typebox";
import { ModelCallReportSchema } from "./run-report.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ScenePatchOperationTypeSchema = Type.Union([
  Type.Literal("replace"),
  Type.Literal("delete"),
  Type.Literal("insert-before"),
  Type.Literal("insert-after"),
]);
export type ScenePatchOperationType = Static<typeof ScenePatchOperationTypeSchema>;

export const ScenePatchOperationInputSchema = Type.Object({
  operation: ScenePatchOperationTypeSchema,
  anchor_quote: Type.String({ minLength: 1, maxLength: 240 }),
  replacement: Type.String({ maxLength: 800 }),
  finding_refs: Type.Array(Type.String({ minLength: 1, maxLength: 120 }), { minItems: 1, maxItems: 8, uniqueItems: true }),
}, { additionalProperties: false });
export type ScenePatchOperationInput = Static<typeof ScenePatchOperationInputSchema>;

export const ScenePatchOutputSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  operations: Type.Array(ScenePatchOperationInputSchema, { minItems: 1, maxItems: 8 }),
}, { additionalProperties: false });
export type ScenePatchOutput = Static<typeof ScenePatchOutputSchema>;

export const ResolvedScenePatchOperationSchema = Type.Object({
  ...ScenePatchOperationInputSchema.properties,
  start: Type.Integer({ minimum: 0 }),
  end: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false });
export type ResolvedScenePatchOperation = Static<typeof ResolvedScenePatchOperationSchema>;

export const ScenePatchArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  source_draft_attempt: Type.Integer({ minimum: 1 }),
  repaired_draft_attempt: Type.Integer({ minimum: 2 }),
  source_output_hash: HashSchema,
  repaired_output_hash: HashSchema,
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  patch_attempt: Type.Integer({ minimum: 1 }),
  operations: Type.Array(ResolvedScenePatchOperationSchema, { minItems: 1, maxItems: 8 }),
  affected_character_count: Type.Integer({ minimum: 0 }),
  replacement_character_count: Type.Integer({ minimum: 0 }),
  usage: ModelCallReportSchema,
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ScenePatchArtifact = Static<typeof ScenePatchArtifactSchema>;

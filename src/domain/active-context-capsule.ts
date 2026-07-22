import { Type, type Static } from "@sinclair/typebox";
import { ModelExecutionProfileIdSchema } from "./model-execution-profile.js";
import { ModelJobTypeSchema } from "./model-job.js";
import { SceneContractSchema } from "./scene-contract.js";
import { StoryRecordStatusSchema } from "./story-record-status.js";
import { StoryRecordTypeSchema } from "../context/story-record-index.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ContextAuthoritySchema = Type.Union([
  Type.Literal("established"),
  Type.Literal("requirement"),
  Type.Literal("proposal"),
]);
export type ContextAuthority = Static<typeof ContextAuthoritySchema>;

export const ActiveContextRecordSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  record_type: StoryRecordTypeSchema,
  status: StoryRecordStatusSchema,
  authority: ContextAuthoritySchema,
  required: Type.Boolean(),
  reason: Type.String({ minLength: 1 }),
  source_path: Type.String({ minLength: 1 }),
  payload: Type.Unknown(),
  dependencies: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  estimated_tokens: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type ActiveContextRecord = Static<typeof ActiveContextRecordSchema>;

export const ActiveContextManifestSchema = Type.Object({
  included_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  omitted_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  missing_required_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  unsafe_required_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  dependency_edges: Type.Array(Type.Object({
    from: Type.String({ minLength: 1 }),
    to: Type.String({ minLength: 1 }),
  }, { additionalProperties: false })),
  estimated_evidence_tokens: Type.Integer({ minimum: 0 }),
  maximum_evidence_tokens: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type ActiveContextManifest = Static<typeof ActiveContextManifestSchema>;

export const ActiveContextCapsuleSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  job_type: ModelJobTypeSchema,
  model_execution_profile: ModelExecutionProfileIdSchema,
  scene_contract: SceneContractSchema,
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  opening_rules: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  records: Type.Array(ActiveContextRecordSchema),
  previous_tail: Type.Union([Type.String(), Type.Null()]),
  style_card: Type.Union([Type.String(), Type.Null()]),
  closing_task: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  manifest: ActiveContextManifestSchema,
}, { additionalProperties: false });
export type ActiveContextCapsule = Static<typeof ActiveContextCapsuleSchema>;

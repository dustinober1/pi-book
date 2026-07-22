import { Type, type Static } from "@sinclair/typebox";
import { SceneStateDeltaMutationSchema } from "./scene-state-delta-artifact.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const SceneIdSchema = Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" });

export const SceneAcceptanceArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: SceneIdSchema,
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  draft_capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  validation_artifact_hash: HashSchema,
  critic_summary_artifact_hash: HashSchema,
  state_delta_artifact_hash: HashSchema,
  state_delta_extraction_attempt: Type.Integer({ minimum: 1 }),
  accepted_prose: Type.String({ minLength: 1 }),
  word_count: Type.Integer({ minimum: 1 }),
  accepted_mutations: Type.Array(SceneStateDeltaMutationSchema, { maxItems: 12 }),
  next_node: Type.Union([Type.Literal("context-build"), Type.Literal("chapter-stitch")]),
  next_scene_id: Type.Union([SceneIdSchema, Type.Null()]),
  accepted_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type SceneAcceptanceArtifact = Static<typeof SceneAcceptanceArtifactSchema>;

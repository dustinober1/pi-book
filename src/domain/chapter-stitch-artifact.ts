import { Type, type Static } from "@sinclair/typebox";
import { SceneStateDeltaMutationSchema } from "./scene-state-delta-artifact.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const SceneIdSchema = Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" });

export const ChapterStitchSceneSchema = Type.Object({
  scene_id: SceneIdSchema,
  contract_hash: Type.Optional(HashSchema),
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  acceptance_artifact_hash: HashSchema,
  word_count: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type ChapterStitchScene = Static<typeof ChapterStitchSceneSchema>;

export const ChapterStitchArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  scene_ids: Type.Array(SceneIdSchema, { minItems: 1, maxItems: 5, uniqueItems: true }),
  scenes: Type.Array(ChapterStitchSceneSchema, { minItems: 1, maxItems: 5 }),
  chapter_text: Type.String({ minLength: 1 }),
  word_count: Type.Integer({ minimum: 1 }),
  output_hash: HashSchema,
  accepted_mutations: Type.Array(SceneStateDeltaMutationSchema, { maxItems: 60 }),
  next_node: Type.Literal("chapter-validate"),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ChapterStitchArtifact = Static<typeof ChapterStitchArtifactSchema>;

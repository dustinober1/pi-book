import { Type, type Static } from "@sinclair/typebox";
import { ModelExecutionProfileIdSchema } from "./model-execution-profile.js";
import { RuntimeProfileIdSchema } from "./runtime-profile.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const RunIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" });
const SceneIdSchema = Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" });

export const ChapterExecutionManifestSceneSchema = Type.Object({
  scene_id: SceneIdSchema,
  sequence: Type.Integer({ minimum: 1, maximum: 5 }),
  contract_hash: HashSchema,
}, { additionalProperties: false });
export type ChapterExecutionManifestScene = Static<typeof ChapterExecutionManifestSceneSchema>;

export const ChapterExecutionManifestSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: RunIdSchema,
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  chapter: Type.Integer({ minimum: 1 }),
  chapter_contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  chapter_contract_version: Type.Integer({ minimum: 1 }),
  chapter_contract_hash: HashSchema,
  project_hash: HashSchema,
  story_index_hash: HashSchema,
  runtime_profile: RuntimeProfileIdSchema,
  model_execution_profile: ModelExecutionProfileIdSchema,
  scenes: Type.Array(ChapterExecutionManifestSceneSchema, { minItems: 1, maxItems: 5 }),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type ChapterExecutionManifest = Static<typeof ChapterExecutionManifestSchema>;

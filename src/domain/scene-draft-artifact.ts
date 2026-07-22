import { Type, type Static } from "@sinclair/typebox";
import { ModelExecutionProfileIdSchema } from "./model-execution-profile.js";
import { ModelCallReportSchema } from "./run-report.js";
import { RuntimeProfileIdSchema } from "./runtime-profile.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const SceneDraftArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  chapter_contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  chapter_contract_version: Type.Integer({ minimum: 1 }),
  job_type: Type.Literal("draft-scene"),
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  model_execution_profile: ModelExecutionProfileIdSchema,
  runtime_profile: RuntimeProfileIdSchema,
  attempt: Type.Integer({ minimum: 1 }),
  prose: Type.String({ minLength: 1 }),
  word_count: Type.Integer({ minimum: 1 }),
  output_hash: HashSchema,
  usage: ModelCallReportSchema,
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type SceneDraftArtifact = Static<typeof SceneDraftArtifactSchema>;

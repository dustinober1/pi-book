import { Type, type Static } from "@sinclair/typebox";
import { SceneStateDeltaMutationSchema } from "./scene-state-delta-artifact.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ChapterCommitArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  status: Type.Union([Type.Literal("prepared"), Type.Literal("committed")]),
  project_hash_before: HashSchema,
  project_hash_after: Type.Union([HashSchema, Type.Null()]),
  story_index_hash_before: HashSchema,
  story_index_hash_after: Type.Union([HashSchema, Type.Null()]),
  contract_hash: HashSchema,
  stitch_artifact_hash: HashSchema,
  validation_artifact_hash: HashSchema,
  stitch_output_hash: HashSchema,
  manuscript_path: Type.String({ pattern: "^books/book-[0-9]{2}/manuscript/chapters/[^/]+\\.md$" }),
  manuscript_hash: HashSchema,
  state_ledger_path: Type.Union([Type.Literal("series/state-ledger.yaml"), Type.Null()]),
  state_ledger_hash: Type.Union([HashSchema, Type.Null()]),
  applied_mutations: Type.Array(SceneStateDeltaMutationSchema, { maxItems: 60 }),
  changed_paths: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  git_message: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  prepared_at: Type.String({ minLength: 1 }),
  committed_at: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
}, { additionalProperties: false });

export type ChapterCommitArtifact = Static<typeof ChapterCommitArtifactSchema>;

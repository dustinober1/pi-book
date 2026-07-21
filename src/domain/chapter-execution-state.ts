import { Type, type Static } from "@sinclair/typebox";

export const EXECUTION_NODES = [
  "contract-compile", "scene-contract-compile", "context-build", "scene-plan", "scene-draft",
  "deterministic-validation", "critic-review", "span-repair", "state-delta", "scene-accept",
  "chapter-stitch", "chapter-validate", "chapter-commit", "complete",
] as const;
export const ExecutionNodeSchema = Type.Union(EXECUTION_NODES.map((value) => Type.Literal(value)));
export type ExecutionNode = Static<typeof ExecutionNodeSchema>;

export const ExecutionStatusSchema = Type.Union([
  Type.Literal("active"), Type.Literal("paused"), Type.Literal("blocked"), Type.Literal("failed"), Type.Literal("completed"),
]);
export type ExecutionStatus = Static<typeof ExecutionStatusSchema>;

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const ChapterExecutionStateSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ minLength: 1 }),
  project_hash: HashSchema,
  canon_snapshot_hash: HashSchema,
  contract_hash: HashSchema,
  chapter: Type.Integer({ minimum: 1 }),
  current_scene_id: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  current_node: ExecutionNodeSchema,
  status: ExecutionStatusSchema,
  completed_nodes: Type.Array(ExecutionNodeSchema),
  attempt: Type.Integer({ minimum: 0 }),
  escalation_code: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  updated_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ChapterExecutionState = Static<typeof ChapterExecutionStateSchema>;

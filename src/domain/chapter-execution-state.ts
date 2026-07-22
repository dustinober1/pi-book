import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const RunIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" });

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

export const ExecutionBlockerCodeSchema = Type.Union([
  Type.Literal("missing-canon"), Type.Literal("unknown-state-record"), Type.Literal("conflicting-locks"),
  Type.Literal("needs-editorial-decision"), Type.Literal("needs-research"), Type.Literal("contract-impossible"),
  Type.Literal("schema-failure"), Type.Literal("repair-limit"),
]);
export type ExecutionBlockerCode = Static<typeof ExecutionBlockerCodeSchema>;

export const ChapterExecutionStateSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: RunIdSchema,
  project_hash: HashSchema,
  canon_snapshot_hash: HashSchema,
  contract_hash: HashSchema,
  chapter_contract_hash: Type.Optional(HashSchema),
  chapter: Type.Integer({ minimum: 1 }),
  current_scene_id: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  current_node: ExecutionNodeSchema,
  status: ExecutionStatusSchema,
  completed_nodes: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  attempts: Type.Record(Type.String({ minLength: 1 }), Type.Integer({ minimum: 0 })),
  accepted_scene_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  blocker: Type.Optional(Type.Object({
    code: ExecutionBlockerCodeSchema,
    message: Type.String({ minLength: 1 }),
    record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  }, { additionalProperties: false })),
  updated_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type ChapterExecutionState = Static<typeof ChapterExecutionStateSchema>;

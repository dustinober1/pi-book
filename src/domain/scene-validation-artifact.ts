import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const SceneValidationFindingCodeSchema = Type.Union([
  Type.Literal("word-count-low"),
  Type.Literal("word-count-high"),
  Type.Literal("markdown-fence"),
  Type.Literal("prose-heading"),
  Type.Literal("meta-commentary"),
  Type.Literal("scene-boundary"),
]);
export type SceneValidationFindingCode = Static<typeof SceneValidationFindingCodeSchema>;

export const SceneValidationFindingSchema = Type.Object({
  code: SceneValidationFindingCodeSchema,
  severity: Type.Union([Type.Literal("blocker"), Type.Literal("warning")]),
  message: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type SceneValidationFinding = Static<typeof SceneValidationFindingSchema>;

export const SceneValidationArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  findings: Type.Array(SceneValidationFindingSchema),
  blocker_count: Type.Integer({ minimum: 0 }),
  warning_count: Type.Integer({ minimum: 0 }),
  passed: Type.Boolean(),
  next_node: Type.Union([Type.Literal("critic-review"), Type.Literal("span-repair")]),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type SceneValidationArtifact = Static<typeof SceneValidationArtifactSchema>;

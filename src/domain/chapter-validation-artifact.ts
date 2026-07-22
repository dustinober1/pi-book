import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const SceneIdSchema = Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" });

export const ChapterValidationFindingCodeSchema = Type.Union([
  Type.Literal("markdown-fence"),
  Type.Literal("prose-heading"),
  Type.Literal("meta-commentary"),
  Type.Literal("scene-boundary"),
  Type.Literal("mutation-evidence-missing"),
  Type.Literal("boundary-whitespace"),
]);
export type ChapterValidationFindingCode = Static<typeof ChapterValidationFindingCodeSchema>;

export const ChapterValidationFindingSchema = Type.Object({
  code: ChapterValidationFindingCodeSchema,
  severity: Type.Union([Type.Literal("blocker"), Type.Literal("warning")]),
  message: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
export type ChapterValidationFinding = Static<typeof ChapterValidationFindingSchema>;

export const ChapterValidationArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  stitch_artifact_hash: HashSchema,
  stitch_output_hash: HashSchema,
  contract_hash: HashSchema,
  story_index_hash: HashSchema,
  scene_ids: Type.Array(SceneIdSchema, { minItems: 1, maxItems: 5, uniqueItems: true }),
  findings: Type.Array(ChapterValidationFindingSchema, { maxItems: 24 }),
  blocker_count: Type.Integer({ minimum: 0 }),
  warning_count: Type.Integer({ minimum: 0 }),
  passed: Type.Boolean(),
  next_action: Type.Union([Type.Literal("chapter-commit"), Type.Literal("blocked")]),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export type ChapterValidationArtifact = Static<typeof ChapterValidationArtifactSchema>;

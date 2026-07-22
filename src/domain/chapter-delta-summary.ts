import { Type, type Static } from "@sinclair/typebox";
import { EntityCategorySchema } from "./entity-registry.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const EvidenceAnchorIdSchema = Type.String({ pattern: "^CH-[0-9]{3}-EV-[0-9]{3}$" });
const StateOperationSchema = Type.Union([
  Type.Literal("set"),
  Type.Literal("add"),
  Type.Literal("remove"),
]);

export const ManuscriptEvidenceAnchorSchema = Type.Object({
  id: EvidenceAnchorIdSchema,
  paragraph: Type.Integer({ minimum: 1 }),
  paragraph_hash: HashSchema,
  quote: Type.String({ minLength: 1, maxLength: 240 }),
}, { additionalProperties: false });
export type ManuscriptEvidenceAnchor = Static<typeof ManuscriptEvidenceAnchorSchema>;

export const ChapterMaterialStateChangeSchema = Type.Object({
  record_id: Type.String({ minLength: 1 }),
  subject_id: Type.String({ minLength: 1 }),
  subject_category: EntityCategorySchema,
  field: Type.String({ minLength: 1 }),
  operations: Type.Array(StateOperationSchema, { minItems: 1 }),
  before: Type.Unknown(),
  after: Type.Unknown(),
  evidence_anchor_ids: Type.Array(EvidenceAnchorIdSchema, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });
export type ChapterMaterialStateChange = Static<typeof ChapterMaterialStateChangeSchema>;

export const ChapterDeltaReferenceSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  evidence_anchor_ids: Type.Array(EvidenceAnchorIdSchema, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });
export type ChapterDeltaReference = Static<typeof ChapterDeltaReferenceSchema>;

export const ChapterThreadDeltaSchema = Type.Object({
  opened: Type.Array(ChapterDeltaReferenceSchema),
  advanced: Type.Array(ChapterDeltaReferenceSchema),
  resolved: Type.Array(ChapterDeltaReferenceSchema),
}, { additionalProperties: false });
export type ChapterThreadDelta = Static<typeof ChapterThreadDeltaSchema>;

export const ChapterDeltaSummarySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  chapter: Type.Integer({ minimum: 1 }),
  chapter_ref: Type.String({ pattern: "^book-[0-9]{2}/chapter-[0-9]{3}$" }),
  source_run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  contract_hash: HashSchema,
  manuscript_path: Type.String({ pattern: "^books/book-[0-9]{2}/manuscript/chapters/[^/]+\\.md$" }),
  manuscript_hash: HashSchema,
  world_state_changes: Type.Array(ChapterMaterialStateChangeSchema),
  character_state_changes: Type.Array(ChapterMaterialStateChangeSchema),
  knowledge_changes: Type.Array(ChapterMaterialStateChangeSchema),
  relationship_changes: Type.Array(ChapterMaterialStateChangeSchema),
  object_transfers_or_destruction: Type.Array(ChapterMaterialStateChangeSchema),
  timeline_movement: Type.Array(ChapterMaterialStateChangeSchema),
  threads: ChapterThreadDeltaSchema,
  promises_to_reader: Type.Array(ChapterDeltaReferenceSchema),
  research_claims_introduced: Type.Array(ChapterDeltaReferenceSchema),
  unresolved_ambiguities: Type.Array(ChapterDeltaReferenceSchema),
  manuscript_evidence_anchors: Type.Array(ManuscriptEvidenceAnchorSchema),
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ChapterDeltaSummary = Static<typeof ChapterDeltaSummarySchema>;

export function chapterDeltaSummaryPath(bookId: string, chapter: number): string {
  return `books/${bookId}/deltas/CH-${String(chapter).padStart(3, "0")}.yaml`;
}

import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const RequestIdSchema = Type.String({ pattern: "^PC-[0-9]{3}$" });
const BookIdSchema = Type.String({ pattern: "^book-[0-9]{2}$" });

export const PlanChangeScopeSchema = Type.Union([
  Type.Literal("local"),
  Type.Literal("act"),
  Type.Literal("book"),
]);
export type PlanChangeScope = Static<typeof PlanChangeScopeSchema>;

export const PlanChangeManuscriptEvidenceSchema = Type.Object({
  chapter: Type.Integer({ minimum: 1 }),
  manuscript_path: Type.String({ minLength: 1 }),
  manuscript_hash: HashSchema,
  quote: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
export type PlanChangeManuscriptEvidence = Static<typeof PlanChangeManuscriptEvidenceSchema>;

export const PlanChangeProposedFileSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  content: Type.String(),
  content_hash: HashSchema,
}, { additionalProperties: false });
export type PlanChangeProposedFile = Static<typeof PlanChangeProposedFileSchema>;

export const PlanChangeControlFileHashSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  hash: HashSchema,
}, { additionalProperties: false });
export type PlanChangeControlFileHash = Static<typeof PlanChangeControlFileHashSchema>;

export const WriterApprovalEvidenceSchema = Type.Object({
  approved_by: Type.Literal("writer"),
  approved_at: Type.String({ minLength: 1 }),
  evidence_hash: HashSchema,
  note: Type.String(),
}, { additionalProperties: false });
export type WriterApprovalEvidence = Static<typeof WriterApprovalEvidenceSchema>;

export const PlanChangeRequestStatusSchema = Type.Union([
  Type.Literal("proposed"),
  Type.Literal("rejected"),
  Type.Literal("applied"),
]);
export type PlanChangeRequestStatus = Static<typeof PlanChangeRequestStatusSchema>;

export const PlanChangeRequestSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  request_id: RequestIdSchema,
  book_id: BookIdSchema,
  status: PlanChangeRequestStatusSchema,
  scope: PlanChangeScopeSchema,
  proposed_change: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
  manuscript_evidence: Type.Array(PlanChangeManuscriptEvidenceSchema, { minItems: 1, maxItems: 20 }),
  affected_chapters: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
  affected_contract_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_arc_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_payoff_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  control_files_to_update: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
  proposed_files: Type.Array(PlanChangeProposedFileSchema, { minItems: 1, maxItems: 50 }),
  source_project_hash: HashSchema,
  request_hash: HashSchema,
  writer_approval: Type.Union([WriterApprovalEvidenceSchema, Type.Null()]),
  rejection_reason: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  created_at: Type.String({ minLength: 1 }),
  updated_at: Type.String({ minLength: 1 }),
  applied_at: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
}, { additionalProperties: false });
export type PlanChangeRequest = Static<typeof PlanChangeRequestSchema>;

export const ApprovedPlanChangeRecordSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  request_id: RequestIdSchema,
  book_id: BookIdSchema,
  status: Type.Literal("approved"),
  scope: PlanChangeScopeSchema,
  proposed_change: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
  manuscript_evidence: Type.Array(PlanChangeManuscriptEvidenceSchema, { minItems: 1, maxItems: 20 }),
  affected_chapters: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
  affected_contract_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_arc_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  affected_payoff_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  control_file_hashes: Type.Array(PlanChangeControlFileHashSchema, { minItems: 1, maxItems: 50 }),
  source_request_hash: HashSchema,
  source_project_hash: HashSchema,
  writer_approval: WriterApprovalEvidenceSchema,
  applied_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ApprovedPlanChangeRecord = Static<typeof ApprovedPlanChangeRecordSchema>;

export function approvedPlanChangeRecordPath(bookId: string, requestId: string): string {
  return `books/${bookId}/plan-changes/${requestId}.yaml`;
}

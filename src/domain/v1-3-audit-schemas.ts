import { Type, type Static } from "@sinclair/typebox";
import { RevisionTicketSchema } from "./schemas.js";
import { BookStrategyPhase4Schema } from "./v1-3-architecture-schemas.js";

const StringListSchema = Type.Array(Type.String());
const NullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const EvidenceStatusSchema = Type.Union([Type.Literal("draft"), Type.Literal("approved"), Type.Literal("rejected")]);
const RateSchema = Type.Number({ minimum: 0, maximum: 1 });

export const VoiceMetricVectorSchema = Type.Object({
  sample_words: Type.Integer({ minimum: 0 }),
  sentence_count: Type.Integer({ minimum: 0 }),
  paragraph_count: Type.Integer({ minimum: 0 }),
  sentence_mean: Type.Number({ minimum: 0 }),
  sentence_median: Type.Number({ minimum: 0 }),
  sentence_p90: Type.Number({ minimum: 0 }),
  paragraph_mean: Type.Number({ minimum: 0 }),
  paragraph_median: Type.Number({ minimum: 0 }),
  dialogue_ratio: RateSchema,
  fragment_ratio: RateSchema,
  rhetorical_question_rate: RateSchema,
  filter_word_rate: RateSchema,
  body_language_repetition_rate: RateSchema,
  interiority_density: RateSchema,
}, { additionalProperties: false });

export const VoiceAuditMilestoneSchema = Type.Union([
  Type.Literal("chapter-1"),
  Type.Literal("chapter-3"),
  Type.Literal("act-boundary"),
  Type.Literal("manuscript-review"),
  Type.Literal("recalibration"),
]);

export const VoiceProtectedExceptionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  signal: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
  status: EvidenceStatusSchema,
}, { additionalProperties: false });

export const VoiceAuditPhase5ItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  scope: Type.String({ minLength: 1 }),
  baseline_hash: HashSchema,
  run_at: Type.String({ minLength: 1 }),
  signals: Type.Record(Type.String(), Type.Number()),
  findings: StringListSchema,
  verdict: Type.Union([Type.Literal("stable"), Type.Literal("drift-review"), Type.Literal("accepted-variation")]),
  status: EvidenceStatusSchema,
  milestone: Type.Optional(VoiceAuditMilestoneSchema),
  milestone_ref: Type.Optional(Type.String({ minLength: 1 })),
  chapter_refs: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  pov: Type.Optional(NullableStringSchema),
  baseline_scope: Type.Optional(Type.Union([Type.Literal("project"), Type.Literal("pov")])),
  baseline_metrics: Type.Optional(VoiceMetricVectorSchema),
  observed_metrics: Type.Optional(VoiceMetricVectorSchema),
  deltas: Type.Optional(Type.Record(Type.String(), Type.Number())),
  interpretation: Type.Optional(Type.Literal("evidence-only")),
  protected_exceptions: Type.Optional(Type.Array(VoiceProtectedExceptionSchema)),
}, { additionalProperties: false });

export const VoiceAuditsPhase5Schema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  audits: Type.Array(VoiceAuditPhase5ItemSchema),
}, { additionalProperties: false });

export const RevisionRecurrenceSchema = Type.Object({
  pattern_key: Type.String({ minLength: 1 }),
  occurrence_chapters: Type.Array(Type.Integer({ minimum: 1 })),
  milestone_review_ids: StringListSchema,
  promotion_status: Type.Union([
    Type.Literal("not-eligible"),
    Type.Literal("candidate"),
    Type.Literal("approved"),
    Type.Literal("rejected"),
  ]),
  candidate_guardrail: NullableStringSchema,
}, { additionalProperties: false });

export const RevisionTicketPhase5Schema = Type.Object({
  ...RevisionTicketSchema.properties,
  recurrence: Type.Optional(RevisionRecurrenceSchema),
}, { additionalProperties: false });

export const RevisionTicketsPhase5Schema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  tickets: Type.Array(RevisionTicketPhase5Schema),
}, { additionalProperties: false });

export const LearnedGuardrailSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  rule: Type.String(),
  source_cluster_ids: StringListSchema,
  status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
  source_ticket_ids: Type.Optional(StringListSchema),
  source_milestone_ids: Type.Optional(StringListSchema),
  approved_at: Type.Optional(NullableStringSchema),
}, { additionalProperties: false });

export const BookStrategyPhase5Schema = Type.Object({
  ...BookStrategyPhase4Schema.properties,
  review_derived_guardrails: Type.Array(LearnedGuardrailSchema),
}, { additionalProperties: false });

export type VoiceMetricVector = Static<typeof VoiceMetricVectorSchema>;
export type VoiceAuditMilestone = Static<typeof VoiceAuditMilestoneSchema>;
export type VoiceProtectedException = Static<typeof VoiceProtectedExceptionSchema>;
export type VoiceAuditPhase5Item = Static<typeof VoiceAuditPhase5ItemSchema>;
export type VoiceAuditsPhase5 = Static<typeof VoiceAuditsPhase5Schema>;
export type RevisionRecurrence = Static<typeof RevisionRecurrenceSchema>;
export type RevisionTicketPhase5 = Static<typeof RevisionTicketPhase5Schema>;
export type RevisionTicketsPhase5 = Static<typeof RevisionTicketsPhase5Schema>;
export type LearnedGuardrail = Static<typeof LearnedGuardrailSchema>;
export type BookStrategyPhase5 = Static<typeof BookStrategyPhase5Schema>;

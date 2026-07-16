import { Type, type Static } from "@sinclair/typebox";
import { RevisionTicketSchema } from "./schemas.js";
import { BookStrategyPhase4Schema } from "./v1-3-architecture-schemas.js";

const StringListSchema = Type.Array(Type.String());
const NumberRecordSchema = Type.Record(Type.String(), Type.Number());
const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const TicketRecurrenceSchema = Type.Object({
  pattern_id: Type.String({ minLength: 1 }),
  milestone_review: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
}, { additionalProperties: false });

export const RevisionTicketPhase5Schema = Type.Object({
  ...RevisionTicketSchema.properties,
  recurrence: Type.Optional(TicketRecurrenceSchema),
}, { additionalProperties: false });

export const RevisionTicketsPhase5Schema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  tickets: Type.Array(RevisionTicketPhase5Schema),
}, { additionalProperties: false });

export const VoiceAuditRecordPhase5Schema = Type.Object({
  id: Type.String({ minLength: 1 }),
  scope: Type.String({ minLength: 1 }),
  baseline_hash: HashSchema,
  run_at: Type.String({ minLength: 1 }),
  signals: NumberRecordSchema,
  findings: StringListSchema,
  verdict: Type.Union([
    Type.Literal("stable"),
    Type.Literal("drift-review"),
    Type.Literal("accepted-variation"),
  ]),
  status: Type.Union([Type.Literal("draft"), Type.Literal("approved"), Type.Literal("rejected")]),
  pov: Type.Optional(Type.String()),
  chapters: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  baseline_metrics: Type.Optional(NumberRecordSchema),
  deltas: Type.Optional(NumberRecordSchema),
  protected_exceptions: Type.Optional(StringListSchema),
  assessment: Type.Optional(Type.Union([Type.Literal("evidence-only"), Type.Literal("writer-reviewed")])),
}, { additionalProperties: false });

export const VoiceAuditsPhase5Schema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  audits: Type.Array(VoiceAuditRecordPhase5Schema),
}, { additionalProperties: false });

export const RevisionLearningGuardrailSchema = Type.Object({
  id: Type.String({ pattern: "^LRN-[0-9]{3}$" }),
  pattern_id: Type.String({ minLength: 1 }),
  rule: Type.String({ minLength: 1 }),
  source_ticket_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  distinct_chapters: Type.Array(Type.Integer({ minimum: 1 })),
  milestone_reviews: Type.Array(Type.String({ minLength: 1 })),
  status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
}, { additionalProperties: false });

export const BookStrategyPhase5Schema = Type.Object({
  ...BookStrategyPhase4Schema.properties,
  revision_learning_guardrails: Type.Optional(Type.Array(RevisionLearningGuardrailSchema)),
}, { additionalProperties: false });

export type TicketRecurrence = Static<typeof TicketRecurrenceSchema>;
export type RevisionTicketPhase5 = Static<typeof RevisionTicketPhase5Schema>;
export type RevisionTicketsPhase5 = Static<typeof RevisionTicketsPhase5Schema>;
export type VoiceAuditRecordPhase5 = Static<typeof VoiceAuditRecordPhase5Schema>;
export type VoiceAuditsPhase5 = Static<typeof VoiceAuditsPhase5Schema>;
export type RevisionLearningGuardrail = Static<typeof RevisionLearningGuardrailSchema>;
export type BookStrategyPhase5 = Static<typeof BookStrategyPhase5Schema>;

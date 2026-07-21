import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

export const StateRecordSchema = Type.Object({
  id: Type.String({ pattern: "^STATE-[A-Z0-9][A-Z0-9._-]*$" }),
  subject_id: Type.String({ minLength: 1 }),
  field: Type.String({ minLength: 1 }),
  value: Type.Unknown(),
  status: StoryRecordStatusSchema,
  source: Type.String({ minLength: 1 }),
  introduced_in: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  updated_in: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  evidence_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type StateRecord = Static<typeof StateRecordSchema>;

export const StateLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  records: Type.Array(StateRecordSchema),
}, { additionalProperties: false });
export type StateLedger = Static<typeof StateLedgerSchema>;

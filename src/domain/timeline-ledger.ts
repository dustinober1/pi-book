import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

const Id = Type.String({ minLength: 1, maxLength: 180 });

export const TimelineRecordSchema = Type.Object({
  id: Id,
  version: Type.Integer({ minimum: 1 }),
  status: StoryRecordStatusSchema,
  sequence: Type.Integer({ minimum: 0 }),
  time_ref: Id,
  description: Type.String({ minLength: 1 }),
  location_ref: Type.Union([Id, Type.Null()]),
  participant_refs: Type.Array(Id, { uniqueItems: true }),
  source_refs: Type.Array(Id, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });
export type TimelineRecord = Static<typeof TimelineRecordSchema>;

export const TimelineLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  records: Type.Array(TimelineRecordSchema),
}, { additionalProperties: false });
export type TimelineLedger = Static<typeof TimelineLedgerSchema>;

export function defaultTimelineLedger(): TimelineLedger {
  return { schema_version: "1.0.0", records: [] };
}

import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

const Id = Type.String({ minLength: 1, maxLength: 180 });

export const ObjectCustodyRecordSchema = Type.Object({
  id: Id,
  version: Type.Integer({ minimum: 1 }),
  status: StoryRecordStatusSchema,
  object_ref: Id,
  holder_ref: Type.Union([Id, Type.Null()]),
  location_ref: Type.Union([Id, Type.Null()]),
  state: Type.String({ minLength: 1 }),
  source_refs: Type.Array(Id, { minItems: 1, uniqueItems: true }),
  introduced_in: Id,
  supersedes: Type.Union([Id, Type.Null()]),
}, { additionalProperties: false });
export type ObjectCustodyRecord = Static<typeof ObjectCustodyRecordSchema>;

export const ObjectLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  records: Type.Array(ObjectCustodyRecordSchema),
}, { additionalProperties: false });
export type ObjectLedger = Static<typeof ObjectLedgerSchema>;

export function defaultObjectLedger(): ObjectLedger {
  return { schema_version: "1.0.0", records: [] };
}

import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

const RecordIdSchema = Type.String({ minLength: 1, maxLength: 180 });

export const StoryStateRecordSchema = Type.Object({
  id: RecordIdSchema,
  version: Type.Integer({ minimum: 1 }),
  status: StoryRecordStatusSchema,
  subject_ref: RecordIdSchema,
  field: Type.String({ minLength: 1, maxLength: 120 }),
  value: Type.Unknown(),
  source_refs: Type.Array(RecordIdSchema, { minItems: 1, uniqueItems: true }),
  introduced_in: RecordIdSchema,
  supersedes: Type.Union([RecordIdSchema, Type.Null()]),
}, { additionalProperties: false });
export type StoryStateRecord = Static<typeof StoryStateRecordSchema>;

export const StoryStateSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  records: Type.Array(StoryStateRecordSchema),
}, { additionalProperties: false });
export type StoryState = Static<typeof StoryStateSchema>;

export function defaultStoryState(): StoryState {
  return { schema_version: "1.0.0", records: [] };
}

import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

const Id = Type.String({ minLength: 1, maxLength: 180 });
export const KnowledgeStateSchema = Type.Union([
  Type.Literal("knows"), Type.Literal("suspects"), Type.Literal("believes-false"), Type.Literal("does-not-know"),
]);
export const KnowledgeRecordSchema = Type.Object({
  id: Id, version: Type.Integer({ minimum: 1 }), status: StoryRecordStatusSchema,
  character_ref: Id, fact_ref: Id, state: KnowledgeStateSchema,
  source_refs: Type.Array(Id, { minItems: 1, uniqueItems: true }), introduced_in: Id,
  supersedes: Type.Union([Id, Type.Null()]),
}, { additionalProperties: false });
export type KnowledgeRecord = Static<typeof KnowledgeRecordSchema>;
export const KnowledgeLedgerSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), records: Type.Array(KnowledgeRecordSchema) }, { additionalProperties: false });
export type KnowledgeLedger = Static<typeof KnowledgeLedgerSchema>;
export function defaultKnowledgeLedger(): KnowledgeLedger { return { schema_version: "1.0.0", records: [] }; }

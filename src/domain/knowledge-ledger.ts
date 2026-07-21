import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

export const KnowledgeLevelSchema = Type.Union([
  Type.Literal("known"),
  Type.Literal("believed"),
  Type.Literal("suspected"),
  Type.Literal("unknown"),
]);
export type KnowledgeLevel = Static<typeof KnowledgeLevelSchema>;

export const KnowledgeRecordSchema = Type.Object({
  id: Type.String({ pattern: "^KNOW-[A-Z0-9][A-Z0-9._-]*$" }),
  knower_id: Type.String({ minLength: 1 }),
  fact_id: Type.String({ minLength: 1 }),
  knowledge: KnowledgeLevelSchema,
  status: StoryRecordStatusSchema,
  source: Type.String({ minLength: 1 }),
  introduced_in: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  evidence_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type KnowledgeRecord = Static<typeof KnowledgeRecordSchema>;

export const KnowledgeLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  records: Type.Array(KnowledgeRecordSchema),
}, { additionalProperties: false });
export type KnowledgeLedger = Static<typeof KnowledgeLedgerSchema>;

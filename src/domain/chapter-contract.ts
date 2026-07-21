import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const WordRangeSchema = Type.Object({
  minimum: Type.Integer({ minimum: 300 }),
  maximum: Type.Integer({ minimum: 300 }),
}, { additionalProperties: false });

export const StateMutationSchema = Type.Object({
  record_id: Type.String({ minLength: 1 }),
  field: Type.String({ minLength: 1 }),
  operation: Type.Union([Type.Literal("set"), Type.Literal("add"), Type.Literal("remove")]),
  value: Type.Unknown(),
}, { additionalProperties: false });
export type StateMutation = Static<typeof StateMutationSchema>;

export const ChapterContractSchema = Type.Object({
  schema_version: Type.Literal("2.0.0"),
  contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  version: Type.Integer({ minimum: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  title: Type.String(),
  source_kind: Type.Union([Type.Literal("legacy-packet"), Type.Literal("approved-contract")]),
  source_packet_hash: HashSchema,
  pov: Type.String({ minLength: 1 }),
  purpose: Type.String({ minLength: 1 }),
  required_beats: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  active_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  required_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  start_state_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  required_end_state: Type.Array(StateMutationSchema),
  forbidden_changes: Type.Array(Type.String({ minLength: 1 })),
  knowledge_boundary_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  target_words: WordRangeSchema,
  ending_hook: Type.String({ minLength: 1 }),
  small_model_ready: Type.Boolean(),
  missing_small_model_fields: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type ChapterContract = Static<typeof ChapterContractSchema>;

export function chapterContractPath(bookId: string, chapter: number): string {
  return `books/${bookId}/contracts/chapters/CH-${String(chapter).padStart(3, "0")}.yaml`;
}

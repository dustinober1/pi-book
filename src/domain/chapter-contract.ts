import { Type, type Static } from "@sinclair/typebox";

const RecordIdSchema = Type.String({ minLength: 1, maxLength: 160 });
const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const StateExpectationOperationSchema = Type.Union([
  Type.Literal("set"),
  Type.Literal("add"),
  Type.Literal("remove"),
  Type.Literal("advance"),
  Type.Literal("resolve"),
]);
export type StateExpectationOperation = Static<typeof StateExpectationOperationSchema>;

export const StateExpectationSchema = Type.Object({
  id: RecordIdSchema,
  subject_ref: RecordIdSchema,
  field: Type.String({ minLength: 1, maxLength: 120 }),
  operation: StateExpectationOperationSchema,
  value: Type.Unknown(),
  from_value: Type.Optional(Type.Unknown()),
}, { additionalProperties: false });
export type StateExpectation = Static<typeof StateExpectationSchema>;

export const ContractAcceptanceTestCategorySchema = Type.Union([
  Type.Literal("required-beat"),
  Type.Literal("end-state"),
  Type.Literal("forbidden-change"),
  Type.Literal("knowledge-boundary"),
  Type.Literal("word-range"),
  Type.Literal("custom"),
]);

export const ContractAcceptanceTestSchema = Type.Object({
  id: RecordIdSchema,
  category: ContractAcceptanceTestCategorySchema,
  description: Type.String({ minLength: 1 }),
  record_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
}, { additionalProperties: false });
export type ContractAcceptanceTest = Static<typeof ContractAcceptanceTestSchema>;

export const ChapterContractSchema = Type.Object({
  schema_version: Type.Literal("2.0.0"),
  contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  chapter: Type.Integer({ minimum: 1, maximum: 999 }),
  title: Type.String(),
  status: Type.Union([Type.Literal("draft"), Type.Literal("approved"), Type.Literal("superseded")]),
  pov: RecordIdSchema,
  tense: Type.Union([Type.Literal("past"), Type.Literal("present")]),
  purpose: Type.String({ minLength: 1 }),
  start_state_refs: Type.Array(RecordIdSchema, { uniqueItems: true }),
  required_end_state: Type.Array(StateExpectationSchema),
  required_beat_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  forbidden_change_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  knowledge_boundary_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  allowed_invention_rules: Type.Array(Type.String({ minLength: 1 })),
  active_thread_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  required_research_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  scene_ids: Type.Array(Type.String({ pattern: "^SCN-[0-9]{3}(?:-[0-9]{2})?$" }), { uniqueItems: true }),
  style_card_ref: RecordIdSchema,
  target_words: Type.Object({
    minimum: Type.Integer({ minimum: 100 }),
    maximum: Type.Integer({ minimum: 100 }),
  }, { additionalProperties: false }),
  acceptance_tests: Type.Array(ContractAcceptanceTestSchema),
  stop_conditions: Type.Array(Type.String({ minLength: 1 })),
  source_packet_hash: HashSchema,
}, { additionalProperties: false });
export type ChapterContract = Static<typeof ChapterContractSchema>;

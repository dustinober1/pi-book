import { Type, type Static } from "@sinclair/typebox";
import { ContractAcceptanceTestSchema, StateExpectationSchema } from "./chapter-contract.js";

const RecordIdSchema = Type.String({ minLength: 1, maxLength: 160 });

export const SceneContractSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  scene_id: Type.String({ pattern: "^SCN-[0-9]{3}(?:-[0-9]{2})?$" }),
  chapter_contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  order: Type.Integer({ minimum: 1, maximum: 5 }),
  pov: RecordIdSchema,
  location_ref: Type.Union([RecordIdSchema, Type.Null()]),
  time_ref: Type.Union([RecordIdSchema, Type.Null()]),
  objective: Type.String({ minLength: 1 }),
  conflict: Type.String({ minLength: 1 }),
  turn: Type.String({ minLength: 1 }),
  start_state_refs: Type.Array(RecordIdSchema, { uniqueItems: true }),
  expected_delta: Type.Array(StateExpectationSchema),
  required_beat_ids: Type.Array(RecordIdSchema, { minItems: 1, uniqueItems: true }),
  forbidden_change_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  knowledge_boundary_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  active_thread_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  required_research_ids: Type.Array(RecordIdSchema, { uniqueItems: true }),
  allowed_invention_rules: Type.Array(Type.String({ minLength: 1 })),
  target_words: Type.Object({
    minimum: Type.Integer({ minimum: 100 }),
    maximum: Type.Integer({ minimum: 100 }),
  }, { additionalProperties: false }),
  acceptance_tests: Type.Array(ContractAcceptanceTestSchema),
  stop_conditions: Type.Array(Type.String({ minLength: 1 })),
}, { additionalProperties: false });

export type SceneContract = Static<typeof SceneContractSchema>;

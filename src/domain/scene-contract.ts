import { Type, type Static } from "@sinclair/typebox";
import { StateMutationSchema } from "./chapter-contract.js";

export const SceneContractSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  chapter_contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  chapter_contract_version: Type.Integer({ minimum: 1 }),
  sequence: Type.Integer({ minimum: 1, maximum: 5 }),
  pov: Type.String({ minLength: 1 }),
  objective: Type.String({ minLength: 1 }),
  conflict: Type.String({ minLength: 1 }),
  turn: Type.String({ minLength: 1 }),
  required_beats: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  active_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  required_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  start_state_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  expected_state_delta: Type.Array(StateMutationSchema),
  forbidden_changes: Type.Array(Type.String({ minLength: 1 })),
  knowledge_boundary_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  target_words: Type.Object({ minimum: Type.Integer({ minimum: 150 }), maximum: Type.Integer({ minimum: 150 }) }, { additionalProperties: false }),
  ending_requirement: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type SceneContract = Static<typeof SceneContractSchema>;

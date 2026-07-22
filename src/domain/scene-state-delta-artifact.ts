import { Type, type Static } from "@sinclair/typebox";
import { StateMutationSchema } from "./chapter-contract.js";
import { ModelCallReportSchema } from "./run-report.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const SceneStateDeltaMutationSchema = Type.Object({
  ...StateMutationSchema.properties,
  evidence_quote: Type.String({ minLength: 1, maxLength: 240 }),
}, { additionalProperties: false });
export type SceneStateDeltaMutation = Static<typeof SceneStateDeltaMutationSchema>;

export const SceneStateDeltaOutputSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  mutations: Type.Array(SceneStateDeltaMutationSchema, { maxItems: 12 }),
}, { additionalProperties: false });
export type SceneStateDeltaOutput = Static<typeof SceneStateDeltaOutputSchema>;

export const SceneStateDeltaMismatchCodeSchema = Type.Union([
  Type.Literal("missing-expected-mutation"),
  Type.Literal("unexpected-mutation"),
  Type.Literal("mutation-difference"),
  Type.Literal("unknown-record"),
]);
export type SceneStateDeltaMismatchCode = Static<typeof SceneStateDeltaMismatchCodeSchema>;

export const SceneStateDeltaMismatchSchema = Type.Object({
  code: SceneStateDeltaMismatchCodeSchema,
  record_id: Type.String({ minLength: 1 }),
  field: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
export type SceneStateDeltaMismatch = Static<typeof SceneStateDeltaMismatchSchema>;

export const SceneStateDeltaArtifactSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" }),
  chapter: Type.Integer({ minimum: 1 }),
  scene_id: Type.String({ pattern: "^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$" }),
  draft_attempt: Type.Integer({ minimum: 1 }),
  draft_output_hash: HashSchema,
  capsule_id: Type.String({ pattern: "^CAP-[A-F0-9]{16}$" }),
  contract_hash: HashSchema,
  extraction_attempt: Type.Integer({ minimum: 1 }),
  expected_mutations: Type.Array(StateMutationSchema, { maxItems: 12 }),
  actual_mutations: Type.Array(SceneStateDeltaMutationSchema, { maxItems: 12 }),
  mismatches: Type.Array(SceneStateDeltaMismatchSchema, { maxItems: 24 }),
  matches_expected: Type.Boolean(),
  next_action: Type.Union([Type.Literal("scene-accept"), Type.Literal("span-repair"), Type.Literal("blocked")]),
  usage: ModelCallReportSchema,
  created_at: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type SceneStateDeltaArtifact = Static<typeof SceneStateDeltaArtifactSchema>;

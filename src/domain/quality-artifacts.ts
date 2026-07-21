import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const RunIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" });
const CandidateIdSchema = Type.String({ pattern: "^CAND-[0-9]{2}$" });
const QualityLaneSchema = Type.Union([
  Type.Literal("combined"),
  Type.Literal("continuity"),
  Type.Literal("voice"),
  Type.Literal("causality"),
  Type.Literal("research"),
]);

const common = {
  schema_version: Type.Literal("1.0.0"),
  run_id: RunIdSchema,
  chapter: Type.Integer({ minimum: 1 }),
  source_hashes: Type.Array(HashSchema, { minItems: 1, uniqueItems: true }),
  creation_order: Type.Integer({ minimum: 1 }),
};

export const QualityScenePlanSchema = Type.Object({
  ...common,
  artifact_type: Type.Literal("scene-plan"),
  objective: Type.String({ minLength: 1 }),
  beats: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  protected_constraints: Type.Array(Type.String({ minLength: 1 })),
  ending_hook: Type.String({ minLength: 1 }),
  evidence_refs: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type QualityScenePlan = Static<typeof QualityScenePlanSchema>;

export const QualityDraftCandidateSchema = Type.Object({
  ...common,
  artifact_type: Type.Literal("draft-candidate"),
  candidate_id: CandidateIdSchema,
  text: Type.String({ minLength: 1 }),
  proposed_delta: Type.Object({
    canon: Type.Array(Type.Unknown()),
    relationships: Type.Array(Type.Unknown()),
    threads: Type.Array(Type.Unknown()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });
export type QualityDraftCandidate = Static<typeof QualityDraftCandidateSchema>;

export const QualityCritiqueFindingSchema = Type.Object({
  severity: Type.Union([Type.Literal("blocker"), Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
  evidence: Type.String({ minLength: 1 }),
  required_change: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export const QualityLaneCritiqueSchema = Type.Object({
  ...common,
  artifact_type: Type.Literal("lane-critique"),
  candidate_id: CandidateIdSchema,
  lane: QualityLaneSchema,
  findings: Type.Array(QualityCritiqueFindingSchema),
  verdict: Type.Union([Type.Literal("accept"), Type.Literal("revise"), Type.Literal("reject")]),
}, { additionalProperties: false });
export type QualityLaneCritique = Static<typeof QualityLaneCritiqueSchema>;

export const QualityCandidateSelectionSchema = Type.Object({
  ...common,
  artifact_type: Type.Literal("candidate-selection"),
  candidate_ids: Type.Array(CandidateIdSchema, { minItems: 2, uniqueItems: true }),
  selected_candidate_id: CandidateIdSchema,
  rationale: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
}, { additionalProperties: false });
export type QualityCandidateSelection = Static<typeof QualityCandidateSelectionSchema>;

export const QualitySynthesisSchema = Type.Object({
  ...common,
  artifact_type: Type.Literal("synthesis"),
  selected_candidate_id: CandidateIdSchema,
  applied_critique_lanes: Type.Array(QualityLaneSchema, { uniqueItems: true }),
  final_output_hash: HashSchema,
  summary: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type QualitySynthesis = Static<typeof QualitySynthesisSchema>;

export type QualityArtifact =
  | QualityScenePlan
  | QualityDraftCandidate
  | QualityLaneCritique
  | QualityCandidateSelection
  | QualitySynthesis;

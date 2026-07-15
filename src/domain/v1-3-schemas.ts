import { Type, type Static } from "@sinclair/typebox";

const StringListSchema = Type.Array(Type.String());
const NullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const NullableHashSchema = Type.Union([HashSchema, Type.Null()]);
const EvidenceStatusSchema = Type.Union([Type.Literal("draft"), Type.Literal("approved"), Type.Literal("rejected")]);

export const VOICE_PRECEDENCE_VALUES = [
  "explicit-writer-decisions",
  "writer-samples",
  "accepted-voice-baseline",
  "approved-voice-profile",
  "influence-references",
  "genre-defaults",
] as const;

const VoicePrecedenceSchema = Type.Tuple([
  Type.Literal("explicit-writer-decisions"),
  Type.Literal("writer-samples"),
  Type.Literal("accepted-voice-baseline"),
  Type.Literal("approved-voice-profile"),
  Type.Literal("influence-references"),
  Type.Literal("genre-defaults"),
]);

const InfluenceTypeSchema = Type.Union([
  Type.Literal("voice"),
  Type.Literal("reader-experience"),
  Type.Literal("structure"),
  Type.Literal("characterization"),
  Type.Literal("atmosphere"),
  Type.Literal("market-position"),
]);

const OpeningExperimentSchema = Type.Union([
  Type.Object({ status: Type.Literal("not-started"), experiment_id: Type.Null(), baseline_path: Type.Null() }, { additionalProperties: false }),
  Type.Object({ status: Type.Literal("planned"), experiment_id: Type.String({ pattern: "^VE-[0-9]{3}$" }), baseline_path: Type.Null() }, { additionalProperties: false }),
  Type.Object({ status: Type.Literal("accepted"), experiment_id: Type.String({ pattern: "^VE-[0-9]{3}$" }), baseline_path: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
  Type.Object({ status: Type.Literal("rejected"), experiment_id: Type.String({ pattern: "^VE-[0-9]{3}$" }), baseline_path: Type.Null() }, { additionalProperties: false }),
]);

export const TasteProfileSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  precedence: VoicePrecedenceSchema,
  influences: Type.Array(Type.Object({
    id: Type.String({ pattern: "^INF-[0-9]{3}$" }),
    reference: Type.String({ minLength: 1 }),
    influence_type: InfluenceTypeSchema,
    admired_for: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    not_for: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    derived_traits: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    status: EvidenceStatusSchema,
  }, { additionalProperties: false })),
  negative_references: Type.Array(Type.Object({
    id: Type.String({ pattern: "^NEG-[0-9]{3}$" }),
    reference: Type.String({ minLength: 1 }),
    rejected_for: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    derived_avoidances: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  }, { additionalProperties: false })),
  opening_experiment: OpeningExperimentSchema,
}, { additionalProperties: false });
export type TasteProfile = Static<typeof TasteProfileSchema>;

export const VoiceGuardrailsSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  must: StringListSchema,
  prefer: StringListSchema,
  avoid: StringListSchema,
  monitor: StringListSchema,
  baseline: Type.Object({
    path: NullableStringSchema,
    content_hash: NullableHashSchema,
    metrics: Type.Record(Type.String(), Type.Number()),
  }, { additionalProperties: false }),
  pov_signatures: Type.Array(Type.Object({
    id: Type.String({ minLength: 1 }),
    pov: Type.String({ minLength: 1 }),
    must: StringListSchema,
    prefer: StringListSchema,
    avoid: StringListSchema,
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type VoiceGuardrails = Static<typeof VoiceGuardrailsSchema>;

const VoiceExperimentIndexItemSchema = Type.Union([
  Type.Object({
    id: Type.String({ pattern: "^VE-[0-9]{3}$" }),
    path: Type.String({ minLength: 1 }),
    status: Type.Literal("accepted"),
    baseline_hash: HashSchema,
  }, { additionalProperties: false }),
  Type.Object({
    id: Type.String({ pattern: "^VE-[0-9]{3}$" }),
    path: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("planned"), Type.Literal("drafting"), Type.Literal("scoring"), Type.Literal("rejected")]),
    baseline_hash: NullableHashSchema,
  }, { additionalProperties: false }),
]);

export const VoiceExperimentIndexSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  experiments: Type.Array(VoiceExperimentIndexItemSchema),
}, { additionalProperties: false });
export type VoiceExperimentIndex = Static<typeof VoiceExperimentIndexSchema>;

const VariantIdSchema = Type.Union([Type.Literal("A"), Type.Literal("B"), Type.Literal("C")]);
const VoiceVariantSchema = Type.Object({
  id: VariantIdSchema,
  path: Type.String({ minLength: 1 }),
  content_hash: HashSchema,
}, { additionalProperties: false });
const VoiceVariantFor = (id: "A" | "B" | "C") => Type.Object({
  id: Type.Literal(id),
  path: Type.String({ minLength: 1 }),
  content_hash: HashSchema,
}, { additionalProperties: false });
const CompleteVoiceVariantsSchema = Type.Tuple([VoiceVariantFor("A"), VoiceVariantFor("B"), VoiceVariantFor("C")]);
const VoiceScoreSchema = Type.Object({
  evaluator_id: Type.String({ minLength: 1 }),
  variant_id: VariantIdSchema,
  feels_like_book: Type.Integer({ minimum: 1, maximum: 5 }),
  desire_to_continue: Type.Integer({ minimum: 1, maximum: 5 }),
  character_intimacy: Type.Integer({ minimum: 1, maximum: 5 }),
  prose_naturalness: Type.Integer({ minimum: 1, maximum: 5 }),
  distinctiveness: Type.Integer({ minimum: 1, maximum: 5 }),
  density: Type.Integer({ minimum: -2, maximum: 2 }),
  note: Type.String(),
}, { additionalProperties: false });
const VoiceExperimentSharedFields = {
  schema_version: Type.Literal("1.0.0"),
  id: Type.String({ pattern: "^VE-[0-9]{3}$" }),
  source_scene_path: Type.String({ minLength: 1 }),
  source_scene_hash: HashSchema,
  scores: Type.Array(VoiceScoreSchema),
  accepted_traits: StringListSchema,
};

export const VoiceExperimentFileSchema = Type.Union([
  Type.Object({
    ...VoiceExperimentSharedFields,
    status: Type.Literal("accepted"),
    variants: CompleteVoiceVariantsSchema,
    baseline_path: Type.String({ minLength: 1 }),
    baseline_hash: HashSchema,
  }, { additionalProperties: false }),
  Type.Object({
    ...VoiceExperimentSharedFields,
    status: Type.Literal("scoring"),
    variants: CompleteVoiceVariantsSchema,
    baseline_path: Type.Null(),
    baseline_hash: Type.Null(),
  }, { additionalProperties: false }),
  Type.Object({
    ...VoiceExperimentSharedFields,
    status: Type.Union([Type.Literal("planned"), Type.Literal("drafting"), Type.Literal("rejected")]),
    variants: Type.Array(VoiceVariantSchema, { maxItems: 3 }),
    baseline_path: NullableStringSchema,
    baseline_hash: NullableHashSchema,
  }, { additionalProperties: false }),
]);
export type VoiceExperimentFile = Static<typeof VoiceExperimentFileSchema>;

const ResearchLaneSchema = Type.Union([
  Type.Literal("taste-and-voice"),
  Type.Literal("story-world"),
  Type.Literal("human-authenticity"),
  Type.Literal("reader-and-market"),
]);
const DramaticUseSchema = Type.Union([
  Type.Literal("obstacle"), Type.Literal("false-assumption"), Type.Literal("hidden-capability"),
  Type.Literal("deadline"), Type.Literal("vulnerability"), Type.Literal("forensic-clue"),
  Type.Literal("procedural-constraint"), Type.Literal("credibility-detail"), Type.Literal("relationship-pressure"),
  Type.Literal("moral-choice"),
]);
const ResearchSharedFields = {
  id: Type.String({ pattern: "^RES-[0-9]{3}$" }),
  lane: ResearchLaneSchema,
  fictionalization: Type.Object({
    status: Type.Union([Type.Literal("unchanged"), Type.Literal("simplified"), Type.Literal("composite"), Type.Literal("invented")]),
    reason: Type.String(),
  }, { additionalProperties: false }),
  knowledge_scope: Type.Object({
    known_by: StringListSchema,
    incorrectly_believed_by: StringListSchema,
    unknown_to: StringListSchema,
  }, { additionalProperties: false }),
  story_use: Type.Object({
    chapters: Type.Array(Type.Integer({ minimum: 1 })),
    decision_affected: Type.String(),
  }, { additionalProperties: false }),
  notes: Type.String(),
};
const DraftResearchItemSchema = Type.Object({
  ...ResearchSharedFields,
  claim: Type.String(),
  source_ids: StringListSchema,
  confidence: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  verified_on: NullableStringSchema,
  risk: StringListSchema,
  dramatic_uses: Type.Array(DramaticUseSchema),
  status: Type.Union([Type.Literal("planned"), Type.Literal("researching"), Type.Literal("deferred"), Type.Literal("rejected")]),
}, { additionalProperties: false });
const ReadyResearchItemSchema = Type.Object({
  ...ResearchSharedFields,
  claim: Type.String({ minLength: 1 }),
  source_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  confidence: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  verified_on: Type.String({ minLength: 1 }),
  risk: StringListSchema,
  dramatic_uses: Type.Array(DramaticUseSchema, { minItems: 1 }),
  status: Type.Literal("ready"),
}, { additionalProperties: false });

export const ResearchLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  items: Type.Array(Type.Union([DraftResearchItemSchema, ReadyResearchItemSchema])),
}, { additionalProperties: false });
export type ResearchLedger = Static<typeof ResearchLedgerSchema>;

const FrictionCategorySchema = Type.Union([
  Type.Literal("genre-mismatch"), Type.Literal("genre-promise-failure"), Type.Literal("execution-problem"),
  Type.Literal("character-friction"), Type.Literal("pacing-problem"), Type.Literal("style-preference"),
  Type.Literal("production-problem"), Type.Literal("content-or-ideological-objection"),
]);
export const BookStrategySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  reader_promise: Type.Object({ statement: Type.String(), required_experiences: StringListSchema }, { additionalProperties: false }),
  expectation_map: Type.Array(Type.Object({
    id: Type.String({ minLength: 1 }), expectation: Type.String(),
    decision: Type.Union([Type.Literal("satisfy"), Type.Literal("delay"), Type.Literal("invert"), Type.Literal("avoid")]),
    rationale: Type.String(), status: EvidenceStatusSchema,
  }, { additionalProperties: false })),
  reader_friction: Type.Object({
    observations: Type.Array(Type.Object({
      id: Type.String({ minLength: 1 }), title: Type.String(), source_location: Type.String(), observed_on: Type.String(),
      rating: Type.Union([Type.Number({ minimum: 1, maximum: 5 }), Type.Null()]), paraphrase: Type.String(), short_excerpt: Type.String(),
      genre_relevance: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      execution_relevance: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      category: FrictionCategorySchema,
      sentiment: Type.Union([Type.Literal("negative"), Type.Literal("mixed"), Type.Literal("positive")]),
    }, { additionalProperties: false })),
    clusters: Type.Array(Type.Object({
      id: Type.String({ minLength: 1 }), label: Type.String(), observation_ids: StringListSchema,
      titles_affected: StringListSchema,
      confidence: Type.Union([Type.Literal("weak"), Type.Literal("moderate"), Type.Literal("strong")]),
      positive_counterweights: StringListSchema,
      decision: Type.Union([Type.Literal("prevent"), Type.Literal("mitigate"), Type.Literal("accept-as-tradeoff"), Type.Literal("irrelevant-to-project"), Type.Null()]),
      guardrail: NullableStringSchema,
    }, { additionalProperties: false })),
    accepted_tradeoffs: Type.Array(Type.Object({ id: Type.String(), statement: Type.String(), mitigation: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  originality: Type.Object({
    risks: Type.Array(Type.Object({
      id: Type.String(), type: Type.String(), description: Type.String(), evidence_refs: StringListSchema,
      severity: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      status: Type.Union([Type.Literal("open"), Type.Literal("mitigated"), Type.Literal("accepted")]),
    }, { additionalProperties: false })),
    mitigations: Type.Array(Type.Object({ risk_id: Type.String(), action: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  review_derived_guardrails: Type.Array(Type.Object({
    id: Type.String(), rule: Type.String(), source_cluster_ids: StringListSchema,
    status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type BookStrategy = Static<typeof BookStrategySchema>;

export const VoiceAuditsSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  audits: Type.Array(Type.Object({
    id: Type.String({ minLength: 1 }), scope: Type.String({ minLength: 1 }), baseline_hash: HashSchema,
    run_at: Type.String({ minLength: 1 }), signals: Type.Record(Type.String(), Type.Number()), findings: StringListSchema,
    verdict: Type.Union([Type.Literal("stable"), Type.Literal("drift-review"), Type.Literal("accepted-variation")]),
    status: EvidenceStatusSchema,
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type VoiceAudits = Static<typeof VoiceAuditsSchema>;

export function defaultTasteProfile(): TasteProfile {
  return {
    schema_version: "1.0.0",
    precedence: ["explicit-writer-decisions", "writer-samples", "accepted-voice-baseline", "approved-voice-profile", "influence-references", "genre-defaults"],
    influences: [], negative_references: [],
    opening_experiment: { status: "not-started", experiment_id: null, baseline_path: null },
  };
}

export function defaultVoiceGuardrails(): VoiceGuardrails {
  return { schema_version: "1.0.0", must: [], prefer: [], avoid: [], monitor: [], baseline: { path: null, content_hash: null, metrics: {} }, pov_signatures: [] };
}

export function defaultVoiceExperimentIndex(): VoiceExperimentIndex { return { schema_version: "1.0.0", experiments: [] }; }
export function defaultResearchLedger(): ResearchLedger { return { schema_version: "1.0.0", items: [] }; }
export function defaultBookStrategy(): BookStrategy {
  return {
    schema_version: "1.0.0",
    reader_promise: { statement: "", required_experiences: [] },
    expectation_map: [],
    reader_friction: { observations: [], clusters: [], accepted_tradeoffs: [] },
    originality: { risks: [], mitigations: [] },
    review_derived_guardrails: [],
  };
}
export function defaultVoiceAudits(): VoiceAudits { return { schema_version: "1.0.0", audits: [] }; }

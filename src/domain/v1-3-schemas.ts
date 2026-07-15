import { Type, type Static } from "@sinclair/typebox";

const StringListSchema = Type.Array(Type.String());
const NullableStringSchema = Type.Union([Type.String(), Type.Null()]);

export const InfluenceTypeSchema = Type.Union([
  Type.Literal("voice"),
  Type.Literal("reader-experience"),
  Type.Literal("structure"),
  Type.Literal("characterization"),
  Type.Literal("atmosphere"),
  Type.Literal("market-position"),
]);

const TastePrecedenceItemSchema = Type.Union([
  Type.Literal("explicit-writer-decisions"),
  Type.Literal("writer-samples"),
  Type.Literal("accepted-voice-baseline"),
  Type.Literal("approved-voice-profile"),
  Type.Literal("influence-references"),
  Type.Literal("genre-defaults"),
]);

const InfluenceSchema = Type.Object({
  id: Type.String({ pattern: "^INF-[0-9]{3}$" }),
  reference: Type.String({ minLength: 1 }),
  influence_type: InfluenceTypeSchema,
  admired_for: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  not_for: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  derived_traits: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
}, { additionalProperties: false });

const NegativeReferenceSchema = Type.Object({
  id: Type.String({ pattern: "^NEG-[0-9]{3}$" }),
  reference: Type.String({ minLength: 1 }),
  avoid: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  reason: Type.String(),
}, { additionalProperties: false });

const WriterSampleSchema = Type.Object({
  id: Type.String({ pattern: "^WS-[0-9]{3}$" }),
  path: Type.String({ minLength: 1 }),
  content_hash: Type.String(),
  notes: Type.String(),
  status: Type.Union([Type.Literal("candidate"), Type.Literal("accepted"), Type.Literal("rejected")]),
}, { additionalProperties: false });

export const TasteProfileSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  precedence: Type.Array(TastePrecedenceItemSchema, { minItems: 6, maxItems: 6 }),
  influences: Type.Array(InfluenceSchema),
  negative_references: Type.Array(NegativeReferenceSchema),
  writer_samples: Type.Array(WriterSampleSchema),
  opening_experiment: Type.Object({
    status: Type.Union([
      Type.Literal("not-started"),
      Type.Literal("planned"),
      Type.Literal("accepted"),
      Type.Literal("rejected"),
    ]),
    experiment_id: NullableStringSchema,
    baseline_path: NullableStringSchema,
  }, { additionalProperties: false }),
}, { additionalProperties: false });
export type TasteProfile = Static<typeof TasteProfileSchema>;

const PovSignatureSchema = Type.Object({
  pov: Type.String({ minLength: 1 }),
  attention_patterns: StringListSchema,
  vocabulary: StringListSchema,
  humor: Type.String(),
  danger_interpretation: Type.String(),
}, { additionalProperties: false });

export const VoiceGuardrailsSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  status: Type.Union([Type.Literal("draft"), Type.Literal("approved")]),
  must: StringListSchema,
  prefer: StringListSchema,
  avoid: StringListSchema,
  monitor: StringListSchema,
  baseline: Type.Object({
    path: NullableStringSchema,
    content_hash: Type.String(),
    metrics: Type.Record(Type.String(), Type.Number()),
  }, { additionalProperties: false }),
  pov_signatures: Type.Array(PovSignatureSchema),
}, { additionalProperties: false });
export type VoiceGuardrails = Static<typeof VoiceGuardrailsSchema>;

const VoiceExperimentStatusSchema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("generated"),
  Type.Literal("accepted"),
  Type.Literal("rejected"),
]);

export const VoiceExperimentIndexSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  experiments: Type.Array(Type.Object({
    id: Type.String({ pattern: "^VE-[0-9]{3}$" }),
    path: Type.String({ minLength: 1 }),
    status: VoiceExperimentStatusSchema,
    source_hash: Type.String(),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type VoiceExperimentIndex = Static<typeof VoiceExperimentIndexSchema>;

export const VoiceExperimentFileSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  id: Type.String({ pattern: "^VE-[0-9]{3}$" }),
  status: VoiceExperimentStatusSchema,
  source_scene_path: Type.String({ minLength: 1 }),
  variant_paths: Type.Array(Type.String({ minLength: 1 })),
  score_dimensions: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  accepted_variant: NullableStringSchema,
  baseline_path: NullableStringSchema,
  source_hash: Type.String(),
  created_at: Type.String(),
  updated_at: Type.String(),
}, { additionalProperties: false });
export type VoiceExperimentFile = Static<typeof VoiceExperimentFileSchema>;

export const ResearchLaneSchema = Type.Union([
  Type.Literal("taste-and-voice"),
  Type.Literal("story-world"),
  Type.Literal("human-authenticity"),
  Type.Literal("reader-and-market"),
]);

export const DramaticFunctionSchema = Type.Union([
  Type.Literal("obstacle"),
  Type.Literal("false-assumption"),
  Type.Literal("hidden-capability"),
  Type.Literal("deadline"),
  Type.Literal("vulnerability"),
  Type.Literal("forensic-clue"),
  Type.Literal("procedural-constraint"),
  Type.Literal("credibility-detail"),
  Type.Literal("relationship-pressure"),
  Type.Literal("moral-choice"),
]);

const ResearchItemSchema = Type.Object({
  id: Type.String({ pattern: "^RES-[0-9]{3}$" }),
  lane: ResearchLaneSchema,
  claim: Type.String({ minLength: 1 }),
  source_ids: StringListSchema,
  confidence: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  verified_on: NullableStringSchema,
  story_use: Type.Object({
    chapters: Type.Array(Type.Integer({ minimum: 1 })),
    dramatic_functions: Type.Array(DramaticFunctionSchema),
    decision_affected: Type.String(),
  }, { additionalProperties: false }),
  knowledge_scope: Type.Object({
    known_by: StringListSchema,
    incorrectly_believed_by: StringListSchema,
    unknown_to: StringListSchema,
  }, { additionalProperties: false }),
  fictionalization: Type.Object({
    status: Type.Union([
      Type.Literal("unchanged"),
      Type.Literal("simplified"),
      Type.Literal("composited"),
      Type.Literal("invented"),
    ]),
    reason: Type.String(),
  }, { additionalProperties: false }),
  risks: StringListSchema,
  status: Type.Union([
    Type.Literal("candidate"),
    Type.Literal("blocked"),
    Type.Literal("ready"),
    Type.Literal("stale"),
  ]),
}, { additionalProperties: false });

export const ResearchLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  items: Type.Array(ResearchItemSchema),
}, { additionalProperties: false });
export type ResearchLedger = Static<typeof ResearchLedgerSchema>;

const ExpectationDecisionSchema = Type.Union([
  Type.Literal("satisfy"),
  Type.Literal("delay"),
  Type.Literal("invert"),
  Type.Literal("avoid"),
]);

const FrictionDecisionSchema = Type.Union([
  Type.Literal("prevent"),
  Type.Literal("mitigate"),
  Type.Literal("accept-as-tradeoff"),
  Type.Literal("irrelevant-to-project"),
]);

export const BookStrategySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  reader_promise: Type.Object({
    core_experience: Type.String(),
    chapter_delivery: StringListSchema,
    nonnegotiable_delight: Type.String(),
  }, { additionalProperties: false }),
  expectation_map: Type.Array(Type.Object({
    id: Type.String({ pattern: "^EXP-[0-9]{3}$" }),
    expectation: Type.String({ minLength: 1 }),
    decision: ExpectationDecisionSchema,
    implementation: Type.String(),
    reason: Type.String(),
  }, { additionalProperties: false })),
  reader_friction: Type.Object({
    observations: StringListSchema,
    clusters: Type.Array(Type.Object({
      id: Type.String({ pattern: "^RFC-[0-9]{3}$" }),
      summary: Type.String({ minLength: 1 }),
      confidence: Type.Union([Type.Literal("weak"), Type.Literal("moderate"), Type.Literal("strong")]),
      observation_ids: StringListSchema,
      positive_counterweight: Type.String(),
      decision: FrictionDecisionSchema,
      guardrail: Type.String(),
      status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
    }, { additionalProperties: false })),
    accepted_tradeoffs: Type.Array(Type.Object({
      id: Type.String({ pattern: "^TRD-[0-9]{3}$" }),
      complaint: Type.String({ minLength: 1 }),
      reason: Type.String(),
      mitigation: Type.String(),
    }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  originality: Type.Object({
    risks: Type.Array(Type.Object({
      id: Type.String({ pattern: "^ORI-[0-9]{3}$" }),
      category: Type.Union([
        Type.Literal("premise"),
        Type.Literal("protagonist-configuration"),
        Type.Literal("signature-plot-device"),
        Type.Literal("beat-correspondence"),
        Type.Literal("distinctive-phrasing"),
        Type.Literal("recurring-imagery"),
      ]),
      reference_ids: StringListSchema,
      risk: Type.String({ minLength: 1 }),
      mitigation: Type.String(),
      status: Type.Union([Type.Literal("open"), Type.Literal("mitigated"), Type.Literal("accepted")]),
    }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  review_derived_guardrails: Type.Array(Type.Object({
    id: Type.String({ pattern: "^GRD-[0-9]{3}$" }),
    rule: Type.String({ minLength: 1 }),
    evidence_ticket_ids: StringListSchema,
    status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type BookStrategy = Static<typeof BookStrategySchema>;

export const VoiceAuditsSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  baseline_hash: Type.String(),
  audits: Type.Array(Type.Object({
    id: Type.String({ pattern: "^VA-[0-9]{3}$" }),
    scope: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("planned"), Type.Literal("completed")]),
    measured_at: NullableStringSchema,
    metrics: Type.Record(Type.String(), Type.Number()),
    findings: Type.Array(Type.Object({
      category: Type.String({ minLength: 1 }),
      severity: Type.Union([Type.Literal("advisory"), Type.Literal("high"), Type.Literal("blocker")]),
      evidence: Type.String(),
      interpretation: Type.String(),
      recommendation: Type.String(),
    }, { additionalProperties: false })),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type VoiceAudits = Static<typeof VoiceAuditsSchema>;

export function defaultTasteProfile(): TasteProfile {
  return {
    schema_version: "1.0.0",
    precedence: [
      "explicit-writer-decisions",
      "writer-samples",
      "accepted-voice-baseline",
      "approved-voice-profile",
      "influence-references",
      "genre-defaults",
    ],
    influences: [],
    negative_references: [],
    writer_samples: [],
    opening_experiment: { status: "not-started", experiment_id: null, baseline_path: null },
  };
}

export function defaultVoiceGuardrails(): VoiceGuardrails {
  return {
    schema_version: "1.0.0",
    status: "draft",
    must: [],
    prefer: [],
    avoid: [],
    monitor: [],
    baseline: { path: null, content_hash: "", metrics: {} },
    pov_signatures: [],
  };
}

export function defaultVoiceExperimentIndex(): VoiceExperimentIndex {
  return { schema_version: "1.0.0", experiments: [] };
}

export function defaultResearchLedger(): ResearchLedger {
  return { schema_version: "1.0.0", items: [] };
}

export function defaultBookStrategy(): BookStrategy {
  return {
    schema_version: "1.0.0",
    reader_promise: { core_experience: "", chapter_delivery: [], nonnegotiable_delight: "" },
    expectation_map: [],
    reader_friction: { observations: [], clusters: [], accepted_tradeoffs: [] },
    originality: { risks: [] },
    review_derived_guardrails: [],
  };
}

export function defaultVoiceAudits(): VoiceAudits {
  return { schema_version: "1.0.0", baseline_hash: "", audits: [] };
}

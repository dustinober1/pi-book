import { Type, type Static } from "@sinclair/typebox";

const StringListSchema = Type.Array(Type.String());
const NullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const AccuracyRiskSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);
export type AccuracyRisk = Static<typeof AccuracyRiskSchema>;

export const ResearchEvidenceAnchorSchema = Type.Object({
  source_id: Type.String({ minLength: 1 }),
  locator: Type.String({ minLength: 1 }),
  support_type: Type.Union([
    Type.Literal("direct"),
    Type.Literal("corroborating"),
    Type.Literal("contextual"),
  ]),
  paraphrase: Type.String({ minLength: 1, maxLength: 500 }),
  excerpt_hash: Type.Union([HashSchema, Type.Null()]),
}, { additionalProperties: false });
export type ResearchEvidenceAnchor = Static<typeof ResearchEvidenceAnchorSchema>;

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
  accuracy_risk: Type.Optional(AccuracyRiskSchema),
  evidence_anchors: Type.Optional(Type.Array(ResearchEvidenceAnchorSchema)),
};

const DraftResearchItemWithAnchorsSchema = Type.Object({
  ...ResearchSharedFields,
  claim: Type.String(),
  source_ids: StringListSchema,
  confidence: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  verified_on: NullableStringSchema,
  risk: StringListSchema,
  dramatic_uses: Type.Array(DramaticUseSchema),
  status: Type.Union([Type.Literal("planned"), Type.Literal("researching"), Type.Literal("deferred"), Type.Literal("rejected")]),
}, { additionalProperties: false });

const ReadyResearchItemWithAnchorsSchema = Type.Object({
  ...ResearchSharedFields,
  claim: Type.String({ minLength: 1 }),
  source_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  confidence: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  verified_on: Type.String({ minLength: 1 }),
  risk: StringListSchema,
  dramatic_uses: Type.Array(DramaticUseSchema, { minItems: 1 }),
  status: Type.Literal("ready"),
}, { additionalProperties: false });

export const ResearchLedgerWithAnchorsSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  items: Type.Array(Type.Union([DraftResearchItemWithAnchorsSchema, ReadyResearchItemWithAnchorsSchema])),
}, { additionalProperties: false });
export type ResearchLedgerWithAnchors = Static<typeof ResearchLedgerWithAnchorsSchema>;
export type ResearchItemWithAnchors = ResearchLedgerWithAnchors["items"][number];

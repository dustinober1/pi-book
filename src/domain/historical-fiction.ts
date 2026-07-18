import { Type, type Static } from "@sinclair/typebox";

const Id = (prefix: string) => Type.String({ pattern: `^${prefix}-[0-9]{3}$` });
const NonEmpty = Type.String({ minLength: 1 });
const StringList = Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true });
const RiskSchema = Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);

export const HistoricalSettingsSchema = Type.Object({
  story_mode: Type.Union([
    Type.Literal("literary"), Type.Literal("family-saga"), Type.Literal("romance"),
    Type.Literal("mystery"), Type.Literal("adventure"), Type.Literal("war"),
    Type.Literal("political"), Type.Literal("biographical"), Type.Literal("other"),
  ]),
  relationship_to_history: Type.Union([
    Type.Literal("fictional-characters-documented-setting"),
    Type.Literal("fictional-characters-documented-events"),
    Type.Literal("real-person-centered"),
    Type.Literal("mixed"),
  ]),
  accuracy_contract: Type.Union([
    Type.Literal("balanced"), Type.Literal("authenticity-first"), Type.Literal("story-first"),
  ]),
  prose_register: Type.Union([
    Type.Literal("period-shaped-readable"), Type.Literal("deep-immersion"),
    Type.Literal("contemporary-accessible"),
  ]),
  real_person_policy: Type.Union([
    Type.Literal("background-only"), Type.Literal("evidence-and-restraint"),
    Type.Literal("central-with-heightened-review"),
  ]),
  counterfactual_policy: Type.Union([
    Type.Literal("prohibit-major"), Type.Literal("explicit-writer-approved"),
  ]),
}, { additionalProperties: false });
export type HistoricalSettings = Static<typeof HistoricalSettingsSchema>;

const chronologyCommon = {
  id: Id("HIST"),
  sequence: Type.Integer({ minimum: 1 }),
  display_date: NonEmpty,
  event: NonEmpty,
  story_effect: NonEmpty,
};

const approximateChronology = (certainty: "approximate" | "disputed") => Type.Union([
  Type.Object({
    ...chronologyCommon,
    certainty: Type.Literal(certainty),
    source_ids: Type.Array(NonEmpty, { minItems: 1, uniqueItems: true }),
    research_ids: StringList,
    uncertainty: NonEmpty,
    invention_ref: Type.Null(),
  }, { additionalProperties: false }),
  Type.Object({
    ...chronologyCommon,
    certainty: Type.Literal(certainty),
    source_ids: StringList,
    research_ids: Type.Array(Id("RES"), { minItems: 1, uniqueItems: true }),
    uncertainty: NonEmpty,
    invention_ref: Type.Null(),
  }, { additionalProperties: false }),
]);

export const HistoricalChronologyEntrySchema = Type.Union([
  Type.Object({
    ...chronologyCommon,
    certainty: Type.Literal("documented"),
    source_ids: Type.Array(NonEmpty, { minItems: 1, uniqueItems: true }),
    research_ids: Type.Array(Id("RES"), { minItems: 1, uniqueItems: true }),
    uncertainty: Type.String(),
    invention_ref: Type.Null(),
  }, { additionalProperties: false }),
  approximateChronology("approximate"),
  approximateChronology("disputed"),
  Type.Object({
    ...chronologyCommon,
    certainty: Type.Literal("fictional"),
    source_ids: StringList,
    research_ids: Type.Array(Id("RES"), { uniqueItems: true }),
    uncertainty: Type.String(),
    invention_ref: Id("INV"),
  }, { additionalProperties: false }),
]);
export type HistoricalChronologyEntry = Static<typeof HistoricalChronologyEntrySchema>;

const HistoricalConstraintSchema = Type.Object({
  id: Id("HC"),
  category: Type.Union([
    Type.Literal("political"), Type.Literal("institutional"), Type.Literal("legal"),
    Type.Literal("social"), Type.Literal("economic"), Type.Literal("religious"),
    Type.Literal("medical"), Type.Literal("military"), Type.Literal("geographic"),
    Type.Literal("material"), Type.Literal("transport"), Type.Literal("communication"),
    Type.Literal("linguistic"), Type.Literal("other"),
  ]),
  statement: NonEmpty,
  dramatic_consequence: NonEmpty,
  source_ids: StringList,
  research_ids: Type.Array(Id("RES"), { uniqueItems: true }),
  risk: RiskSchema,
  confidence: RiskSchema,
}, { additionalProperties: false });

const KnowledgeBoundarySchema = Type.Object({
  id: Id("KB"),
  character_or_group: NonEmpty,
  as_of: Id("HIST"),
  known: StringList,
  believed: StringList,
  mistaken: StringList,
  cannot_yet_know: StringList,
  research_ids: Type.Array(Id("RES"), { uniqueItems: true }),
}, { additionalProperties: false });

const HistoricalUncertaintySchema = Type.Object({
  id: Id("HU"),
  kind: Type.Union([Type.Literal("uncertain"), Type.Literal("contested"), Type.Literal("research-gap")]),
  statement: NonEmpty,
  research_ids: Type.Array(Id("RES"), { uniqueItems: true }),
  invention_ref: Type.Union([Id("INV"), Type.Null()]),
}, { additionalProperties: false });

export const HistoricalContextSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  temporal_scope: Type.String(),
  geographic_scope: Type.String(),
  calendar: Type.String(),
  settings: HistoricalSettingsSchema,
  chronology: Type.Array(HistoricalChronologyEntrySchema),
  constraints: Type.Array(HistoricalConstraintSchema),
  knowledge_boundaries: Type.Array(KnowledgeBoundarySchema),
  language_conventions: Type.Object({
    dialogue_translation: Type.String(),
    period_flavor: Type.String(),
    prohibited_modern_idioms: StringList,
    prohibited_faux_archaism: StringList,
  }, { additionalProperties: false }),
  uncertainties: Type.Array(HistoricalUncertaintySchema),
}, { additionalProperties: false });
export type HistoricalContext = Static<typeof HistoricalContextSchema>;

const inventionCommon = {
  id: Id("INV"),
  claim: NonEmpty,
  risk: RiskSchema,
  rationale: NonEmpty,
  story_necessity: NonEmpty,
  affected_chapters: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
  portrayal_risks: StringList,
  continuity_risks: StringList,
  disclosure: Type.Union([Type.Literal("none"), Type.Literal("historical-note"), Type.Literal("prominent")]),
  writer_decision_id: Type.Union([Type.String({ pattern: "^DEC-[0-9]{3}$" }), Type.Null()]),
  major_counterfactual: Type.Boolean(),
};

const evidenceInvention = (classification: "documented" | "inferred") => Type.Object({
  ...inventionCommon,
  classification: Type.Literal(classification),
  source_ids: Type.Array(NonEmpty, { minItems: 1, uniqueItems: true }),
  research_ids: Type.Array(Id("RES"), { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });

const declaredInvention = (classification: "compressed" | "composite" | "invented" | "counterfactual") => Type.Object({
  ...inventionCommon,
  classification: Type.Literal(classification),
  source_ids: StringList,
  research_ids: Type.Array(Id("RES"), { uniqueItems: true }),
}, { additionalProperties: false });

export const InventionEntrySchema = Type.Union([
  evidenceInvention("documented"),
  evidenceInvention("inferred"),
  declaredInvention("compressed"),
  declaredInvention("composite"),
  declaredInvention("invented"),
  declaredInvention("counterfactual"),
]);
export type InventionEntry = Static<typeof InventionEntrySchema>;

export const InventionLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  entries: Type.Array(InventionEntrySchema),
}, { additionalProperties: false });
export type InventionLedger = Static<typeof InventionLedgerSchema>;

export function defaultHistoricalSettings(): HistoricalSettings {
  return {
    story_mode: "literary",
    relationship_to_history: "fictional-characters-documented-setting",
    accuracy_contract: "balanced",
    prose_register: "period-shaped-readable",
    real_person_policy: "evidence-and-restraint",
    counterfactual_policy: "prohibit-major",
  };
}

export function defaultHistoricalContext(bookId: string): HistoricalContext {
  return {
    schema_version: "1.0.0",
    book_id: bookId,
    temporal_scope: "",
    geographic_scope: "",
    calendar: "",
    settings: defaultHistoricalSettings(),
    chronology: [],
    constraints: [],
    knowledge_boundaries: [],
    language_conventions: {
      dialogue_translation: "",
      period_flavor: "",
      prohibited_modern_idioms: [],
      prohibited_faux_archaism: [],
    },
    uncertainties: [],
  };
}

export function defaultInventionLedger(bookId: string): InventionLedger {
  return { schema_version: "1.0.0", book_id: bookId, entries: [] };
}

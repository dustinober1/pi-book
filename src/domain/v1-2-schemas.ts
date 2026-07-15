import { Type, type Static } from "@sinclair/typebox";
import type { BookState, ProfileId } from "./schemas.js";

const NullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const StringListSchema = Type.Array(Type.String());

export const AssetApprovalSchema = Type.Object({
  status: Type.Union([Type.Literal("draft"), Type.Literal("approved"), Type.Literal("rejected")]),
  approved_at: NullableStringSchema,
  note: Type.String(),
}, { additionalProperties: false });
export type AssetApproval = Static<typeof AssetApprovalSchema>;

export const PublishingMetadataSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  verification_status: Type.Union([Type.Literal("unverified"), Type.Literal("verified")]),
  title: Type.String(),
  subtitle: Type.String(),
  series: Type.Object({ name: Type.String(), number: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  author: Type.Object({ name: Type.String(), pen_name: Type.String() }, { additionalProperties: false }),
  contributors: Type.Array(Type.Object({ name: Type.String(), role: Type.String() }, { additionalProperties: false })),
  language: Type.String(),
  territories: StringListSchema,
  copyright: Type.Object({ holder: Type.String(), year: Type.String(), notice: Type.String() }, { additionalProperties: false }),
  publication: Type.Object({ date: Type.String(), edition: Type.String() }, { additionalProperties: false }),
  identifiers: Type.Object({
    paperback_isbn: Type.String(),
    hardcover_isbn: Type.String(),
    epub_isbn: Type.String(),
    audiobook_isbn: Type.String(),
  }, { additionalProperties: false }),
  descriptions: Type.Object({ short: Type.String(), long: Type.String() }, { additionalProperties: false }),
  keywords: StringListSchema,
  categories: StringListSchema,
  trim: Type.Object({ width: Type.Number({ minimum: 0 }), height: Type.Number({ minimum: 0 }), unit: Type.Union([Type.Literal("in"), Type.Literal("mm")]) }, { additionalProperties: false }),
  accessibility: Type.Object({ alt_text_complete: Type.Boolean(), notes: Type.String() }, { additionalProperties: false }),
  assets: Type.Array(Type.Object({ kind: Type.String(), path: Type.String(), alt_text: Type.String(), caption: Type.String() }, { additionalProperties: false })),
  audiobook: Type.Object({ narrator: Type.String(), producer: Type.String(), duration_minutes: Type.Integer({ minimum: 0 }), distribution_notes: Type.String() }, { additionalProperties: false }),
}, { additionalProperties: false });
export type PublishingMetadata = Static<typeof PublishingMetadataSchema>;

const MarketingGroupSchema = Type.Object({
  items: Type.Array(Type.String()),
  approval: AssetApprovalSchema,
}, { additionalProperties: false });

export const MarketingMetadataSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  positioning: MarketingGroupSchema,
  audiences: MarketingGroupSchema,
  hooks: MarketingGroupSchema,
  retailer_copy: MarketingGroupSchema,
  launch: MarketingGroupSchema,
  social: MarketingGroupSchema,
  advertisements: MarketingGroupSchema,
  audiobook_promotion: MarketingGroupSchema,
  series_page: MarketingGroupSchema,
}, { additionalProperties: false });
export type MarketingMetadata = Static<typeof MarketingMetadataSchema>;

export const AdoptionMapSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  source: Type.Object({ name: Type.String(), type: Type.String(), hash: Type.String(), bytes: Type.Integer({ minimum: 0 }) }, { additionalProperties: false }),
  engine: Type.Object({ name: Type.String(), version: Type.String() }, { additionalProperties: false }),
  sections: Type.Array(Type.Object({
    id: Type.String(), source_order: Type.Integer({ minimum: 0 }), kind: Type.String(), number: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    title: Type.String(), destination: Type.String(), source_refs: StringListSchema, included: Type.Boolean(),
  }, { additionalProperties: false })),
  assets: Type.Array(Type.Object({ id: Type.String(), hash: Type.String(), original_name: Type.String(), destination: Type.String(), media_type: Type.String(), caption: Type.String(), alt_text: Type.String() }, { additionalProperties: false })),
  metadata_decisions: Type.Record(Type.String(), Type.Union([Type.Literal("accepted"), Type.Literal("edited"), Type.Literal("ignored")])),
  warnings: StringListSchema,
}, { additionalProperties: false });
export type AdoptionMap = Static<typeof AdoptionMapSchema>;

export const ReaderExperimentIndexSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  experiments: Type.Array(Type.Object({
    id: Type.String({ pattern: "^RE-[0-9]{3}$" }),
    path: Type.String(),
    status: Type.String(),
    source_hash: Type.String(),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type ReaderExperimentIndex = Static<typeof ReaderExperimentIndexSchema>;

export const ReaderResponseV2Schema = Type.Object({
  experiment_id: Type.String({ pattern: "^RE-[0-9]{3}$" }),
  questionnaire_version: Type.String(),
  phase: Type.Union([Type.Literal("immediate"), Type.Literal("delayed")]),
  reader_id: Type.String({ minLength: 1 }),
  source: Type.Literal("human"),
  segment: Type.String(),
  recorded_at: Type.String(),
  accepted_at: Type.String(),
  continued_reading: Type.Union([Type.Boolean(), Type.Null()]),
  would_buy: Type.Union([Type.Boolean(), Type.Null()]),
  confusions: StringListSchema,
  trust_breaks: StringListSchema,
  lines_that_worked: StringListSchema,
  remembered_hook: Type.String(),
  remembered_moments: StringListSchema,
  friend_description: Type.String(),
  disagreement_question: Type.String(),
  lingering_question: Type.String(),
  recommendation_target: Type.String(),
  recommendation_reason: Type.String(),
  told_someone: Type.Union([Type.Boolean(), Type.Null()]),
}, { additionalProperties: false });
export type ReaderResponseV2 = Static<typeof ReaderResponseV2Schema>;

const NullableRateSchema = Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]);
export const ReaderExperimentFileSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  id: Type.String({ pattern: "^RE-[0-9]{3}$" }),
  status: Type.Union([Type.Literal("planned"), Type.Literal("recruiting"), Type.Literal("immediate-complete"), Type.Literal("delayed-pending"), Type.Literal("complete"), Type.Literal("cancelled")]),
  scope: Type.Union([Type.Literal("first-page"), Type.Literal("first-chapter"), Type.Literal("selected-chapters"), Type.Literal("act"), Type.Literal("excerpt"), Type.Literal("manuscript")]),
  variant: Type.String(),
  blind: Type.Boolean(),
  target_reader: Type.String(),
  sample_path: Type.String(),
  sample_hash: Type.String(),
  questionnaire_version: Type.String(),
  minimum_immediate_count: Type.Integer({ minimum: 1, maximum: 1000 }),
  minimum_delayed_count: Type.Integer({ minimum: 1, maximum: 1000 }),
  delayed_after_hours: Type.Integer({ minimum: 24, maximum: 168 }),
  immediate_responses: Type.Array(ReaderResponseV2Schema),
  delayed_responses: Type.Array(ReaderResponseV2Schema),
  excluded_response_keys: StringListSchema,
  metrics: Type.Object({ continuation_rate: NullableRateSchema, purchase_intent_rate: NullableRateSchema, delayed_hook_recall_rate: NullableRateSchema, signature_moment_recall_rate: NullableRateSchema, specific_recommendation_rate: NullableRateSchema, talkability_rate: NullableRateSchema }, { additionalProperties: false }),
  verdict: Type.Union([Type.Literal("blocked"), Type.Literal("insufficient-signal"), Type.Literal("promising"), Type.Literal("validated"), Type.Literal("rejected")]),
  limitations: StringListSchema,
  supported_claims: StringListSchema,
  prohibited_claims: StringListSchema,
  next_action: Type.String(),
  created_at: Type.String(),
  updated_at: Type.String(),
}, { additionalProperties: false });
export type ReaderExperimentFile = Static<typeof ReaderExperimentFileSchema>;

export const InheritedContextSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  from_book: Type.String({ pattern: "^book-[0-9]{2}$" }),
  relationship: Type.Union([Type.Literal("direct-continuation"), Type.Literal("adjacent-story"), Type.Literal("prequel"), Type.Literal("later-installment"), Type.Literal("other")]),
  series_role: Type.String(),
  protagonist: Type.String(),
  inherited_canon_ids: StringListSchema,
  continuing_thread_ids: StringListSchema,
  deferred_thread_ids: StringListSchema,
  optional_context: StringListSchema,
  excluded_context: StringListSchema,
  immutable_facts: StringListSchema,
  decisions_required: StringListSchema,
  source_hashes: Type.Record(Type.String(), Type.String()),
}, { additionalProperties: false });
export type InheritedContext = Static<typeof InheritedContextSchema>;

export const PackageManifestSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  generated_at: Type.String(),
  source_hash: Type.String(),
  engine: Type.String(),
  outputs: Type.Array(Type.Object({ path: Type.String(), format: Type.String(), hash: Type.String(), required: Type.Boolean(), status: Type.Union([Type.Literal("generated"), Type.Literal("failed"), Type.Literal("stale")]), warning: Type.String() }, { additionalProperties: false })),
  warnings: StringListSchema,
}, { additionalProperties: false });
export type PackageManifest = Static<typeof PackageManifestSchema>;

export function defaultApproval(): AssetApproval {
  return { status: "draft", approved_at: null, note: "" };
}

export function defaultPublishingMetadata(book: BookState, bookNumber: number): PublishingMetadata {
  return {
    schema_version: "1.0.0",
    verification_status: "unverified",
    title: book.title,
    subtitle: "",
    series: { name: "", number: bookNumber },
    author: { name: "", pen_name: "" },
    contributors: [],
    language: "",
    territories: [],
    copyright: { holder: "", year: "", notice: "" },
    publication: { date: "", edition: "" },
    identifiers: { paperback_isbn: "", hardcover_isbn: "", epub_isbn: "", audiobook_isbn: "" },
    descriptions: { short: "", long: "" },
    keywords: [],
    categories: [],
    trim: { width: 0, height: 0, unit: "in" },
    accessibility: { alt_text_complete: false, notes: "" },
    assets: [],
    audiobook: { narrator: "", producer: "", duration_minutes: 0, distribution_notes: "" },
  };
}

function group() { return { items: [], approval: defaultApproval() }; }
export function defaultMarketingMetadata(): MarketingMetadata {
  return {
    schema_version: "1.0.0",
    positioning: group(),
    audiences: group(),
    hooks: group(),
    retailer_copy: group(),
    launch: group(),
    social: group(),
    advertisements: group(),
    audiobook_promotion: group(),
    series_page: group(),
  };
}

export interface NextBookMetadataDefaults {
  title: string;
  profile: ProfileId;
}

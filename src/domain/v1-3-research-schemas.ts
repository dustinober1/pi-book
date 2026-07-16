import { Type, type Static } from "@sinclair/typebox";
import { BookStrategySchema } from "./v1-3-schemas.js";

export const SourceReliabilitySchema = Type.Union([
  Type.Literal("unknown"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("primary"),
]);
export type SourceReliability = Static<typeof SourceReliabilitySchema>;

export const SourceRegisterV13Schema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  sources: Type.Array(Type.Object({
    id: Type.String({ minLength: 1 }),
    type: Type.String(),
    title: Type.String(),
    location: Type.String(),
    verified_on: Type.Union([Type.String(), Type.Null()]),
    supports: Type.Array(Type.String()),
    notes: Type.String(),
    reliability: Type.Optional(SourceReliabilitySchema),
    observed_on: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    supports_research_ids: Type.Optional(Type.Array(Type.String({ pattern: "^RES-[0-9]{3}$" }))),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type SourceRegisterV13 = Static<typeof SourceRegisterV13Schema>;

const ReaderFrictionPhase3Schema = Type.Object({
  ...BookStrategySchema.properties.reader_friction.properties,
  accepted_tradeoffs: Type.Array(Type.Object({
    id: Type.String(),
    statement: Type.String(),
    mitigation: Type.String(),
    source_cluster_ids: Type.Optional(Type.Array(Type.String())),
  }, { additionalProperties: false })),
}, { additionalProperties: false });

export const BookStrategyPhase3Schema = Type.Object({
  ...BookStrategySchema.properties,
  reader_friction: ReaderFrictionPhase3Schema,
}, { additionalProperties: false });
export type BookStrategyPhase3 = Static<typeof BookStrategyPhase3Schema>;

import { Type, type Static } from "@sinclair/typebox";

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

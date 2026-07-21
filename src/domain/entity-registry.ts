import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "./story-record-status.js";

export const ENTITY_CATEGORIES = [
  "character",
  "location",
  "object",
  "organization",
  "technology",
  "event",
  "secret",
  "claim",
  "relationship",
] as const;

export const EntityCategorySchema = Type.Union(
  ENTITY_CATEGORIES.map((value) => Type.Literal(value)),
);
export type EntityCategory = Static<typeof EntityCategorySchema>;

export const EntityRecordSchema = Type.Object({
  id: Type.String({ pattern: "^[A-Z][A-Z0-9]*(?:-[A-Z0-9][A-Z0-9._-]*)+$" }),
  category: EntityCategorySchema,
  display_name: Type.String({ minLength: 1 }),
  aliases: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  status: StoryRecordStatusSchema,
  source: Type.String({ minLength: 1 }),
  introduced_in: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
}, { additionalProperties: false });
export type EntityRecord = Static<typeof EntityRecordSchema>;

export const EntityRegistrySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  entities: Type.Array(EntityRecordSchema),
}, { additionalProperties: false });
export type EntityRegistry = Static<typeof EntityRegistrySchema>;

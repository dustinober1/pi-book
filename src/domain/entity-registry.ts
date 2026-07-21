import { Type, type Static } from "@sinclair/typebox";

export const EntityCategorySchema = Type.Union([
  Type.Literal("character"),
  Type.Literal("location"),
  Type.Literal("object"),
  Type.Literal("organization"),
  Type.Literal("technology"),
  Type.Literal("event"),
  Type.Literal("concept"),
]);
export type EntityCategory = Static<typeof EntityCategorySchema>;

export const EntityRecordSchema = Type.Object({
  id: Type.String({ pattern: "^[A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*-[0-9]{3}$" }),
  category: EntityCategorySchema,
  display_name: Type.String({ minLength: 1 }),
  aliases: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  status: Type.Union([Type.Literal("active"), Type.Literal("deprecated")]),
}, { additionalProperties: false });
export type EntityRecord = Static<typeof EntityRecordSchema>;

export const EntityRegistrySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  entities: Type.Array(EntityRecordSchema),
}, { additionalProperties: false });
export type EntityRegistry = Static<typeof EntityRegistrySchema>;

export function defaultEntityRegistry(): EntityRegistry {
  return { schema_version: "1.0.0", entities: [] };
}

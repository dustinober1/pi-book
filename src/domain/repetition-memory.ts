import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const RepetitionPatternCategorySchema = Type.Union([
  Type.Literal("sentence-opening"),
  Type.Literal("ngram"),
  Type.Literal("gesture"),
  Type.Literal("transition"),
  Type.Literal("dialogue-tag"),
  Type.Literal("metaphor"),
  Type.Literal("chapter-opening"),
  Type.Literal("scene-ending"),
  Type.Literal("verbal-tic"),
]);
export type RepetitionPatternCategory = Static<typeof RepetitionPatternCategorySchema>;

export const RepetitionMemorySourceSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  hash: HashSchema,
  chapter: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type RepetitionMemorySource = Static<typeof RepetitionMemorySourceSchema>;

export const RepetitionPatternSchema = Type.Object({
  category: RepetitionPatternCategorySchema,
  text: Type.String({ minLength: 1, maxLength: 160 }),
  count: Type.Integer({ minimum: 2 }),
  snippets: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 2, uniqueItems: true }),
}, { additionalProperties: false });
export type RepetitionPattern = Static<typeof RepetitionPatternSchema>;

export const RepetitionMemorySchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  memory_id: Type.String({ pattern: "^REP-[A-F0-9]{16}$" }),
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  recent_chapters: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
  source_hashes: Type.Array(RepetitionMemorySourceSchema),
  patterns: Type.Array(RepetitionPatternSchema),
  avoid_list: Type.Array(Type.String({ minLength: 1, maxLength: 160 }), { maxItems: 8, uniqueItems: true }),
}, { additionalProperties: false });
export type RepetitionMemory = Static<typeof RepetitionMemorySchema>;

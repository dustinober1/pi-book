import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const NullableTextSchema = Type.Union([Type.String({ minLength: 1 }), Type.Null()]);
const CompactRuleSchema = Type.String({ minLength: 1, maxLength: 320 });

export const StyleCardSourceSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  hash: HashSchema,
}, { additionalProperties: false });
export type StyleCardSource = Static<typeof StyleCardSourceSchema>;

export const StyleCardExampleSchema = Type.Object({
  source_path: Type.String({ minLength: 1 }),
  source_hash: HashSchema,
  excerpt: Type.String({ minLength: 1, maxLength: 240 }),
}, { additionalProperties: false });
export type StyleCardExample = Static<typeof StyleCardExampleSchema>;

export const StyleCardSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  style_id: Type.String({ pattern: "^STYLE-[A-F0-9]{16}$" }),
  pov: Type.String({ minLength: 1 }),
  source_hashes: Type.Array(StyleCardSourceSchema, { minItems: 2 }),
  pov_distance: NullableTextSchema,
  tense: NullableTextSchema,
  sentence_density: Type.Array(CompactRuleSchema, { maxItems: 3 }),
  dialogue_rules: Type.Array(CompactRuleSchema, { maxItems: 4 }),
  interiority_limits: Type.Array(CompactRuleSchema, { maxItems: 3 }),
  description_limits: Type.Array(CompactRuleSchema, { maxItems: 3 }),
  voice_markers: Type.Array(CompactRuleSchema, { maxItems: 4 }),
  prohibited_habits: Type.Array(CompactRuleSchema, { maxItems: 6 }),
  accepted_examples: Type.Array(StyleCardExampleSchema, { maxItems: 2 }),
  recent_patterns_to_avoid: Type.Array(Type.String({ minLength: 1, maxLength: 160 }), { maxItems: 8 }),
  active_rules: Type.Array(CompactRuleSchema, { minItems: 1, maxItems: 15 }),
}, { additionalProperties: false });
export type StyleCard = Static<typeof StyleCardSchema>;

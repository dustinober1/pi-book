import { Type, type Static } from "@sinclair/typebox";

export const PremiseVariantSchema = Type.Object({
  id: Type.String({ pattern: "^PV-00[1-5]$" }),
  order: Type.Integer({ minimum: 1, maximum: 5 }),
  title: Type.String({ minLength: 1 }),
  premise: Type.String({ minLength: 1 }),
  is_raw_idea_baseline: Type.Boolean(),
  preserved_seed_elements: Type.Array(Type.String({ minLength: 1 })),
  story_engine: Type.String({ minLength: 1 }),
  central_final_page_question: Type.String({ minLength: 1 }),
  immediate_gain: Type.String({ minLength: 1 }),
  deferred_cost: Type.String({ minLength: 1 }),
  irreversible_effect: Type.String({ minLength: 1 }),
  differentiation: Type.String({ minLength: 1 }),
  series_potential: Type.String({ minLength: 1 }),
  accepted_tradeoffs: Type.Array(Type.String({ minLength: 1 })),
  diagnostics: Type.Array(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type PremiseVariant = Static<typeof PremiseVariantSchema>;

export const PremiseLabSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  raw_idea: Type.String(),
  seed_elements: Type.Array(Type.String({ minLength: 1 })),
  variants: Type.Array(PremiseVariantSchema, { maxItems: 5 }),
  selected_variant_id: Type.Union([Type.String({ pattern: "^PV-00[1-5]$" }), Type.Null()]),
  selection_decision_id: Type.Union([Type.String({ pattern: "^DEC-[0-9]{3}$" }), Type.Null()]),
}, { additionalProperties: false });
export type PremiseLab = Static<typeof PremiseLabSchema>;

export function defaultPremiseLab(bookId: string): PremiseLab {
  return {
    schema_version: "1.0.0",
    book_id: bookId,
    raw_idea: "",
    seed_elements: [],
    variants: [],
    selected_variant_id: null,
    selection_decision_id: null,
  };
}

import { Type, type Static } from "@sinclair/typebox";
import { PlotGridSchema } from "./schemas.js";
import { BookStrategyPhase3Schema } from "./v1-3-research-schemas.js";

export const PLAN_STRESS_CHECK_IDS = [
  "early-genre-promise",
  "middle-repetition",
  "motivated-risk",
  "fair-information",
  "uneven-alternatives",
  "avoidable-silence",
  "redundant-characters",
  "external-ending-contract",
  "emotional-ending-contract",
  "reference-similarity-and-tradeoffs",
] as const;

export const DecisionLedgerEntrySchema = Type.Object({
  id: Type.String({ pattern: "^DEC-[0-9]{3}$" }),
  chapter: Type.Integer({ minimum: 1 }),
  choice: Type.String(),
  immediate_gain: Type.String(),
  deferred_cost: Type.String(),
  irreversible_effect: Type.String(),
  payoff_window: Type.Object({
    start_chapter: Type.Integer({ minimum: 1 }),
    end_chapter: Type.Integer({ minimum: 1 }),
  }, { additionalProperties: false }),
  status: Type.Union([
    Type.Literal("planned"),
    Type.Literal("made"),
    Type.Literal("paid-off"),
    Type.Literal("abandoned"),
  ]),
}, { additionalProperties: false });

export const PlanStressCheckSchema = Type.Object({
  id: Type.Union([
    Type.Literal("early-genre-promise"),
    Type.Literal("middle-repetition"),
    Type.Literal("motivated-risk"),
    Type.Literal("fair-information"),
    Type.Literal("uneven-alternatives"),
    Type.Literal("avoidable-silence"),
    Type.Literal("redundant-characters"),
    Type.Literal("external-ending-contract"),
    Type.Literal("emotional-ending-contract"),
    Type.Literal("reference-similarity-and-tradeoffs"),
  ]),
  status: Type.Union([
    Type.Literal("pending"),
    Type.Literal("pass"),
    Type.Literal("accepted-tradeoff"),
    Type.Literal("blocked"),
  ]),
  rationale: Type.String(),
  evidence_refs: Type.Array(Type.String()),
  tradeoff_id: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: false });

export const PlotGridPhase4Schema = Type.Object({
  ...PlotGridSchema.properties,
  decisions: Type.Optional(Type.Array(DecisionLedgerEntrySchema)),
}, { additionalProperties: false });

export const BookStrategyPhase4Schema = Type.Object({
  ...BookStrategyPhase3Schema.properties,
  plan_stress_test: Type.Optional(Type.Array(PlanStressCheckSchema)),
}, { additionalProperties: false });

export type DecisionLedgerEntry = Static<typeof DecisionLedgerEntrySchema>;
export type PlanStressCheck = Static<typeof PlanStressCheckSchema>;
export type PlotGridPhase4 = Static<typeof PlotGridPhase4Schema>;
export type BookStrategyPhase4 = Static<typeof BookStrategyPhase4Schema>;

export function defaultPhase4StressTest(): PlanStressCheck[] {
  return PLAN_STRESS_CHECK_IDS.map((id) => ({
    id,
    status: "pending",
    rationale: "",
    evidence_refs: [],
    tradeoff_id: null,
  }));
}

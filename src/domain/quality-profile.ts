import { Type, type Static } from "@sinclair/typebox";

export const QualityTierIdSchema = Type.Union([
  Type.Literal("economy"),
  Type.Literal("balanced"),
  Type.Literal("premium"),
  Type.Literal("editorial"),
]);
export type QualityTierId = Static<typeof QualityTierIdSchema>;

export const BudgetExhaustionPolicySchema = Type.Union([
  Type.Literal("stop"),
  Type.Literal("downgrade"),
]);
export type BudgetExhaustionPolicy = Static<typeof BudgetExhaustionPolicySchema>;

export const FactCheckingPolicySchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("risk-based"),
  Type.Literal("always"),
]);
export type FactCheckingPolicy = Static<typeof FactCheckingPolicySchema>;

const NullablePositiveIntegerSchema = Type.Union([
  Type.Integer({ minimum: 1 }),
  Type.Null(),
]);

export const QualityBudgetStateSchema = Type.Object({
  maximum_total_tokens: NullablePositiveIntegerSchema,
  maximum_tokens_per_chapter: NullablePositiveIntegerSchema,
  maximum_calls_per_chapter: NullablePositiveIntegerSchema,
  on_exhaustion: BudgetExhaustionPolicySchema,
}, { additionalProperties: false });
export type QualityBudgetState = Static<typeof QualityBudgetStateSchema>;

export const QualityProjectStateSchema = Type.Object({
  tier: QualityTierIdSchema,
  adaptive: Type.Boolean(),
  key_scene_candidates: Type.Integer({ minimum: 1, maximum: 2 }),
  maximum_revision_passes: Type.Integer({ minimum: 0, maximum: 3 }),
  fact_checking: FactCheckingPolicySchema,
  budget: QualityBudgetStateSchema,
}, { additionalProperties: false });
export type QualityProjectState = Static<typeof QualityProjectStateSchema>;

export interface QualityRunOverride {
  tier?: QualityTierId;
  maximumTotalTokens?: number | null;
  maximumTokensPerChapter?: number | null;
  maximumCallsPerChapter?: number | null;
  onExhaustion?: BudgetExhaustionPolicy;
}

export interface ResolvedQualityConfig {
  tier: QualityTierId;
  adaptive: boolean;
  keySceneCandidates: number;
  maximumRevisionPasses: number;
  factChecking: FactCheckingPolicy;
  budget: {
    maximumTotalTokens: number | null;
    maximumTokensPerChapter: number | null;
    maximumCallsPerChapter: number | null;
    onExhaustion: BudgetExhaustionPolicy;
  };
}

export type QualityCriticLane =
  | "combined"
  | "continuity"
  | "voice"
  | "causality"
  | "research"
  | "character-intent"
  | "style"
  | "factuality";

export interface QualityTierPolicy {
  scenePlan: boolean;
  /** Routine chapter candidate count. Key scenes may raise premium/editorial to `keySceneCandidates`. */
  candidates: number;
  criticLanes: readonly QualityCriticLane[];
  finalReviewer: boolean;
  claimAudit: boolean;
}

function lanes(...items: QualityCriticLane[]): readonly QualityCriticLane[] {
  return Object.freeze(items);
}

export const QUALITY_TIER_POLICIES: Readonly<Record<QualityTierId, QualityTierPolicy>> = Object.freeze({
  economy: Object.freeze({ scenePlan: false, candidates: 1, criticLanes: lanes(), finalReviewer: false, claimAudit: false }),
  balanced: Object.freeze({ scenePlan: true, candidates: 1, criticLanes: lanes("combined"), finalReviewer: false, claimAudit: false }),
  premium: Object.freeze({ scenePlan: true, candidates: 1, criticLanes: lanes("continuity", "causality", "character-intent", "style"), finalReviewer: false, claimAudit: false }),
  editorial: Object.freeze({ scenePlan: true, candidates: 1, criticLanes: lanes("continuity", "causality", "character-intent", "style"), finalReviewer: true, claimAudit: true }),
});

export function parseQualityTierId(value: unknown): QualityTierId {
  if (typeof value === "string" && value in QUALITY_TIER_POLICIES) return value as QualityTierId;
  throw new Error(`Unknown quality tier: ${String(value)}. Allowed: ${Object.keys(QUALITY_TIER_POLICIES).join(", ")}.`);
}

export function parseBudgetExhaustionPolicy(value: unknown): BudgetExhaustionPolicy {
  if (value === "stop" || value === "downgrade") return value;
  throw new Error(`Unknown budget exhaustion policy: ${String(value)}. Allowed: stop, downgrade.`);
}

export function defaultQualityProjectState(): QualityProjectState {
  return {
    tier: "economy",
    adaptive: true,
    key_scene_candidates: 2,
    maximum_revision_passes: 1,
    fact_checking: "risk-based",
    budget: {
      maximum_total_tokens: null,
      maximum_tokens_per_chapter: null,
      maximum_calls_per_chapter: null,
      on_exhaustion: "stop",
    },
  };
}

function positiveOrNull(value: number | null, label: string): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer or null.`);
  return value;
}

export function qualityStateWithOverride(
  state: QualityProjectState | undefined,
  override: QualityRunOverride | undefined,
): QualityProjectState {
  const base = structuredClone(state ?? defaultQualityProjectState());
  if (override?.tier !== undefined) base.tier = parseQualityTierId(override.tier);
  if (override?.maximumTotalTokens !== undefined) base.budget.maximum_total_tokens = positiveOrNull(override.maximumTotalTokens, "Maximum total tokens");
  if (override?.maximumTokensPerChapter !== undefined) base.budget.maximum_tokens_per_chapter = positiveOrNull(override.maximumTokensPerChapter, "Maximum tokens per chapter");
  if (override?.maximumCallsPerChapter !== undefined) base.budget.maximum_calls_per_chapter = positiveOrNull(override.maximumCallsPerChapter, "Maximum calls per chapter");
  if (override?.onExhaustion !== undefined) base.budget.on_exhaustion = parseBudgetExhaustionPolicy(override.onExhaustion);
  resolveQualityConfig(base);
  return base;
}

export function resolveQualityConfig(state: QualityProjectState = defaultQualityProjectState()): ResolvedQualityConfig {
  const tier = parseQualityTierId(state.tier);
  if (!Number.isInteger(state.key_scene_candidates) || state.key_scene_candidates < 1 || state.key_scene_candidates > 2) {
    throw new Error("Key scene candidates must be an integer from 1 to 2.");
  }
  if (!Number.isInteger(state.maximum_revision_passes) || state.maximum_revision_passes < 0 || state.maximum_revision_passes > 3) {
    throw new Error("Maximum revision passes must be an integer from 0 to 3.");
  }
  if (!(["off", "risk-based", "always"] as const).includes(state.fact_checking)) {
    throw new Error(`Unknown fact-checking policy: ${String(state.fact_checking)}.`);
  }
  const onExhaustion = parseBudgetExhaustionPolicy(state.budget.on_exhaustion);
  return {
    tier,
    adaptive: state.adaptive,
    keySceneCandidates: state.key_scene_candidates,
    maximumRevisionPasses: state.maximum_revision_passes,
    factChecking: state.fact_checking,
    budget: {
      maximumTotalTokens: positiveOrNull(state.budget.maximum_total_tokens, "Maximum total tokens"),
      maximumTokensPerChapter: positiveOrNull(state.budget.maximum_tokens_per_chapter, "Maximum tokens per chapter"),
      maximumCallsPerChapter: positiveOrNull(state.budget.maximum_calls_per_chapter, "Maximum calls per chapter"),
      onExhaustion,
    },
  };
}

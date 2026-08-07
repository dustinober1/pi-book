import { GEMMA_3_12B_QAT_PROFILE_ID } from "../domain/model-fingerprint.js";
import type { ModelExecutionProfileId } from "../domain/model-execution-profile.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";

/**
 * Pick runtime and model-execution profiles from what the host model can
 * actually hold.
 *
 * New projects defaulted to `runtime.profile: "full"` — 72,000 evidence
 * characters and 24,000 instruction characters — paired with the `economy`
 * quality tier, which drafts a whole chapter in one host call with no scene
 * plan, no critics and no final reviewer. That is the widest context and the
 * least supervision: the combination least likely to work on a weak model,
 * handed out by default, in a package whose stated differentiator is
 * constrained runtimes. Nothing detected the host model, even though the
 * context window is already available to every command.
 *
 * Two rules keep this honest:
 *
 *  - The recommendation is shown and overridable, never silently applied. A
 *    writer who passes `--runtime-profile` gets exactly that.
 *  - The Gemma model-execution profile is recommended only when the environment
 *    names a model, because `qualifyGemmaModelForRun` throws without an explicit
 *    selection to fingerprint. Recommending it otherwise would write a profile
 *    into PROJECT.yaml that makes guarded execution fail on its first call —
 *    the same shape of defect as a flag that parses and does nothing.
 */

export interface CapacityRecommendation {
  runtimeProfile: RuntimeProfileId;
  modelExecutionProfile?: ModelExecutionProfileId;
  /** One sentence naming the evidence and the choice, for the writer. */
  reason: string;
  /** True when no capacity signal was available and a default was assumed. */
  unknownCapacity: boolean;
}

export interface CapacityRecommendationInput {
  /** Host context window in tokens, when the harness reports one. */
  contextWindowTokens?: number | undefined;
  /**
   * Whether the environment names an exact worker model. Fingerprint
   * qualification needs one before an exact-model profile can be selected.
   */
  hasExplicitWorkerModel?: boolean;
}

/**
 * Each profile's own evidence and instruction ceilings, converted to tokens at
 * the repository's stable 4-bytes-per-token fallback, plus its reserved output
 * and safety margin. A profile is affordable when the window can hold that.
 */
function requiredTokens(id: RuntimeProfileId): number {
  const profile = RUNTIME_PROFILES[id];
  const budget = profile.modelBudget;
  return Math.ceil((budget.maxInstructionChars + budget.maxEvidenceChars) / 4)
    + budget.reservedOutputTokens
    + budget.safetyMarginTokens;
}

/** Largest profile whose own budget fits the window, in descending order. */
export function affordableRuntimeProfile(contextWindowTokens: number): RuntimeProfileId {
  const ordered: RuntimeProfileId[] = ["full", "local", "tiny-local"];
  return ordered.find((id) => requiredTokens(id) <= contextWindowTokens) ?? "tiny-local";
}

export function recommendProfilesForCapacity(input: CapacityRecommendationInput): CapacityRecommendation {
  const window = input.contextWindowTokens;
  if (window === undefined || !Number.isFinite(window) || window <= 0) {
    return {
      runtimeProfile: "local",
      reason: "The host model's context window could not be detected. Defaulting to the local runtime profile, which is the safe direction: it fits every model a smaller window would have required, and costs a larger model only bounded context. Pass --runtime-profile to choose explicitly.",
      unknownCapacity: true,
    };
  }

  const runtimeProfile = affordableRuntimeProfile(window);
  const required = requiredTokens(runtimeProfile);
  const base = `The host model reports a ${window.toLocaleString("en-US")}-token context window, which fits the ${runtimeProfile} runtime profile (about ${required.toLocaleString("en-US")} tokens of instructions, evidence, reserved output and margin).`;

  // An exact-model execution profile carries per-job token budgets and
  // constrained decoding tuned for one model, and is worth having on anything
  // that is not a large-context host. Gemma's own reliable window is 16,384
  // tokens, which lands on `local` — so this is deliberately not restricted to
  // `tiny-local`, or it would never fire for the model it was built for.
  if (runtimeProfile === "full") return { runtimeProfile, reason: base, unknownCapacity: false };
  if (input.hasExplicitWorkerModel) {
    return {
      runtimeProfile,
      modelExecutionProfile: GEMMA_3_12B_QAT_PROFILE_ID,
      reason: `${base} NOVEL_FORGE_QUALITY_MODEL names an exact worker model, so the ${GEMMA_3_12B_QAT_PROFILE_ID} execution profile is selected for its per-job budgets and constrained decoding; it is verified by fingerprint on the first guarded call, which fails loudly if the model is a different one.`,
      unknownCapacity: false,
    };
  }
  return {
    runtimeProfile,
    reason: `${base} The small-model execution profile was not selected because it requires an exact model to fingerprint: set NOVEL_FORGE_QUALITY_PROVIDER and NOVEL_FORGE_QUALITY_MODEL, then pass --model-profile ${GEMMA_3_12B_QAT_PROFILE_ID}.`,
    unknownCapacity: false,
  };
}

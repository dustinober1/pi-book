import type { RuntimeProfile } from "../domain/runtime-profile.js";
import { compilePrompt, PromptBudgetError, type CompiledPrompt } from "./prompt-compiler.js";
import { bookPlanStagePhases, bookPlanStageSpec, type BookPlanStageInput } from "./stage-specs/index.js";

export type BookPlanPromptPhaseId = "single" | "architecture" | "evidence";

export interface BookPlanPromptPhase {
  phase: BookPlanPromptPhaseId;
  compiled: CompiledPrompt;
}

/**
 * Compile the book-plan prompt for a runtime profile: one prompt when the whole
 * spec fits the profile's instruction budget, otherwise the two-phase
 * architecture/evidence sequence, each phase independently within budget.
 * The compiler's refusal to truncate a normative rule is preserved either way —
 * a phase that still does not fit throws PromptBudgetError instead of sending a
 * shortened contract. Both shapes feed exactly one guarded book-plan event.
 */
export function bookPlanStagePromptPlan(input: BookPlanStageInput, runtime: RuntimeProfile): BookPlanPromptPhase[] {
  try {
    return [{ phase: "single", compiled: compilePrompt(bookPlanStageSpec(input), runtime) }];
  } catch (error) {
    if (!(error instanceof PromptBudgetError)) throw error;
    const phases = bookPlanStagePhases(input);
    return [
      { phase: "architecture", compiled: compilePrompt(phases.architecture, runtime) },
      { phase: "evidence", compiled: compilePrompt(phases.evidence, runtime) },
    ];
  }
}

/** Compile one named phase directly, regardless of whether the whole spec fits. */
export function bookPlanPhaseCompiled(input: BookPlanStageInput, phase: Exclude<BookPlanPromptPhaseId, "single">, runtime: RuntimeProfile): CompiledPrompt {
  return compilePrompt(bookPlanStagePhases(input)[phase], runtime);
}

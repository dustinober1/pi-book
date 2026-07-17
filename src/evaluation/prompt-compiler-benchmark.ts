import { compilePrompt } from "../application/prompt-compiler.js";
import {
  bookPlanStageSpec,
  premisePlanStageSpec,
  reviewStageSpec,
  voicePlanStageSpec,
} from "../application/stage-specs/index.js";
import type { StageSpec } from "../application/stage-specs/types.js";
import { RUNTIME_PROFILES } from "../domain/runtime-profile.js";

export interface PromptBenchmarkScenario {
  id: string;
  stageId: string;
  standardChars: number;
  compactChars: number;
  reductionPercent: number;
  withinLocalBudget: boolean;
  thresholdMet: boolean;
}

export interface PromptCompilerBenchmarkReport {
  schemaVersion: "1.0.0";
  standardProfile: "full";
  compactProfile: "local";
  thresholdPercent: 30;
  compactFloorExceptionChars: 2_000;
  scenarios: PromptBenchmarkScenario[];
  allPassed: boolean;
}

function benchmarkSpecs(): Array<{ id: string; spec: StageSpec }> {
  const root = "/benchmark/novel";
  const bookId = "book-01";
  const projectHash = "benchmark-project-hash";
  return [
    {
      id: "book-plan",
      spec: bookPlanStageSpec({
        root,
        bookId,
        intakeContext: "Original author idea: A damaged analyst hears a signal nobody else can verify. Explicit decision: preserve institutional realism and writer-controlled tradeoffs.",
        premiseContext: "Selected premise: the signal is genuine, but acting on it creates an irreversible public cost.",
        planningQuestions: [
          "Which institutional pressure makes delay costly?",
          "What evidence can the protagonist verify personally?",
          "Which ending consequence must remain unresolved?",
          "What recurring-cast pressure belongs to later books?",
        ],
        projectHash,
      }),
    },
    {
      id: "review",
      spec: reviewStageSpec({
        root,
        bookId,
        scope: "manuscript",
        expectedStage: "manuscript-review",
        reviewLanes: [
          "continuity and reveal order",
          "voice and point-of-view integrity",
          "scene-engine repetition and state change",
          "reader promise and achieved remarkability",
          "evidence-backed revision necessity",
        ],
        projectHash,
      }),
    },
    {
      id: "voice-plan",
      spec: voicePlanStageSpec({
        root,
        intakeContext: "The writer supplied an accepted sample, two not-this examples, desired reader effects, productive imperfections, and explicit lived-material boundaries.",
        projectHash,
      }),
    },
    {
      id: "premise-plan",
      spec: premisePlanStageSpec({
        root,
        bookId,
        rawIdea: "A damaged analyst hears a signal nobody else can verify.",
        seedElements: ["institutional realism", "ambiguous evidence", "irreversible choice", "series potential"],
        projectHash,
      }),
    },
  ];
}

export function runPromptCompilerBenchmark(): PromptCompilerBenchmarkReport {
  const scenarios = benchmarkSpecs().map(({ id, spec }): PromptBenchmarkScenario => {
    const standard = compilePrompt(spec, RUNTIME_PROFILES.full);
    const compact = compilePrompt(spec, RUNTIME_PROFILES.local);
    const reductionPercent = Number(((1 - compact.characterCount / standard.characterCount) * 100).toFixed(2));
    const thresholdMet = reductionPercent >= 30 || compact.characterCount < 2_000;
    return {
      id,
      stageId: spec.id,
      standardChars: standard.characterCount,
      compactChars: compact.characterCount,
      reductionPercent,
      withinLocalBudget: compact.characterCount <= RUNTIME_PROFILES.local.maxPromptChars,
      thresholdMet,
    };
  });
  return {
    schemaVersion: "1.0.0",
    standardProfile: "full",
    compactProfile: "local",
    thresholdPercent: 30,
    compactFloorExceptionChars: 2_000,
    scenarios,
    allPassed: scenarios.every((scenario) => scenario.thresholdMet && scenario.withinLocalBudget),
  };
}

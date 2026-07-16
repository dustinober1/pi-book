import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

export { completePlot, queueFixture, researchFixture, sourcesFixture };

export function learningStrategy(status: "proposed" | "approved" | "rejected" = "approved", eligible = true) {
  const strategy = completeStrategy() as ReturnType<typeof completeStrategy> & { revision_learning_guardrails?: unknown[] };
  strategy.revision_learning_guardrails = [{
    id: "LRN-001",
    pattern_id: "PAT-dialogue-loop",
    rule: "Every interview must change case, relationship, power, or knowledge state.",
    source_ticket_ids: eligible ? ["B01-T001", "B01-T002", "B01-T003"] : ["B01-T001", "B01-T002"],
    distinct_chapters: eligible ? [1, 2, 3] : [1, 2],
    milestone_reviews: [],
    status,
  }];
  return strategy;
}

export function recurrenceTickets(eligible = true) {
  const chapters = eligible ? [1, 2, 3] : [1, 2];
  return {
    schema_version: "1.0.0",
    tickets: chapters.map((chapter, index) => ({
      id: `B01-T${String(index + 1).padStart(3, "0")}`,
      severity: "medium",
      category: "scene-diversity",
      chapter,
      evidence: `Chapter ${chapter} repeats a state-neutral interview.`,
      problem: "Repeated interview without a state change.",
      required_change: "Change case, relationship, power, or knowledge state.",
      protected_constraints: [],
      acceptance_tests: ["The interview changes a declared story state."],
      status: "closed",
      recurrence: { pattern_id: "PAT-dialogue-loop", milestone_review: null },
    })),
  };
}

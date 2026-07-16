import test from "node:test";
import assert from "node:assert/strict";
import {
  renderApprovedLearningGuardrails,
  revisionLearningCandidates,
  revisionLearningFindings,
} from "../src/application/revision-learning.js";
import type { BookStrategyPhase5, RevisionTicketsPhase5 } from "../src/domain/v1-3-audit-schemas.js";
import { completeStrategy } from "./phase4-fixtures.js";

function ticket(id: string, chapter: number | null, review: string | null): RevisionTicketsPhase5["tickets"][number] {
  return {
    id, severity: "medium", category: "scene-diversity", chapter, evidence: id,
    problem: "Repeated interview without state change", required_change: "Change the scene or state movement",
    protected_constraints: [], acceptance_tests: ["State changes"], status: "closed",
    recurrence: { pattern_id: "PAT-dialogue-loop", milestone_review: review },
  };
}

function tickets(values: RevisionTicketsPhase5["tickets"]): RevisionTicketsPhase5 {
  return { schema_version: "1.0.0", tickets: values };
}

function strategy(status: "proposed" | "approved" | "rejected", sourceTicketIds: string[], chapters: number[], reviews: string[]): BookStrategyPhase5 {
  return {
    ...completeStrategy(),
    revision_learning_guardrails: [{
      id: "LRN-001", pattern_id: "PAT-dialogue-loop",
      rule: "Every interview must change case, relationship, power, or knowledge state.",
      source_ticket_ids: sourceTicketIds, distinct_chapters: chapters, milestone_reviews: reviews, status,
    }],
  };
}

test("two distinct chapters are not eligible and exactly three are eligible", () => {
  const two = revisionLearningCandidates(tickets([ticket("B01-T001", 1, null), ticket("B01-T002", 2, null)]))[0];
  assert.equal(two?.eligible, false);
  const three = revisionLearningCandidates(tickets([ticket("B01-T001", 1, null), ticket("B01-T002", 2, null), ticket("B01-T003", 3, null)]))[0];
  assert.equal(three?.eligible, true);
});

test("duplicate tickets in one chapter count once", () => {
  const candidate = revisionLearningCandidates(tickets([
    ticket("B01-T001", 1, null), ticket("B01-T002", 1, null), ticket("B01-T003", 2, null),
  ]))[0];
  assert.deepEqual(candidate?.distinctChapters, [1, 2]);
  assert.equal(candidate?.eligible, false);
});

test("one milestone review is not eligible and exactly two are eligible", () => {
  const one = revisionLearningCandidates(tickets([ticket("B01-T001", null, "act-1-review")]))[0];
  assert.equal(one?.eligible, false);
  const two = revisionLearningCandidates(tickets([
    ticket("B01-T001", null, "act-1-review"), ticket("B01-T002", null, "midpoint-review"),
  ]))[0];
  assert.equal(two?.eligible, true);
});

test("proposed candidates do not render and approved eligible candidates do", () => {
  const evidence = tickets([ticket("B01-T001", 1, null), ticket("B01-T002", 2, null), ticket("B01-T003", 3, null)]);
  assert.equal(renderApprovedLearningGuardrails(strategy("proposed", ["B01-T001", "B01-T002", "B01-T003"], [1, 2, 3], [])), "");
  const approved = strategy("approved", ["B01-T001", "B01-T002", "B01-T003"], [1, 2, 3], []);
  assert.match(renderApprovedLearningGuardrails(approved), /Every interview must change/);
  assert.deepEqual(revisionLearningFindings(approved, evidence).filter((item) => item.severity === "blocker"), []);
});

test("approved candidates require exact eligible evidence and ticket linkage", () => {
  const evidence = tickets([ticket("B01-T001", 1, null), ticket("B01-T002", 2, null)]);
  const findings = revisionLearningFindings(strategy("approved", ["B01-T001"], [1], []), evidence);
  assert.ok(findings.some((item) => item.code === "ineligible-learning-guardrail"));
  assert.ok(findings.some((item) => item.code === "learning-ticket-mismatch"));
});

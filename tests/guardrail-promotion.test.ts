import test from "node:test";
import assert from "node:assert/strict";
import { defaultBookStrategy } from "../src/domain/v1-3-schemas.js";
import type { BookStrategyPhase5, RevisionTicketsPhase5 } from "../src/domain/v1-3-audit-schemas.js";
import { renderApprovedBookGuardrails } from "../src/application/book-strategy.js";
import { synthesizeTickets, type ReviewFinding } from "../src/review/review.js";
import { applyGuardrailDecision, promotionCandidates, revisionLearningFindings } from "../src/application/revision-learning.js";

function emptyTickets(): RevisionTicketsPhase5 {
  return { schema_version: "1.0.0", tickets: [] };
}

function finding(chapter: number): ReviewFinding {
  return {
    severity: "medium", category: "scene-diversity", chapter,
    evidence: `Chapter ${chapter} repeats a state-neutral interview.`,
    problem: "Interview does not change case, relationship, or power state",
    requiredChange: "Make the interview change case, relationship, or power state.",
    guardrailCandidate: "Every interview must change case, relationship, or power state.",
    protectedConstraints: [], acceptanceTests: ["The scene changes state."],
  };
}

test("three occurrences in distinct chapters create exactly one promotion candidate", () => {
  let tickets = emptyTickets();
  tickets = synthesizeTickets(tickets, [finding(2)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
  tickets = synthesizeTickets(tickets, [finding(5)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
  assert.equal(promotionCandidates(tickets).length, 0);
  tickets = synthesizeTickets(tickets, [finding(8)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
  const candidates = promotionCandidates(tickets);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  assert.ok(candidate, "Expected one promotion candidate");
  assert.deepEqual(candidate.occurrence_chapters, [2, 5, 8]);
});

test("repeated findings in one chapter count as one chapter occurrence", () => {
  let tickets = emptyTickets();
  tickets = synthesizeTickets(tickets, [finding(2)], 1) as RevisionTicketsPhase5;
  tickets = synthesizeTickets(tickets, [finding(2)], 1) as RevisionTicketsPhase5;
  tickets = synthesizeTickets(tickets, [finding(2)], 1) as RevisionTicketsPhase5;
  assert.equal(promotionCandidates(tickets).length, 0);
});

test("two distinct milestone reviews create a candidate even before three chapters", () => {
  let tickets = emptyTickets();
  tickets = synthesizeTickets(tickets, [finding(2)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
  tickets = synthesizeTickets(tickets, [finding(2)], 1, { milestoneReviewId: "MR-002" }) as RevisionTicketsPhase5;
  const candidates = promotionCandidates(tickets);
  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  assert.ok(candidate, "Expected one promotion candidate");
  assert.deepEqual(candidate.milestone_review_ids, ["MR-001", "MR-002"]);
});

test("candidate guardrails remain inactive until writer approval", () => {
  let tickets = emptyTickets();
  for (const chapter of [2, 5, 8]) tickets = synthesizeTickets(tickets, [finding(chapter)], 1) as RevisionTicketsPhase5;
  const candidate = promotionCandidates(tickets)[0];
  assert.ok(candidate, "Expected a promotion candidate to be found");
  const strategy = defaultBookStrategy() as BookStrategyPhase5;
  const proposed = applyGuardrailDecision(strategy, candidate, "proposed", "2026-07-15T12:00:00Z");
  assert.equal(renderApprovedBookGuardrails(proposed), "");
  const approved = applyGuardrailDecision(proposed, candidate, "approved", "2026-07-15T12:05:00Z");
  assert.match(renderApprovedBookGuardrails(approved), /Every interview must change case, relationship, or power state/i);
  assert.deepEqual(revisionLearningFindings(tickets, approved).filter((item) => item.severity === "blocker"), []);
});

test("rejected promotion remains visible but inactive", () => {
  let tickets = emptyTickets();
  for (const chapter of [2, 5, 8]) tickets = synthesizeTickets(tickets, [finding(chapter)], 1) as RevisionTicketsPhase5;
  const candidate = promotionCandidates(tickets)[0];
  assert.ok(candidate, "Expected a promotion candidate to be found");
  const strategy = applyGuardrailDecision(defaultBookStrategy() as BookStrategyPhase5, candidate, "rejected", "2026-07-15T12:00:00Z");
  assert.equal(strategy.review_derived_guardrails.some((item) => item.status === "rejected"), true);
  assert.equal(renderApprovedBookGuardrails(strategy), "");
});

test("direct strategy approval cannot bypass the exact recurrence threshold", () => {
  let tickets = emptyTickets();
  tickets = synthesizeTickets(tickets, [finding(2)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
  const source = tickets.tickets[0];
  assert.ok(source);
  const strategy = defaultBookStrategy() as BookStrategyPhase5;
  strategy.review_derived_guardrails.push({
    id: "GR-LRN-001",
    rule: "Every interview must change state.",
    source_cluster_ids: [],
    status: "approved",
    source_ticket_ids: [source.id],
    source_milestone_ids: ["MR-001"],
    approved_at: "2026-07-15T12:00:00Z",
  });
  assert.ok(revisionLearningFindings(tickets, strategy).some((item) => item.code === "unsupported-learned-guardrail"));
});

test("every learned guardrail source ticket must exist", () => {
  let tickets = emptyTickets();
  for (const chapter of [2, 5, 8]) tickets = synthesizeTickets(tickets, [finding(chapter)], 1) as RevisionTicketsPhase5;
  const candidate = promotionCandidates(tickets)[0];
  assert.ok(candidate);
  const strategy = applyGuardrailDecision(defaultBookStrategy() as BookStrategyPhase5, candidate, "approved", "2026-07-15T12:00:00Z");
  strategy.review_derived_guardrails[0]!.source_ticket_ids = [...candidate.source_ticket_ids, "B01-T999"];
  assert.ok(revisionLearningFindings(tickets, strategy).some((item) => item.code === "missing-guardrail-ticket-source"));
});

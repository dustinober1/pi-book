import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAuthorJourney,
  evaluateAuthorJourneyFixture,
  type AuthorJourneyFixture,
  type AuthorJourneyTrace,
} from "../src/evaluation/author-journey.js";

function fixture(trace: AuthorJourneyTrace, overrides: Partial<AuthorJourneyFixture> = {}): AuthorJourneyFixture {
  return {
    schema_version: "1.0.0",
    id: "test-journey",
    description: "Deterministic test journey.",
    limitations: ["Current workflow still requires explicit author decisions."],
    trace,
    expected: {
      authorQuestions: 0,
      modelPrompts: 0,
      guardedEvents: 0,
      rejectedEvents: 0,
      retries: 0,
      writerApprovals: 0,
      chaptersCompleted: 0,
      contextCharacters: 0,
      stopReason: "unknown",
    },
    limits: {
      max_author_questions: 100,
      max_model_prompts: 100,
      max_rejected_events: 100,
      max_retries: 100,
    },
    ...overrides,
  };
}

test("four author questions report exactly four", () => {
  const trace: AuthorJourneyTrace = {
    events: [1, 2, 3, 4].map((number) => ({ type: "author-question" as const, id: `Q${number}` })),
  };
  assert.equal(evaluateAuthorJourney(fixture(trace), trace).authorQuestions, 4);
});

test("duplicate accepted chapter events count one completed chapter", () => {
  const trace: AuthorJourneyTrace = {
    events: [
      { type: "guarded-event", id: "E1", action: "draft-chapter", outcome: "accepted", chapter: 4 },
      { type: "guarded-event", id: "E2", action: "draft-chapter", outcome: "accepted", chapter: 4 },
    ],
  };
  const metrics = evaluateAuthorJourney(fixture(trace), trace);
  assert.equal(metrics.guardedEvents, 2);
  assert.equal(metrics.chaptersCompleted, 1);
});

test("pause and resume remain one logical journey without resetting counters", () => {
  const trace: AuthorJourneyTrace = {
    events: [
      { type: "run-state", run_id: "RUN-001", state: "started" },
      { type: "author-question", id: "Q1" },
      { type: "model-prompt", id: "P1" },
      { type: "guarded-event", id: "E1", action: "draft-chapter", outcome: "accepted", chapter: 1 },
      { type: "context", characters: 8000 },
      { type: "run-state", run_id: "RUN-001", state: "paused" },
      { type: "run-state", run_id: "RUN-001", state: "resumed" },
      { type: "model-prompt", id: "P2" },
      { type: "guarded-event", id: "E2", action: "draft-chapter", outcome: "accepted", chapter: 2 },
      { type: "context", characters: 12000 },
      { type: "context", characters: 9000 },
      { type: "stop", reason: "requested-target" },
    ],
  };
  assert.deepEqual(evaluateAuthorJourney(fixture(trace), trace), {
    authorQuestions: 1,
    modelPrompts: 2,
    guardedEvents: 2,
    rejectedEvents: 0,
    retries: 0,
    writerApprovals: 0,
    chaptersCompleted: 2,
    contextCharacters: 12000,
    stopReason: "requested-target",
  });
});

test("human gates, rejections, and permitted retries are counted independently", () => {
  const trace: AuthorJourneyTrace = {
    events: [
      { type: "guarded-event", id: "E1", action: "book-plan", outcome: "rejected" },
      { type: "guarded-event", id: "E2", action: "book-plan", outcome: "accepted", retry_of: "E1" },
      { type: "writer-approval", gate: "book-plan-approval" },
      { type: "stop", reason: "human-gate" },
    ],
  };
  const metrics = evaluateAuthorJourney(fixture(trace), trace);
  assert.equal(metrics.guardedEvents, 2);
  assert.equal(metrics.rejectedEvents, 1);
  assert.equal(metrics.retries, 1);
  assert.equal(metrics.writerApprovals, 1);
  assert.equal(metrics.stopReason, "human-gate");
});

test("trace validation rejects unsafe or ambiguous measurements", () => {
  const invalid: AuthorJourneyTrace[] = [
    { events: [{ type: "context", characters: -1 }] },
    { events: [{ type: "author-question", id: "" }] },
    { events: [{ type: "guarded-event", id: "E1", action: "draft-chapter", outcome: "accepted" }] },
    { events: [{ type: "guarded-event", id: "E1", action: "book-plan", outcome: "accepted", retry_of: "missing" }] },
    { events: [
      { type: "guarded-event", id: "E1", action: "book-plan", outcome: "accepted" },
      { type: "guarded-event", id: "E1", action: "book-plan", outcome: "accepted" },
    ] },
  ];
  for (const trace of invalid) assert.throws(() => evaluateAuthorJourney(fixture(trace), trace));
});

test("fixture evaluation records exact mismatches and current limitations", () => {
  const trace: AuthorJourneyTrace = { events: [{ type: "author-question", id: "Q1" }] };
  const value = fixture(trace, {
    expected: {
      authorQuestions: 0,
      modelPrompts: 0,
      guardedEvents: 0,
      rejectedEvents: 0,
      retries: 0,
      writerApprovals: 0,
      chaptersCompleted: 0,
      contextCharacters: 0,
      stopReason: "unknown",
    },
    limits: {
      max_author_questions: 0,
      max_model_prompts: 0,
      max_rejected_events: 0,
      max_retries: 0,
    },
  });
  const result = evaluateAuthorJourneyFixture(value);
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((message) => /authorQuestions/.test(message)));
  assert.ok(result.failures.some((message) => /max_author_questions/.test(message)));
  assert.deepEqual(result.limitations, value.limitations);
});

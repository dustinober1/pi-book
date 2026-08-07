import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  evaluateAuthorJourneyFixture,
  loadAuthorJourneyFixtures,
} from "../../src/evaluation/author-journey.js";

const root = resolve(process.cwd(), "evals", "journeys");

// Hand-authored traces exercising the evaluator itself. They are deliberately
// not a velocity baseline: they only prove the counter reads a trace correctly.
// The measured baseline is recorded from real runs — see
// tests/e2e/recorded-author-journey.test.ts.
test("all four evaluator regression fixtures pass with explicit limitations", () => {
  const fixtures = loadAuthorJourneyFixtures(root);
  const results = fixtures.map(evaluateAuthorJourneyFixture);
  assert.equal(fixtures.length, 4);
  assert.deepEqual(results.filter((result) => !result.passed), []);
  assert.ok(results.every((result) => result.limitations.length > 0));
});

test("journeys preserve the roadmap's required baseline behaviors", () => {
  const results = new Map(loadAuthorJourneyFixtures(root).map((fixture) => [fixture.id, evaluateAuthorJourneyFixture(fixture)]));
  const brief = results.get("brief-to-book-plan");
  assert.equal(brief?.metrics.authorQuestions, 4);
  assert.equal(brief?.metrics.rejectedEvents, 1);
  assert.equal(brief?.metrics.retries, 1);
  assert.equal(brief?.metrics.stopReason, "human-gate");

  const packets = results.get("six-packets-to-ten-chapters");
  assert.equal(packets?.metrics.chaptersCompleted, 10);
  assert.equal(packets?.metrics.guardedEvents, 13);

  const resumed = results.get("resume-after-four-chapters");
  assert.equal(resumed?.metrics.chaptersCompleted, 10);
  assert.equal(resumed?.metrics.stopReason, "requested-target");

  const revisions = results.get("twelve-revision-tickets");
  assert.equal(revisions?.metrics.guardedEvents, 12);
  assert.equal(revisions?.metrics.chaptersCompleted, 0);
  assert.equal(revisions?.metrics.writerApprovals, 1);
  assert.equal(revisions?.metrics.stopReason, "human-gate");
});

test("npm run eval preserves existing sections and prints the evaluator regression", () => {
  const output = execFileSync("npm", ["run", "eval"], { cwd: process.cwd(), encoding: "utf8" });
  assert.match(output, /# Novel Forge architecture and revision evaluation/);
  assert.match(output, /# Novel Forge 1\.3 release evaluation/);
  assert.match(output, /# Novel Forge author-journey evaluator regression/);
  assert.match(output, /verify the evaluator, not author velocity/);
  assert.match(output, /- brief-to-book-plan: PASS/);
  assert.match(output, /- resume-after-four-chapters: PASS/);
  assert.match(output, /4\/4 evaluator regression cases passed\./);
});

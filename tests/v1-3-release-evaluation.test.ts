import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  evaluateV13ReleaseFixture,
  loadV13ReleaseFixtures,
  type ReleaseEvaluationFixture,
} from "../src/evaluation/v1-3-release.js";

test("all nine Novel Forge 1.3 release fixtures pass", () => {
  const fixtures = loadV13ReleaseFixtures(resolve(process.cwd(), "evals", "v1-3-release"));
  assert.equal(fixtures.length, 9);
  const results = fixtures.map(evaluateV13ReleaseFixture);
  assert.deepEqual(results.filter((result) => !result.passed), []);
  assert.deepEqual(new Set(results.map((result) => result.kind)).size, 9);
});

test("release evaluation reports evidence and failures without mutating input", () => {
  const fixture: ReleaseEvaluationFixture = {
    schema_version: "1.0.0",
    id: "below-threshold",
    kind: "guardrail-promotion",
    input: { chapters: [4, 4], milestone_reviews: ["act-1"] },
    expected: { eligible: true },
  };
  const before = structuredClone(fixture);
  const result = evaluateV13ReleaseFixture(fixture);
  assert.equal(result.passed, false);
  assert.ok(result.evidence.length > 0);
  assert.ok(result.failures.some((failure) => /eligible/i.test(failure)));
  assert.deepEqual(fixture, before);
});

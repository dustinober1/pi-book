import test from "node:test";
import assert from "node:assert/strict";
import { bookPlanFindings } from "../src/application/book-strategy.js";
import { completePlot, completeStrategy, queueFixture } from "./phase4-fixtures.js";

test("a book plan requires at least one expectation decision", () => {
  const strategy = completeStrategy();
  strategy.expectation_map = [];
  assert.ok(bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).some((item) => item.code === "missing-expectation-map"));
});

test("moderate or strong friction clusters require explicit writer decisions", () => {
  const strategy = completeStrategy();
  strategy.reader_friction.clusters.push({
    id: "CLU-001",
    label: "Middle loses urgency",
    observation_ids: [],
    titles_affected: ["A", "B"],
    confidence: "moderate",
    positive_counterweights: [],
    decision: null,
    guardrail: null,
  });
  assert.ok(bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).some((item) => item.code === "missing-friction-decision"));
});

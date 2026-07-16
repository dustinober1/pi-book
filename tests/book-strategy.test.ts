import test from "node:test";
import assert from "node:assert/strict";
import { bookPlanFindings, renderApprovedBookGuardrails } from "../src/application/book-strategy.js";
import { completePlot, completeStrategy, queueFixture } from "./phase4-fixtures.js";

test("book approval requires a reader promise and approved expectation decisions", () => {
  const strategy = completeStrategy();
  strategy.reader_promise = { statement: "", required_experiences: [] };
  strategy.expectation_map[0]!.status = "draft";
  const codes = bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).map((item) => item.code);
  assert.ok(codes.includes("missing-reader-promise"));
  assert.ok(codes.includes("unapproved-expectation"));
});

test("all ten stress checks must be resolved with evidence", () => {
  const strategy = completeStrategy();
  strategy.plan_stress_test![0]!.status = "pending";
  strategy.plan_stress_test![1]!.evidence_refs = [];
  const codes = bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).map((item) => item.code);
  assert.ok(codes.includes("unresolved-stress-check"));
  assert.ok(codes.includes("stress-check-missing-evidence"));
});

test("accepted stress tradeoffs must reference a recorded tradeoff", () => {
  const strategy = completeStrategy();
  strategy.plan_stress_test![0] = { ...strategy.plan_stress_test![0]!, status: "accepted-tradeoff", tradeoff_id: "TRADE-404" };
  assert.ok(bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).some((item) => item.code === "missing-stress-tradeoff"));
});

test("approved book guardrails render only approved nonblank rules", () => {
  const strategy = completeStrategy();
  strategy.review_derived_guardrails.push({ id: "GR-002", rule: "unapproved", source_cluster_ids: [], status: "proposed" });
  const text = renderApprovedBookGuardrails(strategy);
  assert.match(text, /BOOK GUARDRAIL: preserve costly choices/);
  assert.doesNotMatch(text, /unapproved/);
});

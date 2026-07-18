import test from "node:test";
import assert from "node:assert/strict";
import { actBoundaryFindings, requiredMilestoneGate, resolveActBoundary, reviewChapterRange } from "../src/application/act-boundaries.js";
import type { PlotGridState } from "../src/domain/schemas.js";

function plot(overrides: Partial<PlotGridState> = {}): PlotGridState {
  return {
    schema_version: "1.0.0",
    acts: [
      { id: "ACT-1", purpose: "entry", start_chapter: 1, end_chapter: 6, gate: "act-1-review" },
      { id: "ACT-2", purpose: "pressure", start_chapter: 7, end_chapter: 12, gate: "midpoint-review" },
    ],
    chapters: [],
    ...overrides,
  };
}

test("plot-derived boundaries resolve milestone gates and review ranges", () => {
  assert.deepEqual(resolveActBoundary(plot(), 6), { actId: "ACT-1", startChapter: 1, endChapter: 6, gate: "act-1-review" });
  assert.equal(requiredMilestoneGate(plot(), 5), null);
  assert.equal(requiredMilestoneGate(plot(), 6), "act-1-review");
  assert.deepEqual(reviewChapterRange(plot(), "act", "act-1-review"), { startChapter: 1, endChapter: 6 });
});

test("invalid and overlapping act ranges are blockers", () => {
  const findings = actBoundaryFindings(plot({ acts: [
    { id: "ACT-1", purpose: "bad", start_chapter: 4, end_chapter: 2, gate: "act-1-review" },
    { id: "ACT-2", purpose: "overlap", start_chapter: 2, end_chapter: 8, gate: "act-1-review" },
  ] }));
  assert.ok(findings.some((item) => item.code === "invalid-act-range"));
  assert.ok(findings.some((item) => item.code === "overlapping-acts"));
  assert.ok(findings.some((item) => item.code === "duplicate-act-gate"));
});


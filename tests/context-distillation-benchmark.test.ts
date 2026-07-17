import test from "node:test";
import assert from "node:assert/strict";
import { runContextDistillationBenchmark } from "../src/evaluation/context-distillation-benchmark.js";

test("context benchmark is deterministic and covers all runtime profiles", () => {
  const first = runContextDistillationBenchmark();
  const second = runContextDistillationBenchmark();
  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => row.profile), ["tiny-local", "local", "full"]);
  assert.equal(first.allRequiredRetained, true);
  assert.equal(first.allWithinBudget, true);
});

test("context benchmark output contains aggregate metrics only", () => {
  const serialized = JSON.stringify(runContextDistillationBenchmark());
  assert.doesNotMatch(serialized, /PRIVATE-CONTEXT-SENTINEL/);
  assert.match(serialized, /sourceChars/);
  assert.match(serialized, /renderedChars/);
  assert.match(serialized, /requiredRetained/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { runPromptCompilerBenchmark } from "../src/evaluation/prompt-compiler-benchmark.js";

test("prompt compiler benchmark is deterministic and meets the compact threshold", () => {
  const first = runPromptCompilerBenchmark();
  const second = runPromptCompilerBenchmark();
  assert.deepEqual(first, second);
  assert.ok(first.scenarios.length >= 3);
  assert.equal(first.allPassed, true);
  for (const scenario of first.scenarios) {
    assert.ok(scenario.standardChars > scenario.compactChars, scenario.id);
    assert.ok(scenario.reductionPercent >= 30 || scenario.compactChars < 2_000, scenario.id);
    assert.equal(scenario.withinLocalBudget, true, scenario.id);
  }
});

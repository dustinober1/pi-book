import test from "node:test";
import assert from "node:assert/strict";
import { resolveJobPolicy, assertEvidenceWithinJobBudget } from "../src/application/job-budget-resolver.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";

test("draft-scene and extract-state-delta receive distinct policies", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  const draft = resolveJobPolicy(profile, "draft-scene");
  const delta = resolveJobPolicy(profile, "extract-state-delta");
  assert.ok(draft.budget.reservedOutputTokens > delta.budget.reservedOutputTokens);
  assert.ok(draft.decoding.temperature > delta.decoding.temperature);
});

test("evidence overflow stops before worker invocation", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  const maximum = resolveJobPolicy(profile, "extract-state-delta").budget.maximumEvidenceTokens;
  assert.throws(
    () => assertEvidenceWithinJobBudget(profile, "extract-state-delta", maximum + 1),
    /evidence exceeds/,
  );
});

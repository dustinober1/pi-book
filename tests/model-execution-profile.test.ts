import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_EXECUTION_PROFILES,
  parseModelExecutionProfileId,
} from "../src/domain/model-execution-profile.js";
import { resolveModelExecutionProfile } from "../src/application/model-execution-profile-resolver.js";

test("projects without a model execution profile resolve to host-default", () => {
  assert.equal(resolveModelExecutionProfile({}), MODEL_EXECUTION_PROFILES["host-default"]);
});

test("run override wins over project model execution profile", () => {
  const resolved = resolveModelExecutionProfile({
    runOverride: "small-12b-q4",
    projectProfile: "host-default",
  });
  assert.equal(resolved.id, "small-12b-q4");
  assert.equal(resolved.preferred_scene_words.maximum, 1100);
});

test("unknown model execution profiles fail deterministically", () => {
  assert.throws(() => parseModelExecutionProfileId("unknown"), /Unknown model execution profile/);
});

test("structured and drafting jobs use different decoding policies", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  assert.equal(profile.decoding["extract-state-delta"].temperature, 0);
  assert.ok(profile.decoding["draft-scene"].temperature > 0);
  assert.ok(profile.job_budgets["draft-scene"].reservedOutputTokens > profile.job_budgets["extract-state-delta"].reservedOutputTokens);
});

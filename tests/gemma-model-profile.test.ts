import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_EXECUTION_PROFILES,
  modelExecutionProfileDeprecationAdvisory,
  modelExecutionProfileIdsMatch,
} from "../src/domain/model-execution-profile.js";
import { resolveModelExecutionProfile } from "../src/application/model-execution-profile-resolver.js";

test("Gemma QAT profile is exact and conservative", () => {
  const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
  assert.equal(profile.reliable_context_tokens, 16_384);
  assert.equal(profile.maximum_output_tokens, 4_096);
  assert.deepEqual(profile.preferred_scene_words, { minimum: 700, maximum: 1_100 });
  assert.deepEqual(profile.capabilities, { json_schema: false, grammar: true, tool_calls: false });
  assert.deepEqual(profile.decoding["draft-scene"], {
    temperature: 0.65,
    topP: 0.9,
    maximumOutputTokens: 2_600,
    repetitionPenalty: 1.08,
    thinking: "off",
  });
  assert.deepEqual(profile.decoding["extract-state-delta"], {
    temperature: 0.05,
    topP: 0.2,
    maximumOutputTokens: 900,
    thinking: "off",
  });
});

test("small-12b-q4 resolves to the exact Gemma QAT profile", () => {
  assert.equal(resolveModelExecutionProfile({ project: "small-12b-q4" }).id, "gemma-3-12b-it-qat-q4_0");
});

test("legacy small-model artifact IDs remain compatible with the Gemma profile", () => {
  assert.equal(modelExecutionProfileIdsMatch("small-12b-q4", "gemma-3-12b-it-qat-q4_0"), true);
  assert.equal(modelExecutionProfileIdsMatch("small-12b-q4", "host-default"), false);
  assert.match(modelExecutionProfileDeprecationAdvisory("small-12b-q4") ?? "", /deprecated.*gemma-3-12b-it-qat-q4_0/i);
});

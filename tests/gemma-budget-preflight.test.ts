import test from "node:test";
import assert from "node:assert/strict";
import { assertModelJobFits } from "../src/application/model-token-estimator.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import { SCENE_CRITIC_JOB_TYPES } from "../src/domain/scene-critic-artifact.js";

test("Gemma draft preflight rejects total reserved context above 16384", () => {
  assert.throws(() => assertModelJobFits({
    instruction: "x".repeat(3_000),
    evidence: "y".repeat(45_000),
    profile: MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"],
    jobType: "draft-scene",
  }), /reliable context/i);
});

test("every Gemma critic preflight reserves its full configured output maximum", () => {
  const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
  for (const jobType of SCENE_CRITIC_JOB_TYPES) {
    const counts = assertModelJobFits({
      instruction: "critic instruction",
      evidence: "critic evidence",
      profile,
      jobType,
    });
    const budget = profile.job_budgets[jobType];
    const decoding = profile.decoding[jobType];
    assert.ok(budget.reservedOutputTokens >= decoding.maximumOutputTokens, jobType);
    assert.equal(
      counts.totalReservedTokens,
      counts.instructionTokens + counts.evidenceTokens + decoding.maximumOutputTokens + budget.safetyMarginTokens,
      jobType,
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { assertModelJobFits } from "../src/application/model-token-estimator.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";

test("Gemma draft preflight rejects total reserved context above 16384", () => {
  assert.throws(() => assertModelJobFits({
    instruction: "x".repeat(3_000),
    evidence: "y".repeat(45_000),
    profile: MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"],
    jobType: "draft-scene",
  }), /reliable context/i);
});

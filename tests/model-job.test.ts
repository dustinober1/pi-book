import test from "node:test";
import assert from "node:assert/strict";
import { resolveJobExecutionPolicy } from "../src/application/job-budget-resolver.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import { validateQualityWorkerRequest } from "../src/pi/quality-worker.js";

test("draft and extraction jobs receive different budgets and decoding policies", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  const draft = resolveJobExecutionPolicy({
    profile,
    jobType: "draft-scene",
    instructionTokens: 500,
    evidenceTokens: 2_000,
  });
  const extraction = resolveJobExecutionPolicy({
    profile,
    jobType: "extract-state-delta",
    instructionTokens: 500,
    evidenceTokens: 2_000,
  });
  assert.ok(draft.budget.reservedOutputTokens > extraction.budget.reservedOutputTokens);
  assert.ok(draft.decoding.temperature > extraction.decoding.temperature);
  assert.equal(draft.jobType, "draft-scene");
});

test("job policy rejects oversized evidence before worker invocation", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  assert.throws(() => resolveJobExecutionPolicy({
    profile,
    jobType: "extract-state-delta",
    instructionTokens: 500,
    evidenceTokens: profile.job_budgets["extract-state-delta"].maximumEvidenceTokens + 1,
  }), /evidence.*budget.*before inference/i);
});

test("quality worker requests carry an optional typed job during migration", () => {
  assert.doesNotThrow(() => validateQualityWorkerRequest({
    callId: "CALL-001",
    stage: "drafting",
    chapter: 1,
    pass: "candidate",
    jobType: "draft-scene",
    prompt: "Draft the scene.",
    timeoutMs: 1_000,
  }));
});

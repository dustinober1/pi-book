import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  createRunReportHeader,
  createRunReportV3Header,
  summarizeWorkflowTelemetry,
} from "../src/application/run-telemetry.js";
import {
  RunReportSchema,
  RunReportV2Schema,
  RunReportV3Schema,
  type ModelCallReport,
} from "../src/domain/run-report.js";
import { appendModelCallReport, storeRunReport } from "../src/infrastructure/run-report-store.js";

function call(overrides: Partial<ModelCallReport> = {}): ModelCallReport {
  return {
    callId: "CALL-001",
    stage: "small-model-drafting",
    chapter: 1,
    pass: "candidate",
    jobType: "draft-scene",
    sceneId: "SCN-001",
    attempt: 1,
    contractHash: "d".repeat(64),
    capsuleHash: "e".repeat(64),
    includedRecordCount: 12,
    validationCategoryCounts: {},
    patchOperationCount: 0,
    outcome: "accepted",
    acceptedProseWords: 800,
    inputTokens: 1_000,
    outputTokens: 1_600,
    estimated: false,
    elapsedMs: 10,
    promptHash: "a".repeat(64),
    contextHash: "b".repeat(64),
    outputHash: "c".repeat(64),
    ...overrides,
  };
}

test("schema one and two reports remain accepted beside schema three", () => {
  const v2 = createRunReportHeader({
    runId: "RUN-V2",
    runtimeProfile: "full",
    qualityTier: "premium",
    projectHashBefore: "before",
  });
  assert.equal(Value.Check(RunReportV2Schema, v2), true);
  assert.equal(Value.Check(RunReportSchema, v2), true);
  const v3 = createRunReportV3Header({
    runId: "RUN-V3",
    runtimeProfile: "tiny-local",
    qualityTier: "balanced",
    modelExecutionProfile: "small-12b-q4",
    projectHashBefore: "before",
  });
  assert.equal(v3.schemaVersion, "3.0.0");
  assert.equal(Value.Check(RunReportV3Schema, v3), true);
  assert.equal(Value.Check(RunReportSchema, v3), true);
});

test("schema three aggregates first-pass acceptance and accepted prose efficiency", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-v3-"));
  try {
    const header = createRunReportV3Header({
      runId: "RUN-V3-APPEND",
      runtimeProfile: "tiny-local",
      qualityTier: "balanced",
      modelExecutionProfile: "small-12b-q4",
      projectHashBefore: "before",
    });
    assert.equal(storeRunReport(root, header).ok, true);
    assert.equal(appendModelCallReport(root, header.runId, call()).ok, true);
    assert.equal(appendModelCallReport(root, header.runId, call({
      callId: "CALL-002",
      jobType: "patch-spans",
      pass: "revision",
      attempt: 2,
      outcome: "repair-succeeded",
      acceptedProseWords: 100,
      outputTokens: 400,
      outputHash: "f".repeat(64),
      patchOperationCount: 2,
    })).ok, true);
    const report = JSON.parse(readFileSync(join(root, ".pi-book", "runs", header.runId, "run-report.json"), "utf8"));
    assert.deepEqual(report.workflow, {
      jobs: 2,
      firstPassAccepted: 1,
      repairsAttempted: 1,
      repairsSucceeded: 1,
      acceptedProseWords: 900,
      acceptedWordsPerGeneratedToken: 0.45,
    });
    assert.deepEqual(summarizeWorkflowTelemetry(report.modelCalls), report.workflow);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("schema three rejects raw prompt or output content", () => {
  const report = createRunReportV3Header({
    runId: "RUN-PRIVATE",
    runtimeProfile: "local",
    qualityTier: "editorial",
    modelExecutionProfile: "small-12b-q4",
    projectHashBefore: "before",
  });
  assert.equal(Value.Check(RunReportV3Schema, { ...report, prompt: "RAW-PROMPT" }), false);
  assert.equal(Value.Check(RunReportV3Schema, { ...report, output: "RAW-OUTPUT" }), false);
});

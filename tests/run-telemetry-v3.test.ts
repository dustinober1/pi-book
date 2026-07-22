import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
import { appendModelCallReport, initializeRunReport, storeRunReport } from "../src/infrastructure/run-report-store.js";

function initializeInChild(root: string, report: unknown, releaseAt: number): Promise<{ ok: boolean; message?: string }> {
  const script = [
    'import { initializeRunReport } from "./src/infrastructure/run-report-store.js";',
    'const [root, encoded, release] = process.argv.slice(1);',
    'const sleeper = new Int32Array(new SharedArrayBuffer(4));',
    'while (Date.now() < Number(release)) Atomics.wait(sleeper, 0, 0, Math.min(20, Number(release) - Date.now()));',
    'process.stdout.write(JSON.stringify(initializeRunReport(root, JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")))));',
  ].join("\n");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e", script,
      root, Buffer.from(JSON.stringify(report), "utf8").toString("base64url"), String(releaseAt),
    ], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`Run-report initializer child failed (${code}): ${stderr}`));
      else resolve(JSON.parse(stdout) as { ok: boolean; message?: string });
    });
  });
}

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
      jobs: 1,
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

test("model-call escalation codes are privacy-safe machine identifiers", () => {
  assert.equal(Value.Check(RunReportV3Schema, {
    ...createRunReportV3Header({
      runId: "RUN-ESCALATION",
      runtimeProfile: "tiny-local",
      qualityTier: "balanced",
      modelExecutionProfile: "small-12b-q4",
      projectHashBefore: "before",
    }),
    modelCalls: [call({ outcome: "escalated", escalationCode: "schema-failure" })],
  }), true);
  assert.equal(Value.Check(RunReportV3Schema, {
    ...createRunReportV3Header({
      runId: "RUN-BAD-ESCALATION",
      runtimeProfile: "tiny-local",
      qualityTier: "balanced",
      modelExecutionProfile: "small-12b-q4",
      projectHashBefore: "before",
    }),
    modelCalls: [call({ outcome: "escalated", escalationCode: "Schema failure: raw output" })],
  }), false);
});

test("workflow job counts exclude correction attempts from the first-pass denominator", () => {
  assert.deepEqual(summarizeWorkflowTelemetry([
    call({ outcome: "rejected" }),
    call({ callId: "CALL-002", attempt: 2, outcome: "repair-succeeded", outputHash: "f".repeat(64) }),
  ]), {
    jobs: 1,
    firstPassAccepted: 0,
    repairsAttempted: 1,
    repairsSucceeded: 1,
    acceptedProseWords: 800,
    acceptedWordsPerGeneratedToken: 0.25,
  });
});

test("competing processes cannot both reserve the same run report", async () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-race-"));
  try {
    const report = createRunReportV3Header({
      runId: "RUN-RACE",
      runtimeProfile: "tiny-local",
      qualityTier: "balanced",
      modelExecutionProfile: "small-12b-q4",
      projectHashBefore: "before",
    });
    const releaseAt = Date.now() + 2_000;
    const results = await Promise.all([
      initializeInChild(root, report, releaseAt),
      initializeInChild(root, report, releaseAt),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && /already exists/i.test(result.message ?? "")).length, 1);
    assert.deepEqual(initializeRunReport(root, report), { ok: false, message: "Run report already exists." });
    const stored = JSON.parse(readFileSync(join(root, ".pi-book", "runs", report.runId, "run-report.json"), "utf8"));
    assert.equal(Value.Check(RunReportV3Schema, stored), true);
    assert.deepEqual(stored, report);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

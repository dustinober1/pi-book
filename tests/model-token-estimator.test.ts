import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertModelJobFits,
  estimateModelTokens,
  recordModelTokenCalibration,
} from "../src/application/model-token-estimator.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import { readTokenEstimatorRunReport } from "../src/infrastructure/token-estimator-report-store.js";

function appendCalibrationInChild(
  root: string,
  runId: string,
  callId: string,
  releaseAt: number,
  underflow: boolean,
): Promise<void> {
  const script = [
    'import { appendTokenEstimatorCalibration } from "./src/infrastructure/token-estimator-report-store.js";',
    "const [root, runId, callId, releaseAt, underflow] = process.argv.slice(1);",
    "const sleeper = new Int32Array(new SharedArrayBuffer(4));",
    "while (Date.now() < Number(releaseAt)) Atomics.wait(sleeper, 0, 0, Math.min(20, Number(releaseAt) - Date.now()));",
    "appendTokenEstimatorCalibration(root, runId, {",
    '  callId, policyId: "gemma-3-12b-it-qat-q4_0-v1", estimatedInstructionTokens: 100, estimatedEvidenceTokens: 900, totalReservedTokens: 2512,',
    '  actualInputTokens: underflow === "true" ? 1200 : 1000, inputTokenEstimateRatio: underflow === "true" ? 1.2 : 1,',
    '  ...(underflow === "true" ? { escalationCode: "token-estimator-underflow" } : {}),',
    "});",
  ].join("\n");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e", script,
      root, runId, callId, String(releaseAt), String(underflow),
    ], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `child exited ${code}`)));
  });
}

test("Gemma estimate uses UTF-8 bytes and a safety envelope", () => {
  const policy = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"].token_estimation;
  assert.equal(estimateModelTokens("a".repeat(3_000), policy), 1_064);
});

test("Gemma estimate counts multibyte UTF-8 bytes rather than JavaScript string length", () => {
  const policy = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"].token_estimation;
  assert.equal(estimateModelTokens("é".repeat(3), policy), 66);
});

test("actual input usage records a privacy-safe calibration ratio", () => {
  const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
  const counts = assertModelJobFits({
    instruction: "instruction",
    evidence: "evidence",
    profile,
    jobType: "plan-scene",
  });
  const calibration = recordModelTokenCalibration({
    runId: "RUN-CALIBRATION-SAFE",
    profile,
    counts,
    actualInputTokens: counts.instructionTokens + counts.evidenceTokens,
  });
  assert.deepEqual(calibration, {
    estimatedInstructionTokens: counts.instructionTokens,
    estimatedEvidenceTokens: counts.evidenceTokens,
    totalReservedTokens: counts.totalReservedTokens,
    inputTokenEstimateRatio: 1,
  });
  assert.equal(JSON.stringify(calibration).includes("instruction"), false);
  assert.equal(JSON.stringify(calibration).includes("evidence"), false);
});

test("an observed estimator underflow escalates and blocks later calls in the same run", () => {
  const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
  const first = assertModelJobFits({
    runId: "RUN-CALIBRATION-UNDERFLOW",
    instruction: "instruction",
    evidence: "evidence",
    profile,
    jobType: "plan-scene",
  });
  assert.throws(() => recordModelTokenCalibration({
    runId: "RUN-CALIBRATION-UNDERFLOW",
    profile,
    counts: first,
    actualInputTokens: Math.ceil((first.instructionTokens + first.evidenceTokens) * 1.11),
  }), /token estimator underflow/i);
  assert.throws(() => assertModelJobFits({
    runId: "RUN-CALIBRATION-UNDERFLOW",
    instruction: "next instruction",
    evidence: "next evidence",
    profile,
    jobType: "plan-scene",
  }), /token estimator underflow|blocked/i);
});

test("a privacy-safe underflow report blocks the same run after process restart", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-token-estimator-"));
  const runId = "RUN-DURABLE-UNDERFLOW";
  try {
    const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
    const counts = assertModelJobFits({
      root,
      runId,
      instruction: "PRIVATE-INSTRUCTION",
      evidence: "PRIVATE-EVIDENCE",
      profile,
      jobType: "plan-scene",
    });
    const actualInputTokens = Math.ceil((counts.instructionTokens + counts.evidenceTokens) * 1.11);
    assert.throws(() => recordModelTokenCalibration({
      root,
      runId,
      callId: "CALL-DURABLE-UNDERFLOW",
      profile,
      counts,
      actualInputTokens,
    }), /token estimator underflow/i);

    const reportPath = join(root, ".pi-book", "runs", runId, "token-estimator-report.json");
    const reportText = readFileSync(reportPath, "utf8");
    const report = JSON.parse(reportText) as {
      calibrations: Array<{ inputTokenEstimateRatio?: number; escalationCode?: string }>;
    };
    assert.equal(report.calibrations[0]?.escalationCode, "token-estimator-underflow");
    assert.ok((report.calibrations[0]?.inputTokenEstimateRatio ?? 0) > 1.10);
    assert.equal(reportText.includes("PRIVATE-INSTRUCTION"), false);
    assert.equal(reportText.includes("PRIVATE-EVIDENCE"), false);

    const script = [
      'import { assertModelJobFits } from "./src/application/model-token-estimator.js";',
      'import { MODEL_EXECUTION_PROFILES } from "./src/domain/model-execution-profile.js";',
      "const [root, runId] = process.argv.slice(1);",
      "try {",
      '  assertModelJobFits({ root, runId, instruction: "next", evidence: "next", profile: MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"], jobType: "plan-scene" });',
      '  process.stderr.write("preflight unexpectedly passed");',
      "  process.exitCode = 2;",
      "} catch (error) {",
      "  process.stdout.write(error instanceof Error ? error.message : String(error));",
      "}",
    ].join("\n");
    const child = spawnSync(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e", script, root, runId,
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /token estimator underflow|blocked/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent calibration appends preserve every call and the underflow latch", async () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-token-estimator-race-"));
  const runId = "RUN-CONCURRENT-CALIBRATION";
  try {
    const callIds = Array.from({ length: 8 }, (_, index) => `CALL-${index + 1}`);
    const releaseAt = Date.now() + 2_000;
    await Promise.all(callIds.map((callId, index) => appendCalibrationInChild(
      root,
      runId,
      callId,
      releaseAt,
      index === callIds.length - 1,
    )));
    const report = readTokenEstimatorRunReport(root, runId);
    assert.deepEqual(report?.calibrations.map((item) => item.callId).sort(), [...callIds].sort());
    assert.equal(report?.calibrations.some((item) => item.escalationCode === "token-estimator-underflow"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

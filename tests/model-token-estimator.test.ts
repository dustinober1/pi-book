import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertModelJobFits,
  estimateModelTokens,
  recordModelTokenCalibration,
} from "../src/application/model-token-estimator.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";

test("Gemma estimate uses UTF-8 bytes and a safety envelope", () => {
  const policy = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"].token_estimation;
  assert.equal(estimateModelTokens("a".repeat(3_000), policy), 1_064);
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
  const calibration = recordModelTokenCalibration({
    runId: "RUN-CALIBRATION-UNDERFLOW",
    profile,
    counts: first,
    actualInputTokens: Math.ceil((first.instructionTokens + first.evidenceTokens) * 1.11),
  });
  assert.equal(calibration.escalationCode, "token-estimator-underflow");
  assert.equal(calibration.outcome, "escalated");
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
    recordModelTokenCalibration({
      root,
      runId,
      callId: "CALL-DURABLE-UNDERFLOW",
      profile,
      counts,
      actualInputTokens,
    });

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

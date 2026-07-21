import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { createRunReportHeader } from "../src/application/run-telemetry.js";
import { RunReportSchema, RunReportV2Schema, type ModelCallReport } from "../src/domain/run-report.js";
import { appendModelCallReport, storeRunReport } from "../src/infrastructure/run-report-store.js";

function call(overrides: Partial<ModelCallReport> = {}): ModelCallReport {
  return {
    callId: "CALL-001",
    stage: "drafting",
    chapter: 1,
    pass: "candidate",
    provider: "provider",
    model: "model",
    inputTokens: 1_000,
    cachedInputTokens: 200,
    outputTokens: 500,
    reasoningTokens: 100,
    estimated: false,
    costUsd: 0.01,
    elapsedMs: 125,
    finishReason: "stop",
    promptHash: "a".repeat(64),
    contextHash: "b".repeat(64),
    outputHash: "c".repeat(64),
    ...overrides,
  };
}

test("schema two run headers contain no fake model call or zero-context measurement", () => {
  const report = createRunReportHeader({
    runId: "RUN-002",
    runtimeProfile: "full",
    qualityTier: "premium",
    projectHashBefore: "before-hash",
  });
  assert.equal(report.schemaVersion, "2.0.0");
  assert.equal(report.qualityTier, "premium");
  assert.deepEqual(report.modelCalls, []);
  assert.deepEqual(report.totals, {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    estimatedCalls: 0,
  });
  assert.equal("promptChars" in report, false);
  assert.equal("contextChars" in report, false);
  assert.equal(Value.Check(RunReportV2Schema, report), true);
  assert.equal(Value.Check(RunReportSchema, report), true);
});

test("model calls append atomically and recompute token and cost aggregates", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-v2-"));
  try {
    const header = createRunReportHeader({
      runId: "RUN-APPEND",
      runtimeProfile: "local",
      qualityTier: "editorial",
      projectHashBefore: "before",
    });
    assert.equal(storeRunReport(root, header).ok, true);
    assert.equal(appendModelCallReport(root, "RUN-APPEND", call()).ok, true);
    assert.equal(appendModelCallReport(root, "RUN-APPEND", call({
      callId: "CALL-002",
      pass: "critic",
      inputTokens: 400,
      cachedInputTokens: undefined,
      outputTokens: 100,
      reasoningTokens: undefined,
      estimated: true,
      costUsd: undefined,
      outputHash: "d".repeat(64),
    })).ok, true);

    const path = join(root, ".pi-book", "runs", "RUN-APPEND", "run-report.json");
    const report = JSON.parse(readFileSync(path, "utf8")) as ReturnType<typeof createRunReportHeader>;
    assert.equal(report.modelCalls.length, 2);
    assert.deepEqual(report.totals, {
      inputTokens: 1_400,
      cachedInputTokens: 200,
      outputTokens: 600,
      reasoningTokens: 100,
      totalTokens: 2_000,
      costUsd: 0.01,
      estimatedCalls: 1,
    });
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", "RUN-APPEND")), ["run-report.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("append failures remain sanitized and never echo model content", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-v2-failure-"));
  try {
    const result = appendModelCallReport(root, "RUN-MISSING", call({
      finishReason: "RAW-OUTPUT-SENTINEL",
    }));
    assert.deepEqual(result, { ok: false, message: "Unable to update the local run report." });
    assert.equal(JSON.stringify(result).includes("RAW-OUTPUT-SENTINEL"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

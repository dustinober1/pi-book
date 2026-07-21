import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ForegroundEconomyTelemetry } from "../src/application/foreground-economy-telemetry.js";
import { readBudgetLedger } from "../src/infrastructure/budget-ledger-store.js";

function assistant(overrides: Record<string, unknown> = {}) {
  return {
    role: "assistant",
    content: [{ type: "thinking", thinking: "PRIVATE-THINKING-SENTINEL" }, { type: "text", text: "FINAL-OUTPUT-SENTINEL" }],
    provider: "fake",
    model: "economy-model",
    usage: {
      input: 700,
      cacheRead: 100,
      cacheWrite: 20,
      output: 200,
      reasoning: 50,
      cost: { total: 0.003 },
    },
    stopReason: "stop",
    ...overrides,
  };
}

test("foreground economy turns hash transient content and record actual usage in reports and ledger", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-economy-telemetry-"));
  let now = 1_000;
  try {
    const tracker = new ForegroundEconomyTelemetry({ now: () => now, runId: () => "ECO-TEST" });
    assert.equal(tracker.begin({ root, chapter: 3, runtimeProfile: "local" }), "ECO-TEST");
    tracker.capturePrompt("RAW-PROMPT-SENTINEL");
    tracker.captureModel({ provider: "selected-provider", id: "selected-model" });
    now = 1_125;
    tracker.complete(assistant(), { tokens: 1_500, contextWindow: 128_000, percent: 1.17 });
    assert.equal(tracker.active, false);

    const reportText = readFileSync(join(root, ".pi-book", "runs", "ECO-TEST", "run-report.json"), "utf8");
    const report = JSON.parse(reportText) as { modelCalls: Array<Record<string, unknown>>; totals: { totalTokens: number; costUsd: number } };
    assert.equal(report.modelCalls.length, 1);
    assert.equal(report.modelCalls[0]?.inputTokens, 820);
    assert.equal(report.modelCalls[0]?.cachedInputTokens, 100);
    assert.equal(report.modelCalls[0]?.outputTokens, 200);
    assert.equal(report.modelCalls[0]?.reasoningTokens, 50);
    assert.equal(report.modelCalls[0]?.provider, "fake");
    assert.equal(report.modelCalls[0]?.model, "economy-model");
    assert.equal(report.modelCalls[0]?.elapsedMs, 125);
    assert.equal(report.totals.totalTokens, 1_020);
    assert.equal(report.totals.costUsd, 0.003);
    for (const sentinel of ["RAW-PROMPT-SENTINEL", "FINAL-OUTPUT-SENTINEL", "PRIVATE-THINKING-SENTINEL"]) {
      assert.equal(reportText.includes(sentinel), false);
    }

    const ledger = readBudgetLedger(root);
    assert.equal(ledger.settledCalls.length, 1);
    assert.equal(ledger.settledCalls[0]?.tokens, 1_020);
    assert.equal(ledger.settledCalls[0]?.tier, "economy");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("context usage supplies a marked estimate when provider usage is incomplete", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-economy-estimate-"));
  try {
    const tracker = new ForegroundEconomyTelemetry({ now: () => 2_000, runId: () => "ECO-ESTIMATE" });
    tracker.begin({ root, chapter: 1, runtimeProfile: "full" });
    tracker.capturePrompt("prompt");
    tracker.complete(assistant({ usage: { output: 40 } }), { tokens: 600, contextWindow: 128_000, percent: 0.5 });
    const report = JSON.parse(readFileSync(join(root, ".pi-book", "runs", "ECO-ESTIMATE", "run-report.json"), "utf8")) as { modelCalls: Array<{ inputTokens: number; outputTokens: number; estimated: boolean }> };
    assert.equal(report.modelCalls[0]?.inputTokens, 600);
    assert.equal(report.modelCalls[0]?.outputTokens, 40);
    assert.equal(report.modelCalls[0]?.estimated, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("telemetry opt-out and cancellation do not record model calls", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-economy-optout-"));
  try {
    const tracker = new ForegroundEconomyTelemetry({ runId: () => "ECO-OFF" });
    assert.equal(tracker.begin({ root, chapter: 1, runtimeProfile: "full", telemetryEnabled: false }), null);
    tracker.complete(assistant(), { tokens: 100, contextWindow: 1_000, percent: 10 });
    assert.equal(tracker.active, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

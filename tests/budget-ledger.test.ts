import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyBudgetLedger,
  releaseBudgetReservation,
  reserveBudget,
  settleBudgetReservation,
  type BudgetLedger,
} from "../src/application/budget-ledger.js";
import { readBudgetLedger, updateBudgetLedger } from "../src/infrastructure/budget-ledger-store.js";
import { createRunReportHeader } from "../src/application/run-telemetry.js";
import { appendModelCallReport, storeRunReport } from "../src/infrastructure/run-report-store.js";

const limits = {
  maximumTotalTokens: 1_000,
  maximumTokensPerChapter: 800,
  maximumCallsPerChapter: 2,
  onExhaustion: "downgrade" as const,
};

function reserve(ledger: BudgetLedger, callId: string, chapter: number, minimumTokens: number) {
  return reserveBudget(ledger, {
    reservationId: `RSV-${callId}`,
    runId: "RUN-001",
    callId,
    chapter,
    tier: "premium",
    minimumTokens,
    limits,
    createdAt: "2026-07-21T14:00:00Z",
  });
}

test("reservations include active capacity, settlement replaces estimates, and release restores capacity", () => {
  let ledger = emptyBudgetLedger();
  const first = reserve(ledger, "CALL-001", 1, 600);
  assert.equal(first.result.action, "reserved");
  ledger = first.ledger;

  const chapterOverflow = reserve(ledger, "CALL-002", 1, 300);
  assert.deepEqual(chapterOverflow.result, {
    action: "downgrade",
    reason: "chapter-token-limit",
    fromTier: "premium",
    toTier: "balanced",
  });
  assert.equal(chapterOverflow.ledger.reservations.length, 1);
  assert.equal(chapterOverflow.ledger.events.at(-1)?.type, "downgrade");

  ledger = settleBudgetReservation(ledger, "RSV-CALL-001", {
    runId: "RUN-001",
    callId: "CALL-001",
    chapter: 1,
    tier: "premium",
    actualTokens: 450,
    estimated: false,
    settledAt: "2026-07-21T14:01:00Z",
  });
  assert.equal(ledger.reservations.length, 0);
  assert.equal(ledger.settledCalls[0]?.tokens, 450);

  const second = reserve(ledger, "CALL-002", 1, 300);
  assert.equal(second.result.action, "reserved");
  ledger = releaseBudgetReservation(second.ledger, "RSV-CALL-002");
  assert.equal(ledger.reservations.length, 0);

  assert.throws(() => settleBudgetReservation(ledger, "RSV-MISSING", {
    runId: "RUN-001", callId: "CALL-X", chapter: 1, tier: "premium", actualTokens: 1, estimated: true, settledAt: "now",
  }), /reservation/i);
});

test("total and call ceilings cannot be exceeded by multiple live reservations", () => {
  let ledger = emptyBudgetLedger();
  ledger = reserve(ledger, "CALL-001", 1, 500).ledger;
  ledger = reserve(ledger, "CALL-002", 2, 400).ledger;
  const total = reserve(ledger, "CALL-003", 3, 200);
  assert.equal(total.result.action, "downgrade");
  assert.equal(total.result.reason, "total-token-limit");

  let calls = emptyBudgetLedger();
  calls = reserve(calls, "CALL-001", 1, 10).ledger;
  calls = reserve(calls, "CALL-002", 1, 10).ledger;
  const callOverflow = reserve(calls, "CALL-003", 1, 10);
  assert.equal(callOverflow.result.reason, "chapter-call-limit");
});

test("missing local ledgers reconstruct settled calls from valid schema-two reports", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-budget-ledger-"));
  try {
    const report = createRunReportHeader({ runId: "RUN-REBUILD", runtimeProfile: "full", qualityTier: "premium", projectHashBefore: "before" });
    assert.equal(storeRunReport(root, report).ok, true);
    assert.equal(appendModelCallReport(root, "RUN-REBUILD", {
      callId: "CALL-001", stage: "drafting", chapter: 3, pass: "candidate", inputTokens: 120, outputTokens: 80,
      estimated: false, elapsedMs: 1, promptHash: "a".repeat(64), contextHash: "b".repeat(64), outputHash: "c".repeat(64),
    }).ok, true);
    const rebuilt = readBudgetLedger(root);
    assert.equal(rebuilt.settledCalls.length, 1);
    assert.equal(rebuilt.settledCalls[0]?.tokens, 200);
    assert.equal(rebuilt.settledCalls[0]?.chapter, 3);

    const result = updateBudgetLedger(root, (current) => ({ ...current, updatedAt: "2026-07-21T14:02:00Z" }));
    assert.equal(result.ok, true);
    assert.equal(JSON.parse(readFileSync(join(root, ".pi-book", "runs", "budget-ledger.json"), "utf8")).updatedAt, "2026-07-21T14:02:00Z");

    mkdirSync(join(root, ".pi-book", "runs", ".budget-ledger.lock"));
    assert.deepEqual(updateBudgetLedger(root, (current) => current), { ok: false, message: "Unable to update the local budget ledger." });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

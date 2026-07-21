import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { BudgetLedgerSchema, emptyBudgetLedger, type BudgetLedger } from "../application/budget-ledger.js";
import { RunReportV2Schema, type RunReportV2 } from "../domain/run-report.js";

export type BudgetLedgerStoreResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

export type BudgetLedgerTransactionResult<T> =
  | { ok: true; path: string; value: T }
  | { ok: false; message: string };

function runsDirectory(root: string): string {
  return join(root, ".pi-book", "runs");
}

function ledgerPath(root: string): string {
  return join(runsDirectory(root), "budget-ledger.json");
}

function reconstructBudgetLedger(root: string): BudgetLedger {
  const ledger = emptyBudgetLedger("reconstructed");
  const directory = runsDirectory(root);
  if (!existsSync(directory)) return ledger;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name, "run-report.json");
    if (!existsSync(path)) continue;
    try {
      const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!Value.Check(RunReportV2Schema, value)) continue;
      const report = value as RunReportV2;
      for (const call of report.modelCalls) {
        if (call.chapter === undefined) continue;
        ledger.settledCalls.push({
          runId: report.runId,
          callId: call.callId,
          chapter: call.chapter,
          tier: report.qualityTier,
          tokens: (call.inputTokens ?? 0) + (call.outputTokens ?? 0),
          estimated: call.estimated,
          settledAt: "reconstructed",
        });
      }
      for (const event of report.budgetEvents) {
        if (!event.atCallId || !["total-token-limit", "chapter-token-limit", "chapter-call-limit"].includes(event.reason)) continue;
        const call = report.modelCalls.find((item) => item.callId === event.atCallId);
        if (call?.chapter === undefined) continue;
        ledger.events.push({
          type: event.type,
          runId: report.runId,
          callId: event.atCallId,
          chapter: call.chapter,
          reason: event.reason as "total-token-limit" | "chapter-token-limit" | "chapter-call-limit",
          fromTier: report.qualityTier,
          at: "reconstructed",
        });
      }
    } catch {
      // Invalid local reports are ignored during reconstruction.
    }
  }
  return ledger;
}

export function readBudgetLedger(root: string): BudgetLedger {
  const path = ledgerPath(root);
  if (!existsSync(path)) return reconstructBudgetLedger(root);
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Value.Check(BudgetLedgerSchema, value)) throw new Error("Invalid local budget ledger.");
  return value as BudgetLedger;
}

function writeBudgetLedger(root: string, ledger: BudgetLedger): BudgetLedgerStoreResult {
  const directory = runsDirectory(root);
  const path = ledgerPath(root);
  const temporary = join(directory, `.budget-ledger.${process.pid}.${randomUUID()}.tmp`);
  try {
    if (!Value.Check(BudgetLedgerSchema, ledger)) throw new Error("invalid budget ledger");
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return { ok: true, path };
  } catch {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    return { ok: false, message: "Unable to update the local budget ledger." };
  }
}

export function transactBudgetLedger<T>(
  root: string,
  update: (ledger: BudgetLedger) => { ledger: BudgetLedger; value: T },
): BudgetLedgerTransactionResult<T> {
  const directory = runsDirectory(root);
  const lock = join(directory, ".budget-ledger.lock");
  try {
    mkdirSync(directory, { recursive: true });
    mkdirSync(lock);
  } catch {
    return { ok: false, message: "Unable to update the local budget ledger." };
  }
  try {
    const transaction = update(readBudgetLedger(root));
    const stored = writeBudgetLedger(root, transaction.ledger);
    return stored.ok ? { ok: true, path: stored.path, value: transaction.value } : stored;
  } catch {
    return { ok: false, message: "Unable to update the local budget ledger." };
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function updateBudgetLedger(root: string, update: (ledger: BudgetLedger) => BudgetLedger): BudgetLedgerStoreResult {
  const result = transactBudgetLedger(root, (ledger) => ({ ledger: update(ledger), value: undefined }));
  return result.ok ? { ok: true, path: result.path } : result;
}

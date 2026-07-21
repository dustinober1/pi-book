import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  ModelCallReportSchema,
  RunBudgetEventSchema,
  RunReportV2Schema,
  RunReportV3Schema,
  summarizeWorkflowTelemetry,
  type ModelCallReport,
  type RunBudgetEvent,
  type RunReport,
  type RunReportV2,
  type RunReportV3,
  type RunTokenTotals,
} from "../domain/run-report.js";

export type RunReportStoreResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId);
}

function reportPath(root: string, runId: string): string {
  return join(root, ".pi-book", "runs", runId, "run-report.json");
}

export function storeRunReport(root: string, report: RunReport): RunReportStoreResult {
  if (!safeRunId(report.runId)) return { ok: false, message: "Unable to write the local run report." };
  const directory = join(root, ".pi-book", "runs", report.runId);
  const path = join(directory, "run-report.json");
  const temporary = join(directory, `.run-report.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return { ok: true, path };
  } catch {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    return { ok: false, message: "Unable to write the local run report." };
  }
}

function recomputeTotals(calls: readonly ModelCallReport[]): RunTokenTotals {
  return calls.reduce<RunTokenTotals>((totals, call) => ({
    inputTokens: totals.inputTokens + (call.inputTokens ?? 0),
    cachedInputTokens: totals.cachedInputTokens + (call.cachedInputTokens ?? 0),
    outputTokens: totals.outputTokens + (call.outputTokens ?? 0),
    reasoningTokens: totals.reasoningTokens + (call.reasoningTokens ?? 0),
    totalTokens: totals.totalTokens + (call.inputTokens ?? 0) + (call.outputTokens ?? 0),
    costUsd: totals.costUsd + (call.costUsd ?? 0),
    estimatedCalls: totals.estimatedCalls + Number(call.estimated),
  }), {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    estimatedCalls: 0,
  });
}

function readAppendableReport(path: string): RunReportV2 | RunReportV3 {
  const report = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (Value.Check(RunReportV3Schema, report)) return report as RunReportV3;
  if (Value.Check(RunReportV2Schema, report)) return report as RunReportV2;
  throw new Error("appendable run report required");
}

export function appendModelCallReport(root: string, runId: string, call: ModelCallReport): RunReportStoreResult {
  if (!safeRunId(runId)) return { ok: false, message: "Unable to update the local run report." };
  const path = reportPath(root, runId);
  try {
    if (!Value.Check(ModelCallReportSchema, call)) throw new Error("invalid model call report");
    const current = readAppendableReport(path);
    if (current.runId !== runId || current.modelCalls.some((item) => item.callId === call.callId)) throw new Error("invalid append target");
    const modelCalls = [...current.modelCalls, call];
    const updated: RunReportV2 | RunReportV3 = current.schemaVersion === "3.0.0"
      ? {
          ...current,
          modelCalls,
          totals: recomputeTotals(modelCalls),
          workflow: summarizeWorkflowTelemetry(modelCalls),
        }
      : {
          ...current,
          modelCalls,
          totals: recomputeTotals(modelCalls),
        };
    const result = storeRunReport(root, updated);
    return result.ok ? result : { ok: false, message: "Unable to update the local run report." };
  } catch {
    return { ok: false, message: "Unable to update the local run report." };
  }
}

export function appendRunBudgetEvent(root: string, runId: string, event: RunBudgetEvent): RunReportStoreResult {
  if (!safeRunId(runId)) return { ok: false, message: "Unable to update the local run report." };
  const path = reportPath(root, runId);
  try {
    if (!Value.Check(RunBudgetEventSchema, event)) throw new Error("invalid budget event");
    const current = readAppendableReport(path);
    if (current.runId !== runId) throw new Error("invalid append target");
    const updated: RunReportV2 | RunReportV3 = { ...current, budgetEvents: [...current.budgetEvents, event] };
    const result = storeRunReport(root, updated);
    return result.ok ? result : { ok: false, message: "Unable to update the local run report." };
  } catch {
    return { ok: false, message: "Unable to update the local run report." };
  }
}

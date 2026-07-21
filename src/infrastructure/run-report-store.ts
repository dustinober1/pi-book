import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ModelCallReportSchema, RunReportV2Schema, type ModelCallReport, type RunReport, type RunReportV2 } from "../domain/run-report.js";

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

function recomputeTotals(calls: readonly ModelCallReport[]): RunReportV2["totals"] {
  return calls.reduce<RunReportV2["totals"]>((totals, call) => ({
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

export function appendModelCallReport(root: string, runId: string, call: ModelCallReport): RunReportStoreResult {
  if (!safeRunId(runId)) return { ok: false, message: "Unable to update the local run report." };
  const path = reportPath(root, runId);
  try {
    if (!Value.Check(ModelCallReportSchema, call)) throw new Error("invalid model call report");
    const report = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Value.Check(RunReportV2Schema, report)) throw new Error("schema-two run report required");
    const current = report as RunReportV2;
    if (current.runId !== runId || current.modelCalls.some((item) => item.callId === call.callId)) throw new Error("invalid append target");
    const modelCalls = [...current.modelCalls, call];
    const updated: RunReportV2 = {
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

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunReport } from "../domain/run-report.js";

export type RunReportStoreResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId);
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

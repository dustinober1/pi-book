import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface TokenEstimatorCalibrationRecord {
  callId: string;
  policyId: string;
  estimatedInstructionTokens: number;
  estimatedEvidenceTokens: number;
  totalReservedTokens: number;
  actualInputTokens?: number;
  inputTokenEstimateRatio?: number;
  escalationCode?: "token-estimator-underflow";
}

interface TokenEstimatorRunReport {
  schemaVersion: "1.0.0";
  runId: string;
  calibrations: TokenEstimatorCalibrationRecord[];
}

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId);
}

function reportPath(root: string, runId: string): string {
  return join(root, ".pi-book", "runs", runId, "token-estimator-report.json");
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function calibrationValid(value: unknown): value is TokenEstimatorCalibrationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "callId",
    "policyId",
    "estimatedInstructionTokens",
    "estimatedEvidenceTokens",
    "totalReservedTokens",
    "actualInputTokens",
    "inputTokenEstimateRatio",
    "escalationCode",
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) return false;
  return typeof record.callId === "string"
    && record.callId.length > 0
    && typeof record.policyId === "string"
    && record.policyId.length > 0
    && nonnegativeInteger(record.estimatedInstructionTokens)
    && nonnegativeInteger(record.estimatedEvidenceTokens)
    && nonnegativeInteger(record.totalReservedTokens)
    && (record.actualInputTokens === undefined || nonnegativeInteger(record.actualInputTokens))
    && (record.inputTokenEstimateRatio === undefined
      || (typeof record.inputTokenEstimateRatio === "number"
        && Number.isFinite(record.inputTokenEstimateRatio)
        && record.inputTokenEstimateRatio >= 0))
    && (record.escalationCode === undefined || record.escalationCode === "token-estimator-underflow");
}

function reportValid(value: unknown, runId: string): value is TokenEstimatorRunReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  return Object.keys(report).every((key) => ["schemaVersion", "runId", "calibrations"].includes(key))
    && report.schemaVersion === "1.0.0"
    && report.runId === runId
    && Array.isArray(report.calibrations)
    && report.calibrations.every(calibrationValid);
}

export function readTokenEstimatorRunReport(root: string, runId: string): TokenEstimatorRunReport | null {
  if (!safeRunId(runId)) throw new Error("Unable to read token estimator run telemetry.");
  const path = reportPath(root, runId);
  if (!existsSync(path)) return null;
  try {
    const report = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!reportValid(report, runId)) throw new Error("invalid token estimator report");
    return report;
  } catch {
    throw new Error("Unable to read token estimator run telemetry.");
  }
}

export function appendTokenEstimatorCalibration(
  root: string,
  runId: string,
  calibration: TokenEstimatorCalibrationRecord,
): void {
  if (!safeRunId(runId) || !calibrationValid(calibration)) {
    throw new Error("Unable to record token estimator run telemetry.");
  }
  const current = readTokenEstimatorRunReport(root, runId) ?? {
    schemaVersion: "1.0.0",
    runId,
    calibrations: [],
  };
  const existing = current.calibrations.find((item) => item.callId === calibration.callId);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(calibration)) return;
    throw new Error("Unable to record token estimator run telemetry.");
  }
  const updated: TokenEstimatorRunReport = {
    ...current,
    calibrations: [...current.calibrations, calibration],
  };
  const directory = join(root, ".pi-book", "runs", runId);
  const path = reportPath(root, runId);
  const temporary = join(directory, `.token-estimator-report.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
  } catch {
    throw new Error("Unable to record token estimator run telemetry.");
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

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

interface ReportLockOwner {
  pid: number;
  token: string;
  acquiredAtMs: number;
  leaseExpiresAtMs: number;
}

const LOCK_LEASE_MS = 30_000;
const OWNER_TOKEN = /^[a-f0-9]{32}$/;

type ReportLockOwnerSnapshot =
  | { kind: "valid"; owner: ReportLockOwner; signature: string }
  | { kind: "missing"; signature: "missing" }
  | { kind: "invalid"; signature: string };

interface RecoveryClaim {
  path: string;
  owner: ReportLockOwner;
  stalePath?: string;
}

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId);
}

function reportPath(root: string, runId: string): string {
  return join(root, ".pi-book", "runs", runId, "token-estimator-report.json");
}

function lockConflict(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST" || code === "ENOTEMPTY" || code === "EISDIR";
}

function processIsLive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error;
  }
}

function parseLockOwner(value: unknown): ReportLockOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Token estimator report lock owner is invalid.");
  }
  const owner = value as Record<string, unknown>;
  const keys = Object.keys(owner).sort();
  if (keys.join(",") !== "acquiredAtMs,leaseExpiresAtMs,pid,token"
    || !Number.isSafeInteger(owner.pid)
    || Number(owner.pid) <= 0
    || typeof owner.token !== "string"
    || !OWNER_TOKEN.test(owner.token)
    || !Number.isSafeInteger(owner.acquiredAtMs)
    || Number(owner.acquiredAtMs) < 0
    || !Number.isSafeInteger(owner.leaseExpiresAtMs)
    || Number(owner.leaseExpiresAtMs) <= Number(owner.acquiredAtMs)) {
    throw new Error("Token estimator report lock owner is invalid.");
  }
  return {
    pid: Number(owner.pid),
    token: owner.token,
    acquiredAtMs: Number(owner.acquiredAtMs),
    leaseExpiresAtMs: Number(owner.leaseExpiresAtMs),
  };
}

function readLockOwnerSnapshot(path: string): ReportLockOwnerSnapshot {
  let serialized: string;
  try {
    serialized = readFileSync(join(path, "owner.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing", signature: "missing" };
    throw new Error("Token estimator report lock owner is unreadable.");
  }
  try {
    return { kind: "valid", owner: parseLockOwner(JSON.parse(serialized) as unknown), signature: serialized };
  } catch {
    return { kind: "invalid", signature: serialized };
  }
}

function readLockOwner(path: string): ReportLockOwner {
  const snapshot = readLockOwnerSnapshot(path);
  if (snapshot.kind !== "valid") throw new Error("Token estimator report lock owner is unreadable.");
  return snapshot.owner;
}

function sameOwner(left: ReportLockOwner, right: ReportLockOwner): boolean {
  return left.pid === right.pid
    && left.token === right.token
    && left.acquiredAtMs === right.acquiredAtMs
    && left.leaseExpiresAtMs === right.leaseExpiresAtMs;
}

function sameOwnerSnapshot(left: ReportLockOwnerSnapshot, right: ReportLockOwnerSnapshot): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "valid" && right.kind === "valid") return sameOwner(left.owner, right.owner);
  return left.signature === right.signature;
}

function newLockOwner(): ReportLockOwner {
  const acquiredAtMs = Date.now();
  return {
    pid: process.pid,
    token: randomUUID().replace(/-/g, ""),
    acquiredAtMs,
    leaseExpiresAtMs: acquiredAtMs + LOCK_LEASE_MS,
  };
}

function writeOwnerDirectory(path: string, owner: ReportLockOwner): void {
  mkdirSync(path);
  try {
    writeFileSync(join(path, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    rmSync(path, { recursive: true, force: true });
    throw error;
  }
}

function waitForReportLockRetry(sleeper: Int32Array, deadline: number): void {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Unable to record token estimator run telemetry.");
  Atomics.wait(sleeper, 0, 0, Math.min(10, remaining));
}

function snapshotCanBeReclaimed(snapshot: ReportLockOwnerSnapshot): boolean {
  return snapshot.kind !== "valid"
    || (!processIsLive(snapshot.owner.pid) && Date.now() >= snapshot.owner.leaseExpiresAtMs);
}

function releaseRecoveryClaim(claim: RecoveryClaim): void {
  const current = readLockOwnerSnapshot(claim.path);
  if (current.kind !== "valid" || !sameOwner(current.owner, claim.owner)) return;
  const released = `${claim.path}.released-${claim.owner.token}`;
  try {
    renameSync(claim.path, released);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const displaced = readLockOwner(released);
  if (!sameOwner(displaced, claim.owner)) {
    throw new Error("Token estimator report reclaim claim changed during release.");
  }
  rmSync(released, { recursive: true, force: true });
  if (claim.stalePath) rmSync(claim.stalePath, { recursive: true, force: true });
}

function acquireRecoveryClaim(
  directory: string,
  lock: string,
  claimName: string,
  sleeper: Int32Array,
  deadline: number,
): RecoveryClaim | null {
  const claim = join(lock, claimName);
  for (;;) {
    waitForReportLockRetry(sleeper, deadline);
    const owner = newLockOwner();
    const candidate = join(directory, `.token-estimator-report-reclaim-candidate-${owner.token}`);
    writeOwnerDirectory(candidate, owner);
    try {
      try {
        renameSync(candidate, claim);
        return { path: claim, owner };
      } catch (error) {
        if (!lockConflict(error)) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            if (!existsSync(lock)) return null;
            waitForReportLockRetry(sleeper, deadline);
            continue;
          }
          throw new Error("Unable to record token estimator run telemetry.");
        }
      }

      const existing = readLockOwnerSnapshot(claim);
      if (existing.kind === "valid"
        && (processIsLive(existing.owner.pid) || Date.now() < existing.owner.leaseExpiresAtMs)) {
        waitForReportLockRetry(sleeper, deadline);
        continue;
      }
      const staleName = existing.kind === "valid"
        ? `.stale-reclaim-v2-${existing.owner.token}`
        : ".stale-reclaim-v2-malformed";
      const stale = join(lock, staleName);
      try {
        renameSync(claim, stale);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || lockConflict(error)) {
          if (code === "ENOENT" && !existsSync(lock)) return null;
          waitForReportLockRetry(sleeper, deadline);
          continue;
        }
        throw new Error("Unable to record token estimator run telemetry.");
      }
      const displaced = readLockOwnerSnapshot(stale);
      if (!sameOwnerSnapshot(displaced, existing)) {
        throw new Error("Token estimator report reclaim claim changed during recovery.");
      }
      try {
        renameSync(candidate, claim);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || lockConflict(error)) {
          waitForReportLockRetry(sleeper, deadline);
          continue;
        }
        throw new Error("Unable to record token estimator run telemetry.");
      }
      const acquired = readLockOwner(claim);
      if (!sameOwner(acquired, owner)) {
        throw new Error("Token estimator report reclaim claim changed during acquisition.");
      }
      return { path: claim, owner, stalePath: stale };
    } finally {
      rmSync(candidate, { recursive: true, force: true });
    }
  }
}

function acquireReportLock(directory: string): ReportLockOwner {
  const lock = join(directory, ".token-estimator-report.lock");
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 10_000;
  mkdirSync(directory, { recursive: true });
  const owner = newLockOwner();
  const candidate = join(directory, `.token-estimator-report-lock-candidate-${owner.token}`);
  writeOwnerDirectory(candidate, owner);
  try {
    for (;;) {
      if (Date.now() >= deadline) throw new Error("Unable to record token estimator run telemetry.");
      try {
        renameSync(candidate, lock);
        return owner;
      } catch (error) {
        if (!lockConflict(error)) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT" && !existsSync(lock)) {
            waitForReportLockRetry(sleeper, deadline);
            continue;
          }
          throw new Error("Unable to record token estimator run telemetry.");
        }
      }

      const current = readLockOwnerSnapshot(lock);
      if (!snapshotCanBeReclaimed(current)) {
        waitForReportLockRetry(sleeper, deadline);
        continue;
      }
      const claimName = current.kind === "valid"
        ? `.reclaim-v2-${current.owner.token}`
        : ".reclaim-v2-malformed";
      const claim = acquireRecoveryClaim(directory, lock, claimName, sleeper, deadline);
      if (!claim) {
        waitForReportLockRetry(sleeper, deadline);
        continue;
      }
      let displacedLock = false;
      try {
        const claimed = readLockOwnerSnapshot(lock);
        if (!sameOwnerSnapshot(claimed, current) || !snapshotCanBeReclaimed(claimed)) {
          waitForReportLockRetry(sleeper, deadline);
          continue;
        }
        const staleName = current.kind === "valid"
          ? `.token-estimator-report-stale-lock-${current.owner.token}`
          : ".token-estimator-report-stale-lock-malformed";
        const stale = join(directory, staleName);
        try {
          renameSync(lock, stale);
          displacedLock = true;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT" || lockConflict(error)) {
            waitForReportLockRetry(sleeper, deadline);
            continue;
          }
          throw new Error("Unable to record token estimator run telemetry.");
        }
        const displaced = readLockOwnerSnapshot(stale);
        if (!sameOwnerSnapshot(displaced, current)) {
          throw new Error("Token estimator report lock changed during stale-owner recovery.");
        }
        rmSync(stale, { recursive: true, force: true });
      } finally {
        if (!displacedLock) releaseRecoveryClaim(claim);
      }
      waitForReportLockRetry(sleeper, deadline);
    }
  } catch (error) {
    rmSync(candidate, { recursive: true, force: true });
    throw error;
  }
}

function releaseReportLock(directory: string, owner: ReportLockOwner): void {
  const lock = join(directory, ".token-estimator-report.lock");
  const current = readLockOwner(lock);
  if (!sameOwner(current, owner)) {
    throw new Error("Token estimator report lock changed before release.");
  }
  const released = join(directory, `.token-estimator-report-released-lock-${owner.token}`);
  renameSync(lock, released);
  const displaced = readLockOwner(released);
  if (!sameOwner(displaced, owner)) {
    throw new Error("Token estimator report lock changed during release.");
  }
  rmSync(released, { recursive: true, force: true });
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
  const directory = join(root, ".pi-book", "runs", runId);
  const owner = acquireReportLock(directory);
  try {
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
    const path = reportPath(root, runId);
    const temporary = join(directory, `.token-estimator-report.${process.pid}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      renameSync(temporary, path);
    } catch {
      throw new Error("Unable to record token estimator run telemetry.");
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true });
    }
  } finally {
    releaseReportLock(directory, owner);
  }
}

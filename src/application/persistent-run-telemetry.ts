import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { storeRunReport } from "../infrastructure/run-report-store.js";
import { createRunReport, resolveTelemetryEnabled } from "./run-telemetry.js";

export interface PreparedPersistentRunTelemetry {
  telemetryEnabled?: boolean;
  runId: string;
  runtimeProfile: RuntimeProfileId;
  promptChars: number;
  projectHashBefore: string;
}

export function recordPreparedPersistentRun(root: string, input: PreparedPersistentRunTelemetry): string {
  if (!resolveTelemetryEnabled({ project: input.telemetryEnabled })) return "";
  const result = storeRunReport(root, createRunReport({
    runId: input.runId,
    runtimeProfile: input.runtimeProfile,
    promptChars: input.promptChars,
    contextChars: 0,
    changedFileCount: 0,
    changedBytes: 0,
    repairAttempts: 0,
    validationFailures: [],
    metrics: [],
    projectHashBefore: input.projectHashBefore,
  }));
  return result.ok ? "" : ` ${result.message}`;
}

import type { QualityTierId } from "../domain/quality-profile.js";
import { resolveQualityConfig } from "../domain/quality-profile.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { storeRunReport } from "../infrastructure/run-report-store.js";
import { readProject } from "../project/store.js";
import { createRunReportHeader, resolveTelemetryEnabled } from "./run-telemetry.js";

export interface PreparedPersistentRunTelemetry {
  telemetryEnabled?: boolean | undefined;
  runId: string;
  runtimeProfile: RuntimeProfileId;
  qualityTier?: QualityTierId;
  promptChars: number;
  projectHashBefore: string;
}

export function recordPreparedPersistentRun(root: string, input: PreparedPersistentRunTelemetry): string {
  if (!resolveTelemetryEnabled({ project: input.telemetryEnabled })) return "";
  const qualityTier = input.qualityTier ?? resolveQualityConfig(readProject(root).quality).tier;
  const result = storeRunReport(root, createRunReportHeader({
    runId: input.runId,
    runtimeProfile: input.runtimeProfile,
    qualityTier,
    projectHashBefore: input.projectHashBefore,
  }));
  return result.ok ? "" : ` ${result.message}`;
}

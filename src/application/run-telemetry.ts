import type { QualityTierId } from "../domain/quality-profile.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import type { RunMetric, RunReportV1, RunReportV2, RunValidationFailure } from "../domain/run-report.js";

export interface CreateRunReportInput {
  runId: string;
  runtimeProfile: RuntimeProfileId;
  adapterId?: string;
  model?: string;
  promptChars: number;
  contextChars: number;
  changedFileCount: number;
  changedBytes: number;
  repairAttempts: number;
  validationFailures: RunValidationFailure[];
  metrics: RunMetric[];
  projectHashBefore: string;
  projectHashAfter?: string;
}

export interface CreateRunReportHeaderInput {
  runId: string;
  runtimeProfile: RuntimeProfileId;
  qualityTier: QualityTierId;
  projectHashBefore: string;
  projectHashAfter?: string;
}

export interface TelemetryPreferenceInput {
  explicit?: boolean | undefined;
  project?: boolean | undefined;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

function nonblank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be nonblank.`);
  return normalized;
}

export function estimateInputTokens(promptChars: number, contextChars: number): number {
  return Math.ceil((nonnegativeInteger(promptChars, "Prompt characters") + nonnegativeInteger(contextChars, "Context characters")) / 4);
}

export function resolveTelemetryEnabled(input: TelemetryPreferenceInput): boolean {
  return input.explicit ?? input.project ?? true;
}

export function createRunReport(input: CreateRunReportInput): RunReportV1 {
  const runId = nonblank(input.runId, "Run ID");
  const promptChars = nonnegativeInteger(input.promptChars, "Prompt characters");
  const contextChars = nonnegativeInteger(input.contextChars, "Context characters");
  return {
    schemaVersion: "1.0.0",
    runId,
    runtimeProfile: input.runtimeProfile,
    ...(input.adapterId ? { adapterId: nonblank(input.adapterId, "Adapter ID") } : {}),
    ...(input.model ? { model: nonblank(input.model, "Model") } : {}),
    promptChars,
    contextChars,
    estimatedInputTokens: estimateInputTokens(promptChars, contextChars),
    changedFileCount: nonnegativeInteger(input.changedFileCount, "Changed file count"),
    changedBytes: nonnegativeInteger(input.changedBytes, "Changed bytes"),
    repairAttempts: nonnegativeInteger(input.repairAttempts, "Repair attempts"),
    validationFailures: input.validationFailures.map((failure) => ({
      ...(failure.path ? { path: nonblank(failure.path, "Validation path") } : {}),
      category: nonblank(failure.category, "Validation category"),
      message: nonblank(failure.message, "Validation message"),
    })),
    metrics: input.metrics.map((metric) => ({
      label: nonblank(metric.label, "Metric label"),
      elapsedMs: Math.max(0, metric.elapsedMs),
      ...(metric.rssBytes !== undefined ? { rssBytes: nonnegativeInteger(metric.rssBytes, "RSS bytes") } : {}),
    })),
    projectHashBefore: nonblank(input.projectHashBefore, "Project hash before"),
    ...(input.projectHashAfter ? { projectHashAfter: nonblank(input.projectHashAfter, "Project hash after") } : {}),
  };
}

export function createRunReportHeader(input: CreateRunReportHeaderInput): RunReportV2 {
  return {
    schemaVersion: "2.0.0",
    runId: nonblank(input.runId, "Run ID"),
    runtimeProfile: input.runtimeProfile,
    qualityTier: input.qualityTier,
    modelCalls: [],
    totals: {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      estimatedCalls: 0,
    },
    budgetEvents: [],
    projectHashBefore: nonblank(input.projectHashBefore, "Project hash before"),
    ...(input.projectHashAfter ? { projectHashAfter: nonblank(input.projectHashAfter, "Project hash after") } : {}),
  };
}

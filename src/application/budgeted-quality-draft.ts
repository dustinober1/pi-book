import { randomUUID } from "node:crypto";
import { buildChapterContext } from "../context/context-builder.js";
import { resolveQualityConfig, type QualityProjectState, type ResolvedQualityConfig } from "../domain/quality-profile.js";
import { RUNTIME_PROFILES, type RuntimeProfile, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { readProject } from "../project/store.js";
import {
  BudgetedQualityWorker,
  QualityBudgetDowngradeError,
  QualityBudgetStopError,
} from "./budgeted-quality-worker.js";
import {
  runQualityDraft,
  type RunQualityDraftInput,
  type RunQualityDraftResult,
} from "./quality-orchestrator.js";

export { QualityBudgetDowngradeError, QualityBudgetStopError } from "./budgeted-quality-worker.js";

function runtimeProfile(value: RuntimeProfileId | RuntimeProfile): RuntimeProfile {
  return typeof value === "string" ? RUNTIME_PROFILES[value] : value;
}

function qualityConfig(value: QualityProjectState | ResolvedQualityConfig): ResolvedQualityConfig {
  return "keySceneCandidates" in value ? value : resolveQualityConfig(value);
}

export type RunBudgetedQualityDraftInput = Omit<RunQualityDraftInput, "worker" | "runId"> & {
  worker: RunQualityDraftInput["worker"];
  runId?: string;
};

export async function runBudgetedQualityDraft(input: RunBudgetedQualityDraftInput): Promise<RunQualityDraftResult> {
  const profile = runtimeProfile(input.runtimeProfile);
  const quality = qualityConfig(input.qualityConfig);
  const runId = input.runId ?? `QDR-${randomUUID()}`;
  const context = buildChapterContext(input.root, input.chapter, profile.maxContextChars, profile.graphDepth);
  const project = readProject(input.root);
  const worker = new BudgetedQualityWorker({
    root: input.root,
    runId,
    chapter: context.packet.chapter,
    tier: quality.tier,
    limits: quality.budget,
    worker: input.worker,
    ...(project.runtime?.telemetry !== undefined ? { telemetryEnabled: project.runtime.telemetry } : {}),
  });
  return runQualityDraft({
    ...input,
    runId,
    runtimeProfile: profile,
    qualityConfig: quality,
    worker,
  });
}

export function isQualityBudgetBoundaryError(error: unknown): error is QualityBudgetStopError | QualityBudgetDowngradeError {
  return error instanceof QualityBudgetStopError || error instanceof QualityBudgetDowngradeError;
}

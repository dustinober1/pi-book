import type { QualityWorker } from "../domain/quality-worker.js";
import { resolveQualityConfig } from "../domain/quality-profile.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readProject } from "../project/store.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { completeAutomationEvent } from "./automation-run.js";
import { creativeProjectStateHash } from "./project-hash.js";
import {
  QualityBudgetDowngradeError,
  QualityBudgetStopError,
  runBudgetedQualityDraft,
} from "./budgeted-quality-draft.js";
import type { RunQualityDraftResult } from "./quality-orchestrator.js";

export interface RunPersistentQualityDraftInput {
  root: string;
  worker: QualityWorker;
  maxChapters?: number;
  provider?: string;
  model?: string;
  signal?: AbortSignal;
  now?: () => string;
  onProgress?: (name: string) => void;
}

export interface PersistentQualityDraftResult {
  runId: string;
  chapters: RunQualityDraftResult[];
  status: "paused" | "stopped" | "completed";
  stopReason: string;
  downgradedTo?: "economy" | "balanced" | "premium";
}

function timestamp(input: RunPersistentQualityDraftInput): string {
  return input.now?.() ?? new Date().toISOString();
}

function persistRunState(root: string, project: ReturnType<typeof readProject>, runId: string, action: string): void {
  applyGuidedProjectEvent(
    root,
    [{ path: "PROJECT.yaml", content: stringifyYaml(project) }],
    `Novel Forge: update quality automation ${runId}`,
    { lastAction: action },
  );
}

function stopForCurrentState(project: ReturnType<typeof readProject>): string | null {
  if (project.next_gate && ["pending", "rejected"].includes(project.gates[project.next_gate] ?? "")) return "human-gate";
  if (project.current_stage !== "drafting") return `stage:${project.current_stage}`;
  return null;
}

function updateAfterChapter(root: string, runId: string, result: RunQualityDraftResult, finalIteration: boolean, now: string): ReturnType<typeof readProject> {
  const current = readProject(root);
  let updated = completeAutomationEvent(
    current,
    `draft-chapter:${result.chapter}`,
    current.current_stage,
    creativeProjectStateHash(root),
    now,
  );
  const run = updated.automation.active_run!;
  const stateStop = stopForCurrentState(updated);
  if (stateStop) {
    run.status = "stopped";
    run.stopReason = stateStop;
  } else if (finalIteration) {
    run.status = "paused";
    run.stopReason = "chapter-limit";
  }
  persistRunState(root, updated, runId, `Updated quality automation ${runId} after Chapter ${result.chapter}`);
  return updated;
}

function updateForBudgetBoundary(
  root: string,
  runId: string,
  error: QualityBudgetStopError | QualityBudgetDowngradeError,
  now: string,
): ReturnType<typeof readProject> {
  const updated = structuredClone(readProject(root));
  const run = updated.automation.active_run;
  if (!run || run.id !== runId) throw new Error(`Automation run ${runId} is no longer active.`);
  run.updatedAt = now;
  if (error instanceof QualityBudgetDowngradeError) {
    if (!run.quality_snapshot) throw new Error(`Automation run ${runId} has no quality snapshot.`);
    run.quality_snapshot.tier = error.toTier;
    run.status = "paused";
    run.stopReason = `budget-downgrade:${error.toTier}`;
  } else {
    run.status = "stopped";
    run.stopReason = `budget-stop:${error.reason}`;
  }
  persistRunState(root, updated, runId, `Recorded budget boundary for ${runId}`);
  return updated;
}

export async function runPersistentQualityDraft(input: RunPersistentQualityDraftInput): Promise<PersistentQualityDraftResult> {
  const initial = readProject(input.root);
  const initialRun = initial.automation.active_run;
  if (!initialRun) throw new Error("No persistent automation run exists.");
  if (initialRun.status !== "active") throw new Error(`Automation run ${initialRun.id} is ${initialRun.status}; resume it before quality drafting.`);
  if (!initialRun.quality_snapshot) throw new Error(`Automation run ${initialRun.id} has no quality snapshot.`);
  const quality = resolveQualityConfig(initialRun.quality_snapshot);
  if (quality.tier === "economy") throw new Error("Economy persistent drafting must use the existing host prompt workflow.");
  const limit = Math.min(
    initialRun.requestedMaxChapters,
    input.maxChapters ?? initialRun.requestedMaxChapters,
  );
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Persistent quality chapter limit must be positive.");

  const chapters: RunQualityDraftResult[] = [];
  for (let index = 0; index < limit; index += 1) {
    const current = readProject(input.root);
    const run = current.automation.active_run;
    if (!run || run.id !== initialRun.id) throw new Error(`Automation run ${initialRun.id} changed during quality drafting.`);
    if (run.status !== "active") return {
      runId: run.id,
      chapters,
      status: run.status === "completed" ? "completed" : "stopped",
      stopReason: run.stopReason ?? run.status,
    };
    const stateStop = stopForCurrentState(current);
    if (stateStop) {
      const updated = structuredClone(current);
      updated.automation.active_run!.status = "stopped";
      updated.automation.active_run!.stopReason = stateStop;
      updated.automation.active_run!.updatedAt = timestamp(input);
      persistRunState(input.root, updated, run.id, `Stopped quality automation ${run.id} at ${stateStop}`);
      return { runId: run.id, chapters, status: "stopped", stopReason: stateStop };
    }

    input.onProgress?.(`persistent chapter ${index + 1}`);
    const childRunId = `${run.id}-CH-${String(index + run.completedEventKeys.length + 1).padStart(3, "0")}`;
    try {
      const result = await runBudgetedQualityDraft({
        root: input.root,
        runtimeProfile: run.runtimeProfile ?? current.runtime?.profile ?? "full",
        qualityConfig: run.quality_snapshot,
        worker: input.worker,
        runId: childRunId,
        cacheRetention: "delete-on-success",
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
      });
      chapters.push(result);
      const updated = updateAfterChapter(input.root, run.id, result, index === limit - 1, timestamp(input));
      const updatedRun = updated.automation.active_run!;
      if (updatedRun.status !== "active") {
        return {
          runId: run.id,
          chapters,
          status: updatedRun.status === "paused" ? "paused" : updatedRun.status === "completed" ? "completed" : "stopped",
          stopReason: updatedRun.stopReason ?? updatedRun.status,
        };
      }
    } catch (error) {
      if (error instanceof QualityBudgetStopError || error instanceof QualityBudgetDowngradeError) {
        const updated = updateForBudgetBoundary(input.root, run.id, error, timestamp(input));
        const updatedRun = updated.automation.active_run!;
        return {
          runId: run.id,
          chapters,
          status: updatedRun.status === "paused" ? "paused" : "stopped",
          stopReason: updatedRun.stopReason ?? "budget-boundary",
          ...(error instanceof QualityBudgetDowngradeError ? { downgradedTo: error.toTier } : {}),
        };
      }
      const updated = structuredClone(readProject(input.root));
      if (updated.automation.active_run?.id === run.id) {
        updated.automation.active_run.status = "stopped";
        updated.automation.active_run.stopReason = "quality-worker-error";
        updated.automation.active_run.updatedAt = timestamp(input);
        persistRunState(input.root, updated, run.id, `Stopped quality automation ${run.id} after worker failure`);
      }
      throw error;
    }
  }

  const final = readProject(input.root).automation.active_run!;
  return {
    runId: final.id,
    chapters,
    status: final.status === "paused" ? "paused" : final.status === "completed" ? "completed" : "stopped",
    stopReason: final.stopReason ?? final.status,
  };
}

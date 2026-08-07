import type { QualityTierId } from "../domain/quality-profile.js";
import { resolveQualityConfig } from "../domain/quality-profile.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { SCENE_CRITIC_JOB_TYPES } from "../domain/scene-critic-artifact.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { completeAutomationEvent } from "./automation-run.js";
import {
  QualityBudgetDowngradeError,
  QualityBudgetStopError,
  runBudgetedQualityDraft,
} from "./budgeted-quality-draft.js";
import { resolveChapterStepTarget } from "./chapter-execution-command.js";
import { chapterExecutionReadiness, runChapterExecution, type ChapterExecutionRunResult } from "./chapter-execution-run.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { recordRunState, recordStop } from "./journey-trace.js";
import type { RunQualityDraftResult } from "./quality-orchestrator.js";
import { creativeProjectStateHash } from "./project-hash.js";

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

/**
 * How one chapter was actually drafted.
 *
 * v2.0.0 established that an agent finding no executable contract quietly fell
 * back to unguarded drafting, disabling scene critics, targeted repair and
 * ordered acceptance in a single step. The automated run had the same shape for
 * a different reason: it never used the scene machine at all, because nothing
 * drove it. Now that `runChapterExecution` exists, a persistent run takes the
 * guarded path whenever the chapter has an executable contract — and records
 * which path ran either way, so "critics did not run" is never silent.
 */
export interface PersistentChapterOutcome {
  chapter: number;
  path: "guarded-scene-execution" | "whole-chapter";
  reason: string;
  /** Present only on the whole-chapter orchestrator path. */
  draft?: RunQualityDraftResult;
  /** Present only on the guarded scene path. */
  execution?: ChapterExecutionRunResult;
}

export interface PersistentQualityDraftResult {
  runId: string;
  chapters: PersistentChapterOutcome[];
  status: "paused" | "stopped" | "completed";
  stopReason: string;
  downgradedTo?: QualityTierId;
  /** Advisories the caller must relay, including any unguarded-path disclosure. */
  advisories: string[];
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

function updateAfterChapter(
  root: string,
  runId: string,
  chapter: number,
  finalIteration: boolean,
  now: string,
  attemptKey: string,
): ReturnType<typeof readProject> {
  const current = readProject(root);
  const updated = completeAutomationEvent(
    current,
    `draft-chapter:${chapter}`,
    current.current_stage,
    creativeProjectStateHash(root),
    now,
  );
  const run = updated.automation.active_run!;
  delete run.retryCounts[attemptKey];
  const stateStop = stopForCurrentState(updated);
  if (stateStop) {
    run.status = "stopped";
    run.stopReason = stateStop;
  } else if (finalIteration) {
    run.status = "paused";
    run.stopReason = "chapter-limit";
  }
  persistRunState(root, updated, runId, `Updated quality automation ${runId} after Chapter ${chapter}`);
  return updated;
}

function updateForBudgetBoundary(
  root: string,
  runId: string,
  error: QualityBudgetStopError | QualityBudgetDowngradeError,
  now: string,
  attemptKey: string,
  attempt: number,
): ReturnType<typeof readProject> {
  const updated = structuredClone(readProject(root));
  const run = updated.automation.active_run;
  if (!run || run.id !== runId) throw new Error(`Automation run ${runId} is no longer active.`);
  run.updatedAt = now;
  run.retryCounts[attemptKey] = attempt;
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
  const limit = Math.min(initialRun.requestedMaxChapters, input.maxChapters ?? initialRun.requestedMaxChapters);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Persistent quality chapter limit must be positive.");

  const chapters: PersistentChapterOutcome[] = [];
  const advisories: string[] = [];
  for (let index = 0; index < limit; index += 1) {
    const current = readProject(input.root);
    const run = current.automation.active_run;
    if (!run || run.id !== initialRun.id) throw new Error(`Automation run ${initialRun.id} changed during quality drafting.`);
    if (run.status !== "active") return {
      runId: run.id,
      chapters,
      status: run.status === "completed" ? "completed" : "stopped",
      stopReason: run.stopReason ?? run.status,
      advisories,
    };
    const snapshot = run.quality_snapshot;
    if (!snapshot) throw new Error(`Automation run ${run.id} has no quality snapshot after reload.`);
    const stateStop = stopForCurrentState(current);
    if (stateStop) {
      const updated = structuredClone(current);
      updated.automation.active_run!.status = "stopped";
      updated.automation.active_run!.stopReason = stateStop;
      updated.automation.active_run!.updatedAt = timestamp(input);
      persistRunState(input.root, updated, run.id, `Stopped quality automation ${run.id} at ${stateStop}`);
      return { runId: run.id, chapters, status: "stopped", stopReason: stateStop, advisories };
    }

    input.onProgress?.(`persistent chapter ${index + 1}`);
    const childOrdinal = run.completedEventKeys.length + 1;
    const attemptKey = `quality-child-attempt:${childOrdinal}`;
    const childAttempt = (run.retryCounts[attemptKey] ?? 0) + 1;
    const childRunId = `${run.id}-CH-${String(childOrdinal).padStart(3, "0")}-ATT-${String(childAttempt).padStart(3, "0")}`;
    // Which chapter is next, and can it take the guarded scene path?
    const target = resolveChapterStepTarget(input.root);
    const readiness = chapterExecutionReadiness(input.root, readBook(input.root).book_id, target.chapter);
    try {
      let outcome: PersistentChapterOutcome;
      if (readiness.ready) {
        input.onProgress?.(`guarded scene execution for chapter ${target.chapter}`);
        const execution = await runChapterExecution({
          root: input.root,
          chapter: target.chapter,
          runId: target.runId,
          worker: input.worker,
          requiredCriticJobTypes: SCENE_CRITIC_JOB_TYPES,
          runtimeProfile: run.runtimeProfile ?? current.runtime?.profile ?? "full",
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
          ...(input.onProgress ? { onStep: ({ action }) => input.onProgress?.(`chapter ${target.chapter}: ${action}`) } : {}),
        });
        // A chapter that did not reach its guarded commit has not been drafted;
        // stop the run on the execution's own stop reason rather than counting
        // it and moving to the next chapter.
        if (!execution.committed) {
          const stopped = structuredClone(readProject(input.root));
          if (stopped.automation.active_run?.id === run.id) {
            stopped.automation.active_run.status = execution.stopReason === "paused" ? "paused" : "stopped";
            stopped.automation.active_run.stopReason = `scene-execution:${execution.stopReason}`;
            stopped.automation.active_run.updatedAt = timestamp(input);
            persistRunState(input.root, stopped, run.id, `Stopped quality automation ${run.id} at scene execution ${execution.stopReason}`);
          }
          advisories.push(`Chapter ${target.chapter} stopped during guarded scene execution at ${execution.stopReason}${execution.state.blocker ? `: ${execution.state.blocker.message}` : "."} No canonical chapter was committed.`);
          return {
            runId: run.id,
            chapters,
            status: execution.stopReason === "paused" ? "paused" : "stopped",
            stopReason: `scene-execution:${execution.stopReason}`,
            advisories,
          };
        }
        outcome = { chapter: target.chapter, path: "guarded-scene-execution", reason: readiness.reason, execution };
      } else {
        const result = await runBudgetedQualityDraft({
          root: input.root,
          runtimeProfile: run.runtimeProfile ?? current.runtime?.profile ?? "full",
          ...(run.modelExecutionProfile ? { modelExecutionProfile: run.modelExecutionProfile } : {}),
          qualityConfig: snapshot,
          worker: input.worker,
          runId: childRunId,
          cacheRetention: "delete-on-success",
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
          ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        });
        advisories.push(`Chapter ${result.chapter} was drafted without guarded scene execution because ${readiness.reason}: no scene critics, no targeted repair, and no ordered acceptance ran. Say so plainly in your summary to the writer.`);
        outcome = { chapter: result.chapter, path: "whole-chapter", reason: readiness.reason, draft: result };
      }
      chapters.push(outcome);
      const updated = updateAfterChapter(input.root, run.id, outcome.chapter, index === limit - 1, timestamp(input), attemptKey);
      const updatedRun = updated.automation.active_run!;
      if (updatedRun.status !== "active") {
        return {
          runId: run.id,
          chapters,
          status: updatedRun.status === "paused" ? "paused" : updatedRun.status === "completed" ? "completed" : "stopped",
          stopReason: updatedRun.stopReason ?? updatedRun.status,
          advisories,
        };
      }
    } catch (error) {
      if (error instanceof QualityBudgetStopError || error instanceof QualityBudgetDowngradeError) {
        const updated = updateForBudgetBoundary(input.root, run.id, error, timestamp(input), attemptKey, childAttempt);
        const updatedRun = updated.automation.active_run!;
        return {
          runId: run.id,
          chapters,
          status: updatedRun.status === "paused" ? "paused" : "stopped",
          stopReason: updatedRun.stopReason ?? "budget-boundary",
          advisories,
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
  const telemetry = readProject(input.root).runtime?.telemetry;
  if (final.status === "completed") recordRunState(input.root, telemetry, final.id, "completed");
  recordStop(input.root, telemetry, final.stopReason ?? final.status);
  return {
    runId: final.id,
    chapters,
    status: final.status === "paused" ? "paused" : final.status === "completed" ? "completed" : "stopped",
    stopReason: final.stopReason ?? final.status,
    advisories,
  };
}

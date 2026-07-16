import type { ProjectState } from "../domain/schemas.js";
import type { AutomationRunState } from "../domain/v1-4-schemas.js";
import type { EventRejectionDetail } from "./event-rejection.js";

export interface StartAutomationRunInput {
  id: string;
  target: string;
  currentAction: string;
  requestedMaxChapters: number;
  creativeHash: string;
  startedAt: string;
}

function clone(project: ProjectState): ProjectState {
  return structuredClone(project);
}

function activeRun(project: ProjectState): AutomationRunState {
  const run = project.automation.active_run;
  if (!run) throw new Error("No automation run exists.");
  return run;
}

export function automationEventKey(action: string, chapter?: number): string {
  const normalized = action.trim();
  if (!normalized) throw new Error("Automation event action must be nonblank.");
  if (chapter === undefined) return normalized;
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Automation event chapter must be a positive integer.");
  return `${normalized}:${chapter}`;
}

export function startAutomationRun(project: ProjectState, input: StartAutomationRunInput): ProjectState {
  const existing = project.automation.active_run;
  if (existing && ["active", "paused"].includes(existing.status)) {
    throw new Error(`Automation run ${existing.id} is ${existing.status}; cancel it before starting another run.`);
  }
  const target = input.target.trim();
  const currentAction = input.currentAction.trim();
  const creativeHash = input.creativeHash.trim();
  const startedAt = input.startedAt.trim();
  if (!/^RUN-[0-9]{3}$/.test(input.id)) throw new Error("Automation run ID must use RUN-NNN format.");
  if (!target || !currentAction || !creativeHash || !startedAt) throw new Error("Automation run target, action, creative hash, and start time are required.");
  if (!Number.isInteger(input.requestedMaxChapters) || input.requestedMaxChapters < 1 || input.requestedMaxChapters > 10) {
    throw new Error("Automation run chapter budget must be an integer from 1 to 10.");
  }
  const result = clone(project);
  result.automation.active_run = {
    id: input.id,
    status: "active",
    target,
    startedStage: project.current_stage,
    currentAction,
    requestedMaxChapters: input.requestedMaxChapters,
    completedEventKeys: [],
    lastProjectHash: creativeHash,
    refillCount: 0,
    retryCounts: {},
    stopReason: null,
    startedAt,
    updatedAt: startedAt,
  };
  return result;
}

export function pauseAutomationRun(project: ProjectState, updatedAt: string): ProjectState {
  const run = activeRun(project);
  if (run.status === "paused") return project;
  if (run.status !== "active") throw new Error(`Automation run ${run.id} is ${run.status} and cannot be paused.`);
  const result = clone(project);
  result.automation.active_run!.status = "paused";
  result.automation.active_run!.updatedAt = updatedAt;
  return result;
}

export function cancelAutomationRun(project: ProjectState, updatedAt: string): ProjectState {
  const run = activeRun(project);
  if (run.status === "cancelled") return project;
  if (run.status === "completed") throw new Error(`Automation run ${run.id} is completed and cannot be cancelled.`);
  const result = clone(project);
  result.automation.active_run!.status = "cancelled";
  result.automation.active_run!.stopReason = "cancelled-by-writer";
  result.automation.active_run!.updatedAt = updatedAt;
  return result;
}

export function resumeAutomationRun(
  project: ProjectState,
  currentStage: string,
  currentCreativeHash: string,
  updatedAt: string,
): ProjectState {
  const run = activeRun(project);
  if (run.status === "cancelled" || run.status === "completed") {
    throw new Error(`Automation run ${run.id} is ${run.status} and cannot resume.`);
  }
  if (run.status === "active") return project;
  if (run.status === "stopped") throw new Error(`Automation run ${run.id} is stopped and requires a new run.`);
  const result = clone(project);
  const resumed = result.automation.active_run!;
  if (currentStage !== run.startedStage || currentCreativeHash !== run.lastProjectHash) {
    resumed.status = "stopped";
    resumed.stopReason = currentStage !== run.startedStage ? "creative-stage-changed" : "creative-state-changed";
    resumed.updatedAt = updatedAt;
    return result;
  }
  resumed.status = "active";
  resumed.stopReason = null;
  resumed.updatedAt = updatedAt;
  return result;
}

export function completeAutomationEvent(
  project: ProjectState,
  eventKey: string,
  nextAction: string,
  creativeHash: string,
  updatedAt: string,
): ProjectState {
  const run = activeRun(project);
  if (run.status !== "active") throw new Error(`Automation run ${run.id} is ${run.status} and cannot record a completed event.`);
  const key = eventKey.trim();
  if (!key) throw new Error("Automation event key must be nonblank.");
  if (run.completedEventKeys.includes(key)) return project;
  const result = clone(project);
  const updated = result.automation.active_run!;
  updated.completedEventKeys.push(key);
  updated.currentAction = nextAction.trim() || updated.currentAction;
  updated.lastProjectHash = creativeHash;
  updated.updatedAt = updatedAt;
  delete updated.retryCounts[key];
  return result;
}

export function recordAutomationRejection(
  project: ProjectState,
  eventKey: string,
  detail: EventRejectionDetail,
  creativeHash: string,
  updatedAt: string,
): ProjectState {
  const run = activeRun(project);
  if (run.status !== "active") throw new Error(`Automation run ${run.id} is ${run.status} and cannot record a rejection.`);
  const result = clone(project);
  const updated = result.automation.active_run!;
  updated.lastProjectHash = creativeHash;
  updated.updatedAt = updatedAt;

  if (detail.code === "human-gate-required") {
    updated.status = "stopped";
    updated.stopReason = "human-gate";
    return result;
  }

  const boundedRetry = detail.retryable && (detail.code === "schema-validation" || detail.code === "reference-validation");
  if (boundedRetry) {
    const count = (updated.retryCounts[eventKey] ?? 0) + 1;
    updated.retryCounts[eventKey] = count;
    if (count > 1) {
      updated.status = "stopped";
      updated.stopReason = `retry-limit:${eventKey}`;
    }
    return result;
  }

  updated.status = "stopped";
  updated.stopReason = detail.code;
  return result;
}

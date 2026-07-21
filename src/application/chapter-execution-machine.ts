import type {
  ChapterExecutionState,
  ExecutionBlockerCode,
  ExecutionNode,
} from "../domain/chapter-execution-state.js";

const TRANSITIONS: Readonly<Record<ExecutionNode, readonly ExecutionNode[]>> = Object.freeze({
  "contract-compile": Object.freeze(["scene-contract-compile"]),
  "scene-contract-compile": Object.freeze(["context-build"]),
  "context-build": Object.freeze(["scene-plan"]),
  "scene-plan": Object.freeze(["scene-draft"]),
  "scene-draft": Object.freeze(["deterministic-validation"]),
  "deterministic-validation": Object.freeze(["critic-review", "span-repair", "state-delta"]),
  "critic-review": Object.freeze(["span-repair", "state-delta"]),
  "span-repair": Object.freeze(["deterministic-validation"]),
  "state-delta": Object.freeze(["scene-accept"]),
  "scene-accept": Object.freeze(["context-build", "chapter-stitch"]),
  "chapter-stitch": Object.freeze(["chapter-validate"]),
  "chapter-validate": Object.freeze(["chapter-commit"]),
  "chapter-commit": Object.freeze(["complete"]),
  complete: Object.freeze([]),
});

export interface CreateChapterExecutionStateInput {
  runId: string;
  projectHash: string;
  canonSnapshotHash: string;
  contractHash: string;
  chapter: number;
  now?: string;
}

export interface ResumeChapterExecutionInput {
  projectHash: string;
  canonSnapshotHash: string;
  contractHash: string;
  now?: string;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function completedKey(state: ChapterExecutionState, sceneId?: string): string {
  return `${sceneId ?? state.current_scene_id ?? "chapter"}:${state.current_node}`;
}

export function createChapterExecutionState(input: CreateChapterExecutionStateInput): ChapterExecutionState {
  if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Chapter must be a positive integer.");
  return {
    schema_version: "1.0.0",
    run_id: input.runId,
    project_hash: input.projectHash,
    canon_snapshot_hash: input.canonSnapshotHash,
    contract_hash: input.contractHash,
    chapter: input.chapter,
    current_scene_id: null,
    current_node: "contract-compile",
    status: "active",
    completed_nodes: [],
    attempts: {},
    accepted_scene_ids: [],
    updated_at: timestamp(input.now),
  };
}

export function transitionChapterExecution(
  state: ChapterExecutionState,
  next: ExecutionNode,
  now?: string,
  sceneId?: string,
): ChapterExecutionState {
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (!TRANSITIONS[state.current_node].includes(next)) {
    throw new Error(`Illegal chapter execution transition: ${state.current_node} -> ${next}.`);
  }
  const key = completedKey(state, sceneId);
  const completedNodes = state.completed_nodes.includes(key) ? state.completed_nodes : [...state.completed_nodes, key];
  const currentSceneId = sceneId ?? state.current_scene_id;
  return {
    ...state,
    current_scene_id: currentSceneId,
    current_node: next,
    status: next === "complete" ? "completed" : "active",
    completed_nodes: completedNodes,
    blocker: undefined,
    updated_at: timestamp(now),
  };
}

export function recordChapterExecutionAttempt(
  state: ChapterExecutionState,
  key = `${state.current_scene_id ?? "chapter"}:${state.current_node}`,
  now?: string,
): ChapterExecutionState {
  const attempts = { ...state.attempts, [key]: (state.attempts[key] ?? 0) + 1 };
  return { ...state, attempts, updated_at: timestamp(now) };
}

export function acceptExecutionScene(state: ChapterExecutionState, sceneId: string, now?: string): ChapterExecutionState {
  if (!sceneId.trim()) throw new Error("Scene ID must be nonblank.");
  const accepted = state.accepted_scene_ids.includes(sceneId) ? state.accepted_scene_ids : [...state.accepted_scene_ids, sceneId];
  return { ...state, accepted_scene_ids: accepted, updated_at: timestamp(now) };
}

export function pauseChapterExecution(state: ChapterExecutionState, now?: string): ChapterExecutionState {
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  return { ...state, status: "paused", updated_at: timestamp(now) };
}

export function blockChapterExecution(
  state: ChapterExecutionState,
  blocker: { code: ExecutionBlockerCode; message: string; recordIds?: string[] },
  now?: string,
): ChapterExecutionState {
  if (!blocker.message.trim()) throw new Error("Execution blocker message must be nonblank.");
  return {
    ...state,
    status: "blocked",
    blocker: { code: blocker.code, message: blocker.message, record_ids: [...new Set(blocker.recordIds ?? [])] },
    updated_at: timestamp(now),
  };
}

export function resumeChapterExecution(state: ChapterExecutionState, input: ResumeChapterExecutionInput): ChapterExecutionState {
  if (state.status !== "paused" && state.status !== "blocked") {
    throw new Error(`Chapter execution is ${state.status}; only paused or blocked runs can resume.`);
  }
  if (state.project_hash !== input.projectHash) throw new Error("Cannot resume chapter execution because the project hash changed.");
  if (state.canon_snapshot_hash !== input.canonSnapshotHash) throw new Error("Cannot resume chapter execution because the canon snapshot hash changed.");
  if (state.contract_hash !== input.contractHash) throw new Error("Cannot resume chapter execution because the contract hash changed.");
  return { ...state, status: "active", blocker: undefined, updated_at: timestamp(input.now) };
}

export function legalChapterExecutionTransitions(node: ExecutionNode): readonly ExecutionNode[] {
  return TRANSITIONS[node];
}

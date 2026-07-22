import type { ChapterExecutionState, ExecutionBlockerCode, ExecutionNode } from "../domain/chapter-execution-state.js";

const TRANSITIONS = {
  "contract-compile": ["scene-contract-compile"],
  "scene-contract-compile": ["context-build"],
  "context-build": ["scene-plan"],
  "scene-plan": ["scene-draft"],
  "scene-draft": ["deterministic-validation"],
  "deterministic-validation": ["critic-review", "span-repair", "state-delta"],
  "critic-review": ["span-repair", "state-delta"],
  "span-repair": ["deterministic-validation"],
  "state-delta": ["scene-accept", "span-repair"],
  "scene-accept": ["context-build", "chapter-stitch"],
  "chapter-stitch": ["chapter-validate"],
  "chapter-validate": ["chapter-commit"],
  "chapter-commit": ["complete"],
  complete: [],
} as const satisfies Readonly<Record<ExecutionNode, readonly ExecutionNode[]>>;

export interface CreateChapterExecutionStateInput {
  runId: string;
  projectHash: string;
  canonSnapshotHash: string;
  contractHash: string;
  chapterContractHash?: string;
  chapter: number;
  now?: string;
}
export interface ResumeChapterExecutionInput {
  projectHash: string;
  canonSnapshotHash: string;
  contractHash: string;
  chapterContractHash?: string;
  now?: string;
}

function timestamp(value?: string): string { return value ?? new Date().toISOString(); }
function completedKey(state: ChapterExecutionState, sceneId?: string): string { return `${sceneId ?? state.current_scene_id ?? "chapter"}:${state.current_node}`; }
function clearBlocker(state: ChapterExecutionState): ChapterExecutionState { const copy = { ...state }; delete copy.blocker; return copy; }

export function chapterContractHash(state: ChapterExecutionState): string {
  return state.chapter_contract_hash ?? state.contract_hash;
}

export function createChapterExecutionState(input: CreateChapterExecutionStateInput): ChapterExecutionState {
  if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Chapter must be a positive integer.");
  return {
    schema_version: "1.0.0", run_id: input.runId, project_hash: input.projectHash,
    canon_snapshot_hash: input.canonSnapshotHash, contract_hash: input.contractHash,
    ...(input.chapterContractHash ? { chapter_contract_hash: input.chapterContractHash } : {}),
    chapter: input.chapter, current_scene_id: null, current_node: "contract-compile", status: "active",
    completed_nodes: [], attempts: {}, accepted_scene_ids: [], updated_at: timestamp(input.now),
  };
}

export function transitionChapterExecution(state: ChapterExecutionState, next: ExecutionNode, now?: string, sceneId?: string): ChapterExecutionState {
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (!(TRANSITIONS[state.current_node] as readonly ExecutionNode[]).includes(next)) throw new Error(`Illegal chapter execution transition: ${state.current_node} -> ${next}.`);
  const key = completedKey(state, sceneId);
  const completedNodes = state.completed_nodes.includes(key) ? state.completed_nodes : [...state.completed_nodes, key];
  const base = clearBlocker(state);
  return { ...base, current_scene_id: sceneId ?? state.current_scene_id, current_node: next, status: next === "complete" ? "completed" : "active", completed_nodes: completedNodes, updated_at: timestamp(now) };
}

export function recordChapterExecutionAttempt(state: ChapterExecutionState, key = `${state.current_scene_id ?? "chapter"}:${state.current_node}`, now?: string): ChapterExecutionState {
  return { ...state, attempts: { ...state.attempts, [key]: (state.attempts[key] ?? 0) + 1 }, updated_at: timestamp(now) };
}
export function acceptExecutionScene(state: ChapterExecutionState, sceneId: string, now?: string): ChapterExecutionState {
  if (!sceneId.trim()) throw new Error("Scene ID must be nonblank.");
  return { ...state, accepted_scene_ids: state.accepted_scene_ids.includes(sceneId) ? state.accepted_scene_ids : [...state.accepted_scene_ids, sceneId], updated_at: timestamp(now) };
}
export function pauseChapterExecution(state: ChapterExecutionState, now?: string): ChapterExecutionState {
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  return { ...state, status: "paused", updated_at: timestamp(now) };
}
export function blockChapterExecution(state: ChapterExecutionState, blocker: { code: ExecutionBlockerCode; message: string; recordIds?: string[] }, now?: string): ChapterExecutionState {
  if (!blocker.message.trim()) throw new Error("Execution blocker message must be nonblank.");
  return { ...state, status: "blocked", blocker: { code: blocker.code, message: blocker.message, record_ids: [...new Set(blocker.recordIds ?? [])] }, updated_at: timestamp(now) };
}
export function resumeChapterExecution(state: ChapterExecutionState, input: ResumeChapterExecutionInput): ChapterExecutionState {
  if (state.status !== "paused" && state.status !== "blocked") throw new Error(`Chapter execution is ${state.status}; only paused or blocked runs can resume.`);
  if (state.project_hash !== input.projectHash) throw new Error("Cannot resume chapter execution because the project hash changed.");
  if (state.canon_snapshot_hash !== input.canonSnapshotHash) throw new Error("Cannot resume chapter execution because the canon snapshot hash changed.");
  if (state.contract_hash !== input.contractHash) throw new Error("Cannot resume chapter execution because the active scene contract hash changed.");
  if (input.chapterContractHash && chapterContractHash(state) !== input.chapterContractHash) throw new Error("Cannot resume chapter execution because the chapter contract hash changed.");
  return { ...clearBlocker(state), status: "active", updated_at: timestamp(input.now) };
}
export function legalChapterExecutionTransitions(node: ExecutionNode): readonly ExecutionNode[] { return TRANSITIONS[node]; }

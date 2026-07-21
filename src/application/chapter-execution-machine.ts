import type { ChapterExecutionState, ExecutionNode } from "../domain/chapter-execution-state.js";

const transitions: Readonly<Record<ExecutionNode, readonly ExecutionNode[]>> = Object.freeze({
  "contract-compile": ["scene-contract-compile"],
  "scene-contract-compile": ["context-build"],
  "context-build": ["scene-plan"],
  "scene-plan": ["scene-draft"],
  "scene-draft": ["deterministic-validation"],
  "deterministic-validation": ["critic-review", "state-delta", "span-repair"],
  "critic-review": ["span-repair", "state-delta"],
  "span-repair": ["deterministic-validation"],
  "state-delta": ["scene-accept", "span-repair"],
  "scene-accept": ["context-build", "chapter-stitch"],
  "chapter-stitch": ["chapter-validate"],
  "chapter-validate": ["chapter-commit", "span-repair"],
  "chapter-commit": ["complete"],
  complete: [],
});

export interface CreateChapterExecutionStateInput {
  runId: string;
  projectHash: string;
  canonSnapshotHash: string;
  contractHash: string;
  chapter: number;
  now?: string;
}

export function createChapterExecutionState(input: CreateChapterExecutionStateInput): ChapterExecutionState {
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
    attempt: 0,
    escalation_code: null,
    updated_at: input.now ?? new Date().toISOString(),
  };
}

export function transitionChapterExecution(state: ChapterExecutionState, next: ExecutionNode, now = new Date().toISOString()): ChapterExecutionState {
  if (state.status !== "active") throw new Error(`Execution run ${state.run_id} is ${state.status}, not active.`);
  if (!transitions[state.current_node].includes(next)) throw new Error(`Illegal execution transition: ${state.current_node} -> ${next}.`);
  return {
    ...state,
    current_node: next,
    status: next === "complete" ? "completed" : "active",
    completed_nodes: [...state.completed_nodes, state.current_node],
    attempt: 0,
    updated_at: now,
  };
}

export function validateChapterExecutionResume(state: ChapterExecutionState, currentProjectHash: string): void {
  if (state.project_hash !== currentProjectHash) throw new Error("Cannot resume chapter execution because the canonical project hash changed; rebase and recompile contracts first.");
  if (["failed", "completed"].includes(state.status)) throw new Error(`Execution run ${state.run_id} is ${state.status} and cannot resume.`);
}

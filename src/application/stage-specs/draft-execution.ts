import type { StageSpec } from "./types.js";

export interface SceneExecutionDraftStageInput {
  root: string;
  bookId: string;
  chapter: number;
  estimatedTokens: number;
  excluded: readonly string[];
  projectHash: string;
}

export function sceneExecutionDraftStageSpec(input: SceneExecutionDraftStageInput): StageSpec {
  return {
    id: "draft-chapter",
    role: "a resumable scene-and-chapter execution coordinator",
    objective: `Advance exactly Chapter ${input.chapter} for ${input.bookId} through prepared scene contracts, isolated model jobs, deterministic validation, ordered acceptance, chapter validation, and guarded canonical commit.`,
    inputs: [
      `Project root: ${input.root}`,
      `Active book: ${input.bookId}`,
      `Target chapter: ${input.chapter}`,
      `Orientation context: ~${input.estimatedTokens} tokens; excluded: ${input.excluded.join(", ") || "none"}.`,
      `Prepared project hash at prompt creation: ${input.projectHash}`,
    ],
    must: [
      "Use novel_advance_chapter_step for every drafting stage; the tool owns bounded context selection, scene planning, drafting, critics, repair, state delta, acceptance, stitching, validation, and canonical commit.",
      "Call the tool one persisted stage at a time.",
      "On the first call, pass the project root and chapter. Read the returned run_id and reuse that same run_id on every later call for this chapter.",
      "After each call, inspect action, checkpoint, scene, and status before deciding whether another call is allowed.",
      "Continue only while status is active and no writer gate or blocker is reported.",
      "Stop immediately on blocked, paused, cancelled, stopped, completed, stale ownership, missing evidence, or a pending/rejected writer gate.",
    ],
    avoid: [
      "Do not draft the whole chapter in the host response.",
      "Do not call novel_apply_event with event_type draft-chapter.",
      "Do not write manuscript files, run artifacts, PROJECT.yaml, BOOK.yaml, STATUS.md, HANDOFF.md, or canonical story ledgers directly.",
      "Do not replay a completed model job or invent an attempt number.",
      "Do not bypass repair, validation, scene order, or writer approval boundaries.",
      "Do not turn audit metrics into prose quotas or mechanical style targets.",
      "Do not chase AI-detector patterns, mechanically restate the hook, manufacture quotable lines, or pad to target length.",
    ],
    outputs: [
      "one novel_advance_chapter_step result per tool call",
      "a canonical chapter only after the tool reports chapter-committed or complete",
    ],
    validation: [
      "Every tool call reuses the same run_id after preparation.",
      "Exactly one persisted stage advances per call.",
      "No host-authored chapter prose or direct project-file write occurs.",
      "The loop stops at completion, a blocker, or a writer gate.",
    ],
    toolRules: [
      "Call novel_advance_chapter_step with project_root and chapter for the first persisted stage.",
      "For every subsequent call, pass project_root, chapter, and the exact same run_id returned by the first call.",
      "Use one tool call at a time. Never batch or predict later stages.",
      "Use the default full critic set unless the writer explicitly selected a narrower critic set.",
      "Do not use novel_apply_event for chapter drafting or canonical chapter commit.",
      "The tool result is authoritative for the next checkpoint and whether execution may continue.",
    ],
  };
}

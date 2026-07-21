import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import {
  chapterExecutionStatePath,
  readChapterExecutionState,
  writeChapterExecutionState,
} from "../src/infrastructure/chapter-execution-store.js";

test("execution state writes atomically and reloads at the next node", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-execution-state-"));
  try {
    let state = createChapterExecutionState({
      runId: "SMR-002",
      projectHash: "a".repeat(64),
      canonSnapshotHash: "b".repeat(64),
      contractHash: "c".repeat(64),
      chapter: 2,
      now: "2026-07-21T20:00:00.000Z",
    });
    state = transitionChapterExecution(state, "scene-contract-compile", state.updated_at);
    state = transitionChapterExecution(state, "context-build", state.updated_at);
    state = transitionChapterExecution(state, "scene-plan", state.updated_at);
    state = transitionChapterExecution(state, "scene-draft", state.updated_at, "SCN-201");
    const path = writeChapterExecutionState(root, state);
    assert.equal(path, chapterExecutionStatePath(root, "SMR-002"));
    assert.deepEqual(readChapterExecutionState(root, "SMR-002"), state);
    const names = readdirSync(join(root, ".pi-book", "runs", "SMR-002"));
    assert.deepEqual(names, ["execution-state.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("execution state store rejects unsafe run IDs", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-execution-state-"));
  try {
    assert.throws(() => readChapterExecutionState(root, "../escape"), /invalid run id/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

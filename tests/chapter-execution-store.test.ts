import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChapterExecutionState } from "../src/application/chapter-execution-machine.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";

test("execution state round-trips beneath .pi-book runs", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-execution-"));
  try {
    const state = createChapterExecutionState({
      runId: "SM-STORE-001",
      projectHash: "a".repeat(64),
      canonSnapshotHash: "b".repeat(64),
      contractHash: "c".repeat(64),
      chapter: 4,
      now: "2026-07-21T00:00:00.000Z",
    });
    writeChapterExecutionState(root, state);
    assert.deepEqual(readChapterExecutionState(root, state.run_id), state);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid persisted state is rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-execution-invalid-"));
  try {
    assert.throws(() => readChapterExecutionState(root, "missing"), /does not exist/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

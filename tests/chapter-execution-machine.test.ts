import test from "node:test";
import assert from "node:assert/strict";
import {
  createChapterExecutionState,
  transitionChapterExecution,
  validateChapterExecutionResume,
} from "../src/application/chapter-execution-machine.js";

test("chapter execution follows legal transitions", () => {
  const initial = createChapterExecutionState({
    runId: "SM-001",
    projectHash: "a".repeat(64),
    canonSnapshotHash: "b".repeat(64),
    contractHash: "c".repeat(64),
    chapter: 1,
  });
  const planned = transitionChapterExecution(initial, "scene-contract-compile");
  assert.equal(planned.current_node, "scene-contract-compile");
  assert.equal(planned.status, "active");
});

test("illegal chapter execution transitions fail deterministically", () => {
  const initial = createChapterExecutionState({
    runId: "SM-002",
    projectHash: "a".repeat(64),
    canonSnapshotHash: "b".repeat(64),
    contractHash: "c".repeat(64),
    chapter: 2,
  });
  assert.throws(() => transitionChapterExecution(initial, "chapter-commit"), /Illegal execution transition/);
});

test("resume rejects canonical project drift", () => {
  const initial = createChapterExecutionState({
    runId: "SM-003",
    projectHash: "a".repeat(64),
    canonSnapshotHash: "b".repeat(64),
    contractHash: "c".repeat(64),
    chapter: 3,
  });
  assert.throws(() => validateChapterExecutionResume(initial, "d".repeat(64)), /project hash changed/);
});

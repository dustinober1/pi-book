import test from "node:test";
import assert from "node:assert/strict";
import {
  createChapterExecutionState,
  pauseChapterExecution,
  resumeChapterExecution,
  transitionChapterExecution,
} from "../src/application/chapter-execution-machine.js";

const binding = {
  runId: "SMR-001",
  projectHash: "a".repeat(64),
  canonSnapshotHash: "b".repeat(64),
  contractHash: "c".repeat(64),
  chapter: 1,
  now: "2026-07-21T20:00:00.000Z",
};

test("chapter execution rejects illegal transitions deterministically", () => {
  const state = createChapterExecutionState(binding);
  assert.throws(() => transitionChapterExecution(state, "scene-draft", binding.now), /Illegal chapter execution transition: contract-compile -> scene-draft/);
  assert.equal(state.current_node, "contract-compile");
});

test("scene planning advances to scene drafting and resumes without replay", () => {
  let state = createChapterExecutionState(binding);
  state = transitionChapterExecution(state, "scene-contract-compile", binding.now);
  state = transitionChapterExecution(state, "context-build", binding.now);
  state = transitionChapterExecution(state, "scene-plan", binding.now);
  state = transitionChapterExecution(state, "scene-draft", binding.now, "SCN-001");
  state = pauseChapterExecution(state, "2026-07-21T20:01:00.000Z");
  const resumed = resumeChapterExecution(state, {
    projectHash: binding.projectHash,
    canonSnapshotHash: binding.canonSnapshotHash,
    contractHash: binding.contractHash,
    now: "2026-07-21T20:02:00.000Z",
  });
  assert.equal(resumed.status, "active");
  assert.equal(resumed.current_node, "scene-draft");
  assert.equal(resumed.current_scene_id, "SCN-001");
  assert.ok(resumed.completed_nodes.includes("SCN-001:scene-plan"));
});

test("resume blocks stale canonical bindings without mutating saved state", () => {
  const paused = pauseChapterExecution(createChapterExecutionState(binding), "2026-07-21T20:01:00.000Z");
  assert.throws(() => resumeChapterExecution(paused, {
    projectHash: "d".repeat(64),
    canonSnapshotHash: binding.canonSnapshotHash,
    contractHash: binding.contractHash,
    now: "2026-07-21T20:02:00.000Z",
  }), /project hash changed/i);
  assert.equal(paused.status, "paused");
  assert.equal(paused.project_hash, binding.projectHash);
});

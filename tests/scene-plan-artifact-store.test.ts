import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScenePlanArtifact } from "../src/domain/scene-plan-artifact.js";
import { readScenePlanArtifact, scenePlanArtifactPath, writeScenePlanArtifact } from "../src/infrastructure/scene-plan-artifact-store.js";

function artifact(): ScenePlanArtifact {
  return {
    schema_version: "1.0.0", run_id: "RUN-001", chapter: 1, scene_id: "CH-001-SC-01-V1",
    capsule_id: "CAP-5555555555555555", contract_hash: "a".repeat(64), story_index_hash: "b".repeat(64),
    plan_attempt: 1,
    steps: [{ required_beat: "Enter", execution: "Mara enters.", pressure: "A patrol approaches." }],
    turn_execution: "She finds a conduit.", ending_execution: "She reaches the terminal.", evidence_record_ids: ["CAN-ACCESS"],
    usage: {
      callId: "plan", stage: "drafting", chapter: 1, sceneId: "CH-001-SC-01-V1", attempt: 1,
      pass: "plan", jobType: "plan-scene", contractHash: "a".repeat(64), capsuleHash: "c".repeat(64),
      includedRecordCount: 1, estimated: true, elapsedMs: 1, promptHash: "d".repeat(64), contextHash: "e".repeat(64), outputHash: "f".repeat(64),
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene plan artifacts persist atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-plan-artifact-"));
  try {
    const value = artifact();
    const path = writeScenePlanArtifact(root, value);
    assert.equal(path, scenePlanArtifactPath(root, value.run_id, value.scene_id, value.plan_attempt));
    assert.deepEqual(readScenePlanArtifact(root, value.run_id, value.scene_id, value.plan_attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["plan-attempt-1.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("scene plan storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-plan-artifact-"));
  try {
    assert.throws(() => readScenePlanArtifact(root, "../escape", "CH-001-SC-01-V1", 1), /invalid run id/i);
    assert.throws(() => readScenePlanArtifact(root, "RUN-001", "../scene", 1), /invalid scene id/i);
    assert.throws(() => readScenePlanArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0), /attempt/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

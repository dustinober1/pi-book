import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneStateDeltaArtifact } from "../src/domain/scene-state-delta-artifact.js";
import {
  readSceneStateDeltaArtifact,
  sceneStateDeltaArtifactPath,
  writeSceneStateDeltaArtifact,
} from "../src/infrastructure/scene-state-delta-artifact-store.js";

function artifact(): SceneStateDeltaArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    draft_attempt: 1,
    draft_output_hash: "a".repeat(64),
    capsule_id: "CAP-4444444444444444",
    contract_hash: "b".repeat(64),
    extraction_attempt: 1,
    expected_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
    actual_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal." }],
    mismatches: [],
    matches_expected: true,
    next_action: "scene-accept",
    usage: {
      callId: "delta-1",
      stage: "drafting",
      chapter: 1,
      sceneId: "CH-001-SC-01-V1",
      attempt: 1,
      pass: "verification",
      jobType: "extract-state-delta",
      contractHash: "b".repeat(64),
      capsuleHash: "c".repeat(64),
      includedRecordCount: 1,
      estimated: true,
      elapsedMs: 1,
      promptHash: "d".repeat(64),
      contextHash: "e".repeat(64),
      outputHash: "f".repeat(64),
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene state-delta artifacts persist atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-delta-artifact-"));
  try {
    const value = artifact();
    const path = writeSceneStateDeltaArtifact(root, value);
    assert.equal(path, sceneStateDeltaArtifactPath(root, value.run_id, value.scene_id, value.draft_attempt, value.extraction_attempt));
    assert.deepEqual(readSceneStateDeltaArtifact(root, value.run_id, value.scene_id, value.draft_attempt, value.extraction_attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["state-delta-draft-1-attempt-1.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scene state-delta storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-delta-artifact-"));
  try {
    assert.throws(() => readSceneStateDeltaArtifact(root, "../escape", "CH-001-SC-01-V1", 1, 1), /invalid run id/i);
    assert.throws(() => readSceneStateDeltaArtifact(root, "RUN-001", "../scene", 1, 1), /invalid scene id/i);
    assert.throws(() => readSceneStateDeltaArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0, 1), /attempt/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

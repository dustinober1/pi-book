import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import {
  readSceneDraftArtifact,
  sceneDraftArtifactPath,
  writeSceneDraftArtifact,
} from "../src/infrastructure/scene-draft-artifact-store.js";

function artifact(): SceneDraftArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    chapter_contract_id: "CH-001",
    chapter_contract_version: 1,
    job_type: "draft-scene",
    capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: "a".repeat(64),
    story_index_hash: "b".repeat(64),
    model_execution_profile: "small-12b-q4",
    runtime_profile: "tiny-local",
    attempt: 1,
    prose: "Mara reached the terminal.",
    word_count: 4,
    output_hash: "c".repeat(64),
    usage: {
      callId: "RUN-001-CH-001-SC-01-V1-DRAFT-1",
      stage: "drafting",
      chapter: 1,
      pass: "candidate",
      jobType: "draft-scene",
      sceneId: "CH-001-SC-01-V1",
      attempt: 1,
      contractHash: "a".repeat(64),
      capsuleHash: "d".repeat(64),
      includedRecordCount: 0,
      estimated: true,
      elapsedMs: 1,
      promptHash: "e".repeat(64),
      contextHash: "f".repeat(64),
      outputHash: "c".repeat(64),
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene draft artifacts write atomically and reload exactly", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-artifact-"));
  try {
    const value = artifact();
    const path = writeSceneDraftArtifact(root, value);
    assert.equal(path, sceneDraftArtifactPath(root, value.run_id, value.scene_id, value.attempt));
    assert.deepEqual(readSceneDraftArtifact(root, value.run_id, value.scene_id, value.attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["draft-attempt-1.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scene draft artifact storage rejects unsafe identifiers and attempts", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-artifact-"));
  try {
    assert.throws(() => readSceneDraftArtifact(root, "../escape", "CH-001-SC-01-V1", 1), /invalid run id/i);
    assert.throws(() => readSceneDraftArtifact(root, "RUN-001", "../scene", 1), /invalid scene id/i);
    assert.throws(() => readSceneDraftArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0), /attempt/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

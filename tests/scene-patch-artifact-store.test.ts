import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScenePatchArtifact } from "../src/domain/scene-patch-artifact.js";
import {
  readScenePatchArtifact,
  scenePatchArtifactPath,
  writeScenePatchArtifact,
} from "../src/infrastructure/scene-patch-artifact-store.js";

function artifact(): ScenePatchArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    source_draft_attempt: 1,
    repaired_draft_attempt: 2,
    source_output_hash: "a".repeat(64),
    repaired_output_hash: "b".repeat(64),
    capsule_id: "CAP-3333333333333333",
    contract_hash: "c".repeat(64),
    story_index_hash: "d".repeat(64),
    patch_attempt: 1,
    operations: [{
      operation: "replace",
      anchor_quote: "The panel stayed dark.",
      replacement: "The panel remained unlit.",
      finding_refs: ["critic-style:1"],
      start: 10,
      end: 32,
    }],
    affected_character_count: 22,
    replacement_character_count: 25,
    usage: {
      callId: "patch-1",
      stage: "drafting",
      chapter: 1,
      sceneId: "CH-001-SC-01-V1",
      attempt: 1,
      pass: "revision",
      jobType: "patch-spans",
      contractHash: "c".repeat(64),
      capsuleHash: "e".repeat(64),
      includedRecordCount: 0,
      estimated: true,
      elapsedMs: 1,
      promptHash: "f".repeat(64),
      contextHash: "1".repeat(64),
      outputHash: "2".repeat(64),
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene patch artifacts write atomically and reload exactly", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-patch-artifact-"));
  try {
    const value = artifact();
    const path = writeScenePatchArtifact(root, value);
    assert.equal(path, scenePatchArtifactPath(root, value.run_id, value.scene_id, value.patch_attempt));
    assert.deepEqual(readScenePatchArtifact(root, value.run_id, value.scene_id, value.patch_attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["patch-attempt-1.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scene patch storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-patch-artifact-"));
  try {
    assert.throws(() => readScenePatchArtifact(root, "../escape", "CH-001-SC-01-V1", 1), /invalid run id/i);
    assert.throws(() => readScenePatchArtifact(root, "RUN-001", "../scene", 1), /invalid scene id/i);
    assert.throws(() => readScenePatchArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0), /attempt/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

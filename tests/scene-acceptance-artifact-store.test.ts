import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneAcceptanceArtifact } from "../src/domain/scene-acceptance-artifact.js";
import {
  readSceneAcceptanceArtifact,
  sceneAcceptanceArtifactPath,
  writeSceneAcceptanceArtifact,
} from "../src/infrastructure/scene-acceptance-artifact-store.js";

function artifact(): SceneAcceptanceArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    draft_attempt: 1,
    draft_output_hash: "a".repeat(64),
    draft_capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: "b".repeat(64),
    story_index_hash: "c".repeat(64),
    validation_artifact_hash: "d".repeat(64),
    critic_summary_artifact_hash: "e".repeat(64),
    state_delta_artifact_hash: "f".repeat(64),
    state_delta_extraction_attempt: 1,
    accepted_prose: "Mara reached the terminal.",
    word_count: 4,
    accepted_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal." }],
    next_node: "context-build",
    next_scene_id: "CH-001-SC-02-V1",
    accepted_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene acceptance artifacts persist atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-accept-artifact-"));
  try {
    const value = artifact();
    const path = writeSceneAcceptanceArtifact(root, value);
    assert.equal(path, sceneAcceptanceArtifactPath(root, value.run_id, value.scene_id, value.draft_attempt));
    assert.deepEqual(readSceneAcceptanceArtifact(root, value.run_id, value.scene_id, value.draft_attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["acceptance-draft-1.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("scene acceptance storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-accept-artifact-"));
  try {
    assert.throws(() => readSceneAcceptanceArtifact(root, "../escape", "CH-001-SC-01-V1", 1), /invalid run id/i);
    assert.throws(() => readSceneAcceptanceArtifact(root, "RUN-001", "../scene", 1), /invalid scene id/i);
    assert.throws(() => readSceneAcceptanceArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0), /attempt/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

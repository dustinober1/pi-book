import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import {
  readSceneValidationArtifact,
  sceneValidationArtifactPath,
  writeSceneValidationArtifact,
} from "../src/infrastructure/scene-validation-artifact-store.js";

function artifact(): SceneValidationArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    draft_attempt: 1,
    draft_output_hash: "a".repeat(64),
    capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: "b".repeat(64),
    findings: [],
    blocker_count: 0,
    warning_count: 0,
    passed: true,
    next_node: "critic-review",
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("scene validation artifacts write atomically and reload exactly", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-validation-artifact-"));
  try {
    const value = artifact();
    const path = writeSceneValidationArtifact(root, value);
    assert.equal(path, sceneValidationArtifactPath(root, value.run_id, value.scene_id, value.draft_attempt));
    assert.deepEqual(readSceneValidationArtifact(root, value.run_id, value.scene_id, value.draft_attempt), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "scenes", value.scene_id)), ["validation-attempt-1.json"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scene validation artifact storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scene-validation-artifact-"));
  try {
    assert.throws(() => readSceneValidationArtifact(root, "../escape", "CH-001-SC-01-V1", 1), /invalid run id/i);
    assert.throws(() => readSceneValidationArtifact(root, "RUN-001", "../scene", 1), /invalid scene id/i);
    assert.throws(() => readSceneValidationArtifact(root, "RUN-001", "CH-001-SC-01-V1", 0), /attempt/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

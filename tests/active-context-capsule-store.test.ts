import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildActiveContextCapsule } from "../src/context/active-context-capsule.js";
import {
  activeContextCapsulePath,
  readActiveContextCapsule,
  writeActiveContextCapsule,
} from "../src/infrastructure/context-capsule-store.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import type { SceneContract } from "../src/domain/scene-contract.js";
import type { StoryRecordIndex } from "../src/context/story-record-index.js";

const storyIndex: StoryRecordIndex = {
  schema_version: "1.0.0",
  records: [{ id: "CHAR-MARA", record_type: "entity", status: "current-state", source_path: "series/entity-registry.yaml", introduced_in: "series-plan", chapter_scope: [], payload: { name: "Mara" }, dependencies: [] }],
  manifest: { source_hashes: {}, record_count: 1 },
};
const sceneContract: SceneContract = {
  schema_version: "1.0.0",
  scene_id: "CH-001-SC-01-V1",
  chapter_contract_id: "CH-001",
  chapter_contract_version: 1,
  sequence: 1,
  pov: "CHAR-MARA",
  objective: "Enter.",
  conflict: "Locked door.",
  turn: "Maintenance route.",
  required_beats: ["Enter"],
  active_thread_ids: [],
  required_record_ids: [],
  start_state_ids: [],
  expected_state_delta: [],
  forbidden_changes: [],
  knowledge_boundary_ids: [],
  target_words: { minimum: 700, maximum: 900 },
  ending_requirement: "Reach terminal.",
};

test("capsules write atomically under a run-local cache and reload exactly", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-context-capsule-"));
  try {
    const capsule = buildActiveContextCapsule({
      storyIndex,
      sceneContract,
      modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
      jobType: "draft-scene",
      openingRules: ["Preserve canon."],
      closingTask: ["Draft the scene."],
    });
    const path = writeActiveContextCapsule(root, "RUN-001", capsule);
    assert.equal(path, activeContextCapsulePath(root, "RUN-001", capsule));
    assert.deepEqual(readActiveContextCapsule(root, "RUN-001", capsule.capsule_id), capsule);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", "RUN-001", "capsules")), [`${capsule.capsule_id}.json`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("capsule store rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-context-capsule-"));
  try {
    assert.throws(() => readActiveContextCapsule(root, "../escape", "CAP-0123456789ABCDEF"), /invalid run id/i);
    assert.throws(() => readActiveContextCapsule(root, "RUN-001", "../capsule"), /invalid capsule id/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

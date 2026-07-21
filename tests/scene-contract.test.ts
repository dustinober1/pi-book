import test from "node:test";
import assert from "node:assert/strict";
import { compileSceneContracts } from "../src/application/contracts/scene-contract-compiler.js";
import type { ChapterContract } from "../src/domain/chapter-contract.js";

const chapter: ChapterContract = {
  schema_version: "2.0.0",
  contract_id: "CH-001",
  version: 1,
  chapter: 1,
  title: "The Archive",
  source_kind: "approved-contract",
  source_packet_hash: "a".repeat(64),
  pov: "CHAR-MARA",
  purpose: "Recover the ledger.",
  required_beats: ["Enter archive", "Discover prior access", "Choose evidence over safety"],
  active_thread_ids: ["THREAD-LEDGER"],
  required_record_ids: ["CHAR-MARA", "THREAD-LEDGER"],
  start_state_ids: ["STATE-MARA-001"],
  required_end_state: [{ record_id: "STATE-MARA-001", field: "knowledge", operation: "add", value: "FACT-PRIOR-ACCESS" }],
  forbidden_changes: ["Do not identify the prior user."],
  knowledge_boundary_ids: ["KNOW-MARA-001"],
  target_words: { minimum: 2100, maximum: 2600 },
  ending_hook: "Someone used the terminal first.",
  small_model_ready: true,
  missing_small_model_fields: [],
};

test("scene compiler assigns every beat and preserves forbidden changes", () => {
  const scenes = compileSceneContracts(chapter, 3);
  assert.equal(scenes.length, 3);
  assert.deepEqual(scenes.flatMap((scene) => scene.required_beats), chapter.required_beats);
  assert.ok(scenes.every((scene) => scene.forbidden_changes.includes("Do not identify the prior user.")));
});

test("scene word ranges cover the chapter target range", () => {
  const scenes = compileSceneContracts(chapter, 3);
  assert.equal(scenes.reduce((sum, scene) => sum + scene.target_words.minimum, 0), chapter.target_words.minimum);
  assert.equal(scenes.reduce((sum, scene) => sum + scene.target_words.maximum, 0), chapter.target_words.maximum);
});

test("scene IDs remain stable for the same chapter contract version", () => {
  assert.deepEqual(
    compileSceneContracts(chapter, 2).map((scene) => scene.scene_id),
    compileSceneContracts(chapter, 2).map((scene) => scene.scene_id),
  );
});

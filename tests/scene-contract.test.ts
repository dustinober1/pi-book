import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  compileSceneContracts,
  sceneContractFindings,
} from "../src/application/contracts/scene-contract-compiler.js";
import { SceneContractSchema } from "../src/domain/scene-contract.js";
import type { ChapterContract } from "../src/domain/chapter-contract.js";

function chapterContract(): ChapterContract {
  return {
    schema_version: "2.0.0",
    contract_id: "CH-001",
    chapter: 1,
    title: "The False Alarm",
    status: "approved",
    pov: "CHAR-MARA-001",
    tense: "past",
    purpose: "Establish the impossible archive alarm.",
    start_state_refs: ["STATE-MARA-LOCATION-001"],
    required_end_state: [{ id: "EXP-001", subject_ref: "CHAR-MARA-001", field: "knowledge", operation: "add", value: "FACT-ALARM-FALSE-001" }],
    required_beat_ids: ["BEAT-001", "BEAT-002", "BEAT-003"],
    forbidden_change_ids: ["LOCK-IDENTITY-001"],
    knowledge_boundary_ids: ["KNOW-MARA-001"],
    allowed_invention_rules: ["Incidental physical detail only."],
    active_thread_ids: ["THREAD-ALARM-001"],
    required_research_ids: [],
    scene_ids: ["SCN-001", "SCN-002"],
    style_card_ref: "STYLE-MARA-001",
    target_words: { minimum: 2200, maximum: 2800 },
    acceptance_tests: [{ id: "TEST-001", category: "required-beat", description: "Required beats appear.", record_ids: ["BEAT-001", "BEAT-002", "BEAT-003"] }],
    stop_conditions: ["Stop if a protected reveal would be required."],
    source_packet_hash: "c".repeat(64),
  };
}

test("scene compiler creates stable bounded contracts that cover the chapter", () => {
  const scenes = compileSceneContracts({
    chapter: chapterContract(),
    knowledgeBoundaries: [{ id: "KNOW-MARA-001", pov_refs: ["CHAR-MARA-001"] }],
    scenes: [
      {
        objective: "Reach the archive terminal.",
        conflict: "The credential has been revoked.",
        turn: "Mara finds a maintenance route.",
        location_ref: "LOC-ARCHIVE-001",
        time_ref: "TIME-DAY1-2215",
        required_beat_ids: ["BEAT-001"],
        expected_delta: [],
        target_words: { minimum: 1000, maximum: 1300 },
      },
      {
        objective: "Read the alarm record.",
        conflict: "The record is actively changing.",
        turn: "The log proves earlier access without naming the user.",
        location_ref: "LOC-ARCHIVE-001",
        time_ref: "TIME-DAY1-2225",
        required_beat_ids: ["BEAT-002", "BEAT-003"],
        expected_delta: [{ id: "EXP-001", subject_ref: "CHAR-MARA-001", field: "knowledge", operation: "add", value: "FACT-ALARM-FALSE-001" }],
        target_words: { minimum: 1200, maximum: 1500 },
      },
    ],
  });
  assert.deepEqual(scenes.map((scene) => scene.scene_id), ["SCN-001", "SCN-002"]);
  assert.deepEqual(scenes.map((scene) => scene.order), [1, 2]);
  assert.ok(scenes.every((scene) => scene.forbidden_change_ids.includes("LOCK-IDENTITY-001")));
  assert.ok(scenes.every((scene) => Value.Check(SceneContractSchema, scene)));
  assert.deepEqual(sceneContractFindings(chapterContract(), scenes, [{ id: "KNOW-MARA-001", pov_refs: ["CHAR-MARA-001"] }]), []);
});

test("scene validation blocks uncovered beats and unknown knowledge boundaries", () => {
  const chapter = chapterContract();
  const scenes = compileSceneContracts({
    chapter,
    knowledgeBoundaries: [{ id: "KNOW-MARA-001", pov_refs: ["CHAR-MARA-001"] }],
    scenes: [{
      objective: "Reach the archive terminal.",
      conflict: "The credential has been revoked.",
      turn: "Mara finds a maintenance route.",
      location_ref: null,
      time_ref: null,
      required_beat_ids: ["BEAT-001"],
      expected_delta: [],
      target_words: { minimum: 2200, maximum: 2800 },
    }, {
      objective: "Inspect the terminal.",
      conflict: "The display is incomplete.",
      turn: "Mara preserves a partial record.",
      location_ref: null,
      time_ref: null,
      required_beat_ids: ["BEAT-002"],
      expected_delta: [],
      target_words: { minimum: 100, maximum: 100 },
    }],
  });
  scenes[0]!.knowledge_boundary_ids = ["KNOW-UNKNOWN-999"];
  const codes = sceneContractFindings(chapter, scenes, [{ id: "KNOW-MARA-001", pov_refs: ["CHAR-MARA-001"] }]).map((finding) => finding.code);
  assert.ok(codes.includes("uncovered-required-beat"));
  assert.ok(codes.includes("unknown-knowledge-boundary"));
});

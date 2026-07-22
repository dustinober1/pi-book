import test from "node:test";
import assert from "node:assert/strict";
import { buildActiveContextCapsule } from "../src/context/active-context-capsule.js";
import { renderActiveContextCapsule } from "../src/context/active-context-renderer.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import type { SceneContract } from "../src/domain/scene-contract.js";
import type { StoryRecordIndex } from "../src/context/story-record-index.js";

const sourceHash = "a".repeat(64);
const storyIndex: StoryRecordIndex = {
  records: [
    { id: "CHAR-MARA", kind: "entity", status: "current-state", source_path: "series/entity-registry.yaml", source_hash: sourceHash, version: 1, chapter_scope: [], payload: { display_name: "Mara" }, dependencies: [] },
    { id: "CAN-001", kind: "canon-fact", status: "locked-canon", source_path: "series/canon.yaml", source_hash: sourceHash, version: 1, chapter_scope: [1], payload: { fact: "The archive requires a credential." }, dependencies: [] },
    { id: "STATE-001", kind: "state", status: "current-state", source_path: "series/state-ledger.yaml", source_hash: sourceHash, version: 1, chapter_scope: [1], payload: { field: "location", value: "LOC-ARCHIVE" }, dependencies: [] },
    { id: "PLAN-001", kind: "state", status: "required-future-event", source_path: "series/state-ledger.yaml", source_hash: sourceHash, version: 1, chapter_scope: [1], payload: { requirement: "Mara must leave with a copied log." }, dependencies: [] },
  ],
  manifest: {
    schema_version: "1.0.0",
    sources: [
      { path: "series/canon.yaml", hash: sourceHash },
      { path: "series/entity-registry.yaml", hash: sourceHash },
      { path: "series/state-ledger.yaml", hash: sourceHash },
    ],
    record_count: 4,
    index_hash: "f".repeat(64),
  },
};

const sceneContract: SceneContract = {
  schema_version: "1.0.0",
  scene_id: "CH-001-SC-01-V1",
  chapter_contract_id: "CH-001",
  chapter_contract_version: 1,
  sequence: 1,
  pov: "CHAR-MARA",
  objective: "Reach the archive terminal.",
  conflict: "Mara's credential is revoked.",
  turn: "She finds a maintenance path.",
  required_beats: ["Enter", "Discover revoked access"],
  active_thread_ids: [],
  required_record_ids: ["CAN-001", "PLAN-001"],
  start_state_ids: ["STATE-001"],
  expected_state_delta: [],
  forbidden_changes: ["Do not identify the prior user."],
  knowledge_boundary_ids: [],
  target_words: { minimum: 700, maximum: 1000 },
  ending_requirement: "Mara reaches the terminal unseen.",
};

test("compact rendering puts non-negotiable rules first and exact task last", () => {
  const capsule = buildActiveContextCapsule({
    storyIndex,
    sceneContract,
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    openingRules: ["Use only supplied records.", "Never treat proposals as completed events."],
    previousTail: "The security door clicked shut behind Mara.",
    styleCard: "Close third-person. Concrete procedural detail. No rhetorical fragments.",
    closingTask: ["Draft scene CH-001-SC-01-V1 only.", "Return scene prose and no commentary."],
  });
  const rendered = renderActiveContextCapsule(capsule, { style: "compact" });
  assert.ok(rendered.startsWith("NON-NEGOTIABLE RULES\n- Use only supplied records."));
  assert.ok(rendered.endsWith("EXACT TASK\n- Draft scene CH-001-SC-01-V1 only.\n- Return scene prose and no commentary."));
  assert.ok(rendered.indexOf("ESTABLISHED RECORDS") < rendered.indexOf("REQUIREMENTS AND PROPOSALS"));
  assert.ok(rendered.indexOf("PREVIOUS TAIL") < rendered.indexOf("EXACT TASK"));
  assert.ok(rendered.indexOf("STYLE CARD") < rendered.indexOf("EXACT TASK"));
  assert.match(rendered, /CAN-001/);
  assert.match(rendered, /PLAN-001/);
  assert.doesNotMatch(rendered, /raw prompt|private reasoning/i);
});

test("standard rendering remains deterministic and never converts requirements into facts", () => {
  const capsule = buildActiveContextCapsule({
    storyIndex,
    sceneContract,
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    openingRules: ["Preserve authority labels."],
    closingTask: ["Draft the scene."],
  });
  const first = renderActiveContextCapsule(capsule, { style: "standard" });
  const second = renderActiveContextCapsule(capsule, { style: "standard" });
  assert.equal(first, second);
  assert.match(first, /Authority: requirement/);
  assert.doesNotMatch(first, /PLAN-001[^\n]*Authority: established/);
});

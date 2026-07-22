import test from "node:test";
import assert from "node:assert/strict";
import {
  ActiveContextCapsuleError,
  buildActiveContextCapsule,
} from "../src/context/active-context-capsule.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import type { SceneContract } from "../src/domain/scene-contract.js";
import type { StoryRecordIndex } from "../src/context/story-record-index.js";

function index(): StoryRecordIndex {
  return {
    schema_version: "1.0.0",
    records: [
      { id: "CAN-ACCESS", record_type: "canon-fact", status: "locked-canon", source_path: "series/canon.yaml", introduced_in: "chapter-00", chapter_scope: ["chapter-00"], payload: { fact: "Mara has archive access." }, dependencies: ["CHAR-MARA"] },
      { id: "CHAR-MARA", record_type: "entity", status: "current-state", source_path: "series/entity-registry.yaml", introduced_in: "series-plan", chapter_scope: [], payload: { display_name: "Mara Vale" }, dependencies: [] },
      { id: "STATE-MARA-LOCATION", record_type: "state", status: "current-state", source_path: "series/state-ledger.yaml", introduced_in: "chapter-01", chapter_scope: ["chapter-01"], payload: { field: "location", value: "LOC-ARCHIVE" }, dependencies: ["CHAR-MARA", "LOC-ARCHIVE"] },
      { id: "LOC-ARCHIVE", record_type: "entity", status: "current-state", source_path: "series/entity-registry.yaml", introduced_in: "series-plan", chapter_scope: [], payload: { display_name: "Central Archive" }, dependencies: [] },
      { id: "KNOW-MARA-USER", record_type: "knowledge", status: "current-state", source_path: "series/knowledge-ledger.yaml", introduced_in: "chapter-01", chapter_scope: ["chapter-01"], payload: { knowledge: "unknown" }, dependencies: ["CHAR-MARA", "FACT-PRIOR-USER"] },
      { id: "FACT-PRIOR-USER", record_type: "canon-fact", status: "accepted-manuscript-fact", source_path: "series/canon.yaml", introduced_in: "chapter-01", chapter_scope: ["chapter-01"], payload: { fact: "Someone accessed the archive earlier." }, dependencies: [] },
      { id: "PLAN-MARA-VAULT", record_type: "state", status: "proposed-plan", source_path: "series/state-ledger.yaml", introduced_in: "chapter-04", chapter_scope: ["chapter-04"], payload: { field: "location", value: "LOC-VAULT" }, dependencies: ["CHAR-MARA"] },
      { id: "THREAD-ALARM", record_type: "story-thread", status: "current-state", source_path: "series/story-threads.yaml", introduced_in: "chapter-01", chapter_scope: ["chapter-01"], payload: { status: "open" }, dependencies: ["CHAR-MARA"] },
      { id: "CAN-OPTIONAL", record_type: "canon-fact", status: "accepted-manuscript-fact", source_path: "series/canon.yaml", introduced_in: "chapter-00", chapter_scope: ["chapter-00"], payload: { fact: "Optional support." }, dependencies: [] },
    ],
    manifest: { source_hashes: { "series/canon.yaml": "a".repeat(64) }, record_count: 9 },
  };
}

function scene(): SceneContract {
  return {
    schema_version: "1.0.0",
    scene_id: "CH-001-SC-01-V1",
    chapter_contract_id: "CH-001",
    chapter_contract_version: 1,
    sequence: 1,
    pov: "CHAR-MARA",
    objective: "Reach the archive terminal.",
    conflict: "Mara's credential has been revoked.",
    turn: "She finds a maintenance route.",
    required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: ["THREAD-ALARM"],
    required_record_ids: ["CAN-ACCESS", "PLAN-MARA-VAULT"],
    start_state_ids: ["STATE-MARA-LOCATION"],
    expected_state_delta: [],
    forbidden_changes: ["Do not identify the prior user."],
    knowledge_boundary_ids: ["KNOW-MARA-USER"],
    target_words: { minimum: 700, maximum: 1000 },
    ending_requirement: "Mara reaches the terminal without being detected.",
  };
}

test("capsule selection closes explicit dependencies and labels authority", () => {
  const first = buildActiveContextCapsule({
    storyIndex: index(),
    sceneContract: scene(),
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    optionalRecordIds: ["CAN-OPTIONAL"],
    openingRules: ["Treat established records as facts.", "Treat proposals only as possible future plans."],
    closingTask: ["Draft only CH-001-SC-01-V1.", "End at the scene ending requirement."],
  });
  const second = buildActiveContextCapsule({
    storyIndex: index(),
    sceneContract: scene(),
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    optionalRecordIds: ["CAN-OPTIONAL"],
    openingRules: ["Treat established records as facts.", "Treat proposals only as possible future plans."],
    closingTask: ["Draft only CH-001-SC-01-V1.", "End at the scene ending requirement."],
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.manifest.missing_required_record_ids, []);
  assert.deepEqual(first.manifest.unsafe_required_record_ids, []);
  assert.ok(first.manifest.included_record_ids.includes("CHAR-MARA"));
  assert.ok(first.manifest.included_record_ids.includes("LOC-ARCHIVE"));
  assert.ok(first.manifest.included_record_ids.includes("FACT-PRIOR-USER"));
  assert.equal(first.records.find((record) => record.id === "CAN-ACCESS")?.authority, "established");
  assert.equal(first.records.find((record) => record.id === "PLAN-MARA-VAULT")?.authority, "proposal");
  assert.equal(first.records.find((record) => record.id === "KNOW-MARA-USER")?.required, true);
  assert.ok(first.manifest.estimated_evidence_tokens <= first.manifest.maximum_evidence_tokens);
});

test("missing or unsafe explicit records block before inference with exact IDs", () => {
  const missing = scene();
  missing.required_record_ids = ["CAN-NOT-FOUND"];
  assert.throws(() => buildActiveContextCapsule({
    storyIndex: index(),
    sceneContract: missing,
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    openingRules: ["Preserve canon."],
    closingTask: ["Draft the scene."],
  }), (error: unknown) => error instanceof ActiveContextCapsuleError
    && error.code === "missing-required-records"
    && error.recordIds.includes("CAN-NOT-FOUND"));

  const unsafeIndex = index();
  unsafeIndex.records.push({ id: "STATE-UNRESOLVED", record_type: "state", status: "unresolved", source_path: "series/state-ledger.yaml", introduced_in: null, chapter_scope: [], payload: {}, dependencies: [] });
  const unsafe = scene();
  unsafe.required_record_ids = ["STATE-UNRESOLVED"];
  assert.throws(() => buildActiveContextCapsule({
    storyIndex: unsafeIndex,
    sceneContract: unsafe,
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    openingRules: ["Preserve canon."],
    closingTask: ["Draft the scene."],
  }), (error: unknown) => error instanceof ActiveContextCapsuleError
    && error.code === "unsafe-required-records"
    && error.recordIds.includes("STATE-UNRESOLVED"));
});

test("required overflow stops and optional records are omitted whole", () => {
  const tinyProfile = structuredClone(MODEL_EXECUTION_PROFILES["small-12b-q4"]);
  tinyProfile.job_budgets["draft-scene"].maximumEvidenceTokens = 600;
  assert.throws(() => buildActiveContextCapsule({
    storyIndex: index(),
    sceneContract: scene(),
    modelProfile: tinyProfile,
    jobType: "draft-scene",
    openingRules: ["Preserve every required record."],
    closingTask: ["Draft the scene."],
  }), (error: unknown) => error instanceof ActiveContextCapsuleError && error.code === "required-context-overflow");

  const optionalHeavy = index();
  optionalHeavy.records.find((record) => record.id === "CAN-OPTIONAL")!.payload = { fact: "x".repeat(20_000) };
  const capsule = buildActiveContextCapsule({
    storyIndex: optionalHeavy,
    sceneContract: scene(),
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    optionalRecordIds: ["CAN-OPTIONAL"],
    openingRules: ["Preserve canon."],
    closingTask: ["Draft the scene."],
  });
  assert.equal(capsule.records.some((record) => record.id === "CAN-OPTIONAL"), false);
  assert.ok(capsule.manifest.omitted_record_ids.includes("CAN-OPTIONAL"));
  assert.equal(JSON.stringify(capsule).includes("x".repeat(100)), false);
});

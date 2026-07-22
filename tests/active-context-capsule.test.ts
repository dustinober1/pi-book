import test from "node:test";
import assert from "node:assert/strict";
import {
  ActiveContextCapsuleError,
  buildActiveContextCapsule,
} from "../src/context/active-context-capsule.js";
import { MODEL_EXECUTION_PROFILES, type ModelExecutionProfile } from "../src/domain/model-execution-profile.js";
import type { SceneContract } from "../src/domain/scene-contract.js";
import type { StoryRecordIndex, StoryRecordIndexRecord, StoryRecordKind } from "../src/context/story-record-index.js";
import type { StoryRecordStatus } from "../src/domain/story-record-status.js";

const sourceHash = "a".repeat(64);

function record(input: {
  id: string;
  kind: StoryRecordKind;
  status: StoryRecordStatus;
  source_path: string;
  payload: unknown;
  dependencies?: string[];
  chapter_scope?: number[];
}): StoryRecordIndexRecord {
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    source_path: input.source_path,
    source_hash: sourceHash,
    version: 1,
    chapter_scope: input.chapter_scope ?? [],
    payload: input.payload,
    dependencies: input.dependencies ?? [],
  };
}

function index(): StoryRecordIndex {
  const records = [
    record({ id: "CAN-ACCESS", kind: "canon-fact", status: "locked-canon", source_path: "series/canon.yaml", chapter_scope: [1], payload: { fact: "Mara has archive access." }, dependencies: ["CHAR-MARA"] }),
    record({ id: "CHAR-MARA", kind: "entity", status: "current-state", source_path: "series/entity-registry.yaml", payload: { display_name: "Mara Vale" } }),
    record({ id: "STATE-MARA-LOCATION", kind: "state", status: "current-state", source_path: "series/state-ledger.yaml", chapter_scope: [1], payload: { field: "location", value: "LOC-ARCHIVE" }, dependencies: ["CHAR-MARA", "LOC-ARCHIVE"] }),
    record({ id: "LOC-ARCHIVE", kind: "entity", status: "current-state", source_path: "series/entity-registry.yaml", payload: { display_name: "Central Archive" } }),
    record({ id: "KNOW-MARA-USER", kind: "knowledge", status: "current-state", source_path: "series/knowledge-ledger.yaml", chapter_scope: [1], payload: { knowledge: "unknown" }, dependencies: ["CHAR-MARA", "FACT-PRIOR-USER"] }),
    record({ id: "FACT-PRIOR-USER", kind: "canon-fact", status: "accepted-manuscript-fact", source_path: "series/canon.yaml", chapter_scope: [1], payload: { fact: "Someone accessed the archive earlier." } }),
    record({ id: "PLAN-MARA-VAULT", kind: "state", status: "proposed-plan", source_path: "series/state-ledger.yaml", chapter_scope: [4], payload: { field: "location", value: "LOC-VAULT" }, dependencies: ["CHAR-MARA"] }),
    record({ id: "THREAD-ALARM", kind: "story-thread", status: "current-state", source_path: "series/story-threads.yaml", chapter_scope: [1], payload: { status: "open" }, dependencies: ["CHAR-MARA"] }),
    record({ id: "CAN-OPTIONAL", kind: "canon-fact", status: "accepted-manuscript-fact", source_path: "series/canon.yaml", chapter_scope: [1], payload: { fact: "Optional support." } }),
  ];
  return {
    records,
    manifest: {
      schema_version: "1.0.0",
      sources: [...new Set(records.map((item) => item.source_path))].sort().map((path) => ({ path, hash: sourceHash })),
      record_count: records.length,
      index_hash: "f".repeat(64),
    },
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
  assert.equal(first.records.find((item) => item.id === "CAN-ACCESS")?.authority, "established");
  assert.equal(first.records.find((item) => item.id === "PLAN-MARA-VAULT")?.authority, "proposal");
  assert.equal(first.records.find((item) => item.id === "KNOW-MARA-USER")?.required, true);
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
  unsafeIndex.records.push(record({ id: "STATE-UNRESOLVED", kind: "state", status: "unresolved", source_path: "series/state-ledger.yaml", payload: {} }));
  unsafeIndex.manifest.record_count += 1;
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
  const base = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  const tinyProfile: ModelExecutionProfile = {
    ...base,
    job_budgets: {
      ...base.job_budgets,
      "draft-scene": { ...base.job_budgets["draft-scene"], maximumEvidenceTokens: 600 },
    },
  };
  assert.throws(() => buildActiveContextCapsule({
    storyIndex: index(),
    sceneContract: scene(),
    modelProfile: tinyProfile,
    jobType: "draft-scene",
    openingRules: ["Preserve every required record."],
    closingTask: ["Draft the scene."],
  }), (error: unknown) => error instanceof ActiveContextCapsuleError && error.code === "required-context-overflow");

  const optionalHeavy = index();
  optionalHeavy.records.find((item) => item.id === "CAN-OPTIONAL")!.payload = { fact: "x".repeat(20_000) };
  const capsule = buildActiveContextCapsule({
    storyIndex: optionalHeavy,
    sceneContract: scene(),
    modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
    jobType: "draft-scene",
    optionalRecordIds: ["CAN-OPTIONAL"],
    openingRules: ["Preserve canon."],
    closingTask: ["Draft the scene."],
  });
  assert.equal(capsule.records.some((item) => item.id === "CAN-OPTIONAL"), false);
  assert.ok(capsule.manifest.omitted_record_ids.includes("CAN-OPTIONAL"));
  assert.equal(JSON.stringify(capsule).includes("x".repeat(100)), false);
});

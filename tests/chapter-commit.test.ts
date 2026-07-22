import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitValidatedChapter, applyAcceptedStateMutations } from "../src/application/chapter-commit.js";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { readStoryRecordIndex } from "../src/application/rebuild-story-index.js";
import { ChapterDeltaSummarySchema, type ChapterDeltaSummary } from "../src/domain/chapter-delta-summary.js";
import type { ChapterStitchArtifact } from "../src/domain/chapter-stitch-artifact.js";
import type { ChapterValidationArtifact } from "../src/domain/chapter-validation-artifact.js";
import type { StateLedger } from "../src/domain/state-ledger.js";
import { readChapterCommitArtifact } from "../src/infrastructure/chapter-commit-artifact-store.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { writeChapterValidationArtifact } from "../src/infrastructure/chapter-validation-artifact-store.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { readBook, initializeProject, readProject } from "../src/project/store.js";

const hashText = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const artifactHash = (value: unknown) => hashText(JSON.stringify(value));
const runId = "RUN-COMMIT-001";
const chapter = 1;
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const sceneId = "CH-001-SC-01-V1";
const chapterText = "Mara reached the terminal and secured the access log.";

function packet() {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "begin",
    scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["STATE-MARA-LOCATION"],
    character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
    ending_hook: "danger", milestone_gate: null, target_words: 1000,
  };
}

function initialLedger(): StateLedger {
  return {
    schema_version: "1.0.0",
    records: [{
      id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR",
      status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00",
      evidence_ids: ["C00-P001"],
    }],
  };
}

function stitch(): ChapterStitchArtifact {
  const outputHash = hashText(chapterText);
  return {
    schema_version: "1.0.0", run_id: runId, chapter, contract_hash: contractHash,
    story_index_hash: storyIndexHash, scene_ids: [sceneId],
    scenes: [{ scene_id: sceneId, draft_attempt: 1, draft_output_hash: "c".repeat(64), acceptance_artifact_hash: "d".repeat(64), word_count: chapterText.split(/\s+/).length }],
    chapter_text: chapterText, word_count: chapterText.split(/\s+/).length, output_hash: outputHash,
    accepted_mutations: [{
      record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL",
      evidence_quote: "Mara reached the terminal",
    }],
    next_node: "chapter-validate", created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validation(value: ChapterStitchArtifact, passed = true): ChapterValidationArtifact {
  return {
    schema_version: "1.0.0", run_id: runId, chapter, stitch_artifact_hash: artifactHash(value),
    stitch_output_hash: value.output_hash, contract_hash: contractHash, story_index_hash: storyIndexHash,
    scene_ids: [sceneId], findings: passed ? [] : [{ code: "meta-commentary", severity: "blocker", message: "Bad." }],
    blocker_count: passed ? 0 : 1, warning_count: 0, passed,
    next_action: passed ? "chapter-commit" : "blocked", created_at: "2026-07-22T00:00:01.000Z",
  };
}

function setup(passed = true) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-chapter-commit-"));
  const root = initializeProject(parent, { projectName: "Chapter Commit", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "location changes", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet()] }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml(initialLedger()), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, "books", "book-01", "contracts", "chapters", "CH-001.yaml"), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "e".repeat(64), pov: "CHAR-MARA", purpose: "begin",
    required_beats: ["Reach terminal"], active_thread_ids: [], required_record_ids: ["STATE-MARA-LOCATION"],
    start_state_ids: ["STATE-MARA-LOCATION"], required_end_state: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
    forbidden_changes: [], knowledge_boundary_ids: [], target_words: { minimum: 300, maximum: 1000 }, ending_hook: "danger",
    small_model_ready: true, missing_small_model_fields: [],
  }), "utf8");
  const stitched = stitch();
  writeChapterStitchArtifact(root, stitched);
  writeChapterValidationArtifact(root, validation(stitched, passed));
  let execution = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter });
  for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta", "scene-accept", "chapter-stitch", "chapter-validate", "chapter-commit"] as const) {
    execution = transitionChapterExecution(execution, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
  }
  execution.accepted_scene_ids = [sceneId];
  writeChapterExecutionState(root, execution);
  return { parent, root };
}

test("chapter commit writes manuscript, state ledger, and delta summary through one guarded draft event", () => {
  const { parent, root } = setup();
  try {
    const result = commitValidatedChapter({ root, runId, chapter, now: "2026-07-22T00:02:00.000Z" });
    assert.equal(result.artifact.status, "committed");
    assert.equal(result.state.current_node, "complete");
    assert.equal(result.state.status, "completed");
    assert.equal(result.state.project_hash, projectStateHash(root));
    assert.ok(existsSync(join(root, result.artifact.manuscript_path)));
    assert.equal(readFileSync(join(root, result.artifact.manuscript_path), "utf8"), chapterText);
    const ledger = parseYaml<StateLedger>(readFileSync(join(root, "series", "state-ledger.yaml"), "utf8"), undefined, "state-ledger");
    assert.equal(ledger.records[0]?.value, "LOC-TERMINAL");
    assert.equal(ledger.records[0]?.updated_in, "book-01/chapter-001");
    assert.equal(ledger.records[0]?.evidence_ids.filter((item) => item.includes(runId)).length, 1);

    assert.equal(result.artifact.delta_summary_path, "books/book-01/deltas/CH-001.yaml");
    assert.ok(result.artifact.delta_summary_path);
    assert.ok(result.artifact.delta_summary_hash);
    const deltaText = readFileSync(join(root, result.artifact.delta_summary_path), "utf8");
    const delta = parseYaml<ChapterDeltaSummary>(deltaText, ChapterDeltaSummarySchema, result.artifact.delta_summary_path);
    assert.equal(hashText(deltaText), result.artifact.delta_summary_hash);
    assert.equal(delta.character_state_changes.length, 1);
    assert.equal(delta.character_state_changes[0]?.record_id, "STATE-MARA-LOCATION");
    assert.equal(delta.character_state_changes[0]?.before, "LOC-CORRIDOR");
    assert.equal(delta.character_state_changes[0]?.after, "LOC-TERMINAL");
    assert.equal(delta.manuscript_evidence_anchors[0]?.paragraph, 1);
    assert.ok(result.artifact.changed_paths.includes(result.artifact.delta_summary_path));

    const indexedDelta = readStoryRecordIndex(root).records.find((record) => record.id === "DELTA-CH-001");
    assert.equal(indexedDelta?.kind, "chapter-delta");
    assert.equal(indexedDelta?.status, "accepted-manuscript-fact");
    assert.deepEqual(indexedDelta?.chapter_scope, [1]);
    assert.equal(readBook(root).current_chapter, 1);
    assert.equal(readProject(root).next_gate, "first-chapter-approval");
    assert.deepEqual(readChapterCommitArtifact(root, runId, chapter), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter delta changes invalidate both project ownership and the story index", () => {
  const { parent, root } = setup();
  try {
    const result = commitValidatedChapter({ root, runId, chapter, now: "2026-07-22T00:02:00.000Z" });
    const path = join(root, result.artifact.delta_summary_path!);
    const beforeHash = projectStateHash(root);
    writeFileSync(path, readFileSync(path, "utf8").replace("LOC-TERMINAL", "LOC-ROOF"), "utf8");
    assert.notEqual(projectStateHash(root), beforeHash);
    assert.throws(() => readStoryRecordIndex(root), /story record index is stale/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter commit rejects unpassed validation and unknown state records before canonical writes", () => {
  const invalid = setup(false);
  try {
    assert.throws(() => commitValidatedChapter({ root: invalid.root, runId, chapter }), /passed chapter validation|chapter-commit/i);
    assert.equal(existsSync(join(invalid.root, "books", "book-01", "manuscript", "chapters", "01-opening.md")), false);
    assert.equal(readChapterCommitArtifact(invalid.root, runId, chapter), null);
  } finally { rmSync(invalid.parent, { recursive: true, force: true }); }

  const unknown = setup();
  try {
    const stitched = stitch();
    stitched.accepted_mutations[0]!.record_id = "STATE-UNKNOWN";
    writeChapterStitchArtifact(unknown.root, stitched);
    writeChapterValidationArtifact(unknown.root, validation(stitched));
    assert.throws(() => commitValidatedChapter({ root: unknown.root, runId, chapter }), /unknown state record|STATE-UNKNOWN/i);
    assert.equal(existsSync(join(unknown.root, "books", "book-01", "manuscript", "chapters", "01-opening.md")), false);
  } finally { rmSync(unknown.parent, { recursive: true, force: true }); }
});

test("prepared commits recover idempotently after an interruption following the canonical event", () => {
  const { parent, root } = setup();
  try {
    assert.throws(() => commitValidatedChapter({
      root, runId, chapter,
      onEventApplied: () => { throw new Error("simulated post-event interruption"); },
    }), /simulated post-event interruption/);
    const prepared = readChapterCommitArtifact(root, runId, chapter)!;
    assert.equal(prepared.status, "prepared");
    assert.ok(existsSync(join(root, prepared.manuscript_path)));
    assert.ok(prepared.delta_summary_path);
    assert.ok(existsSync(join(root, prepared.delta_summary_path)));
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "chapter-commit");

    const recovered = commitValidatedChapter({ root, runId, chapter });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.artifact.status, "committed");
    assert.equal(recovered.state.current_node, "complete");
    const ledger = parseYaml<StateLedger>(readFileSync(join(root, "series", "state-ledger.yaml"), "utf8"), undefined, "state-ledger");
    assert.equal(ledger.records[0]?.evidence_ids.filter((item) => item.includes(runId)).length, 1);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("accepted state mutations apply set, array add, and array remove deterministically", () => {
  const ledger: StateLedger = {
    schema_version: "1.0.0",
    records: [{ id: "STATE-TAGS", subject_id: "CHAR-MARA", field: "tags", value: ["a", "b"], status: "current-state", source: "test", introduced_in: null, updated_in: null, evidence_ids: [] }],
  };
  const added = applyAcceptedStateMutations(ledger, [{ record_id: "STATE-TAGS", field: "tags", operation: "add", value: "c", evidence_quote: "adds c" }], { runId, bookId: "book-01", chapter: 1 });
  assert.deepEqual(added.records[0]?.value, ["a", "b", "c"]);
  const removed = applyAcceptedStateMutations(added, [{ record_id: "STATE-TAGS", field: "tags", operation: "remove", value: "b", evidence_quote: "removes b" }], { runId, bookId: "book-01", chapter: 1 });
  assert.deepEqual(removed.records[0]?.value, ["a", "c"]);
  const set = applyAcceptedStateMutations(removed, [{ record_id: "STATE-TAGS", field: "tags", operation: "set", value: ["z"], evidence_quote: "sets z" }], { runId, bookId: "book-01", chapter: 1 });
  assert.deepEqual(set.records[0]?.value, ["z"]);
});

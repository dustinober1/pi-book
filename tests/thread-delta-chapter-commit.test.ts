import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitValidatedChapter } from "../src/application/chapter-commit.js";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { ChapterDeltaSummary } from "../src/domain/chapter-delta-summary.js";
import type { ChapterStitchArtifact } from "../src/domain/chapter-stitch-artifact.js";
import type { ChapterValidationArtifact } from "../src/domain/chapter-validation-artifact.js";
import type { StoryThreadsV2State } from "../src/domain/story-thread-v2.js";
import { readChapterCommitArtifact } from "../src/infrastructure/chapter-commit-artifact-store.js";
import { writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { writeChapterValidationArtifact } from "../src/infrastructure/chapter-validation-artifact-store.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

const hashText = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const artifactHash = (value: unknown) => hashText(JSON.stringify(value));
const runId = "RUN-THREAD-COMMIT-001";
const chapter = 1;
const sceneId = "CH-001-SC-01-V1";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const chapterText = "Mara proved the access record had been deliberately altered.";

function initialThreads(): StoryThreadsV2State {
  return {
    schema_version: "2.0.0",
    threads: [{
      id: "THREAD-ACCESS",
      type: "mystery",
      setup: "The access record is wrong.",
      reader_knows: "The record is wrong.",
      characters_know: { "CHAR-MARA": "Mara suspects tampering." },
      status: "open",
      intended_payoff: "Identify the protected user.",
      last_advanced_in: null,
      priority: "high",
      opened_in: 1,
      last_touched_in: 1,
      next_required_touch: 3,
      payoff_window: { earliest_chapter: 4, latest_chapter: 8 },
      dependent_thread_ids: [],
      participating_entity_ids: ["CHAR-MARA"],
      reader_knowledge_state: "The record is wrong.",
      character_knowledge_refs: [],
    }],
  };
}

function stitch(): ChapterStitchArtifact {
  return {
    schema_version: "1.0.0",
    run_id: runId,
    chapter,
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    scene_ids: [sceneId],
    scenes: [{ scene_id: sceneId, draft_attempt: 1, draft_output_hash: "c".repeat(64), acceptance_artifact_hash: "d".repeat(64), word_count: chapterText.split(/\s+/).length }],
    chapter_text: chapterText,
    word_count: chapterText.split(/\s+/).length,
    output_hash: hashText(chapterText),
    accepted_mutations: [],
    accepted_thread_changes: [{
      thread_id: "THREAD-ACCESS",
      operation: "advanced",
      description: "Mara proves the access record was deliberately altered.",
      evidence_quote: "proved the access record had been deliberately altered",
    }],
    next_node: "chapter-validate",
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validation(value: ChapterStitchArtifact): ChapterValidationArtifact {
  return {
    schema_version: "1.0.0",
    run_id: runId,
    chapter,
    stitch_artifact_hash: artifactHash(value),
    stitch_output_hash: value.output_hash,
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    scene_ids: [sceneId],
    findings: [],
    blocker_count: 0,
    warning_count: 0,
    passed: true,
    next_action: "chapter-commit",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-thread-commit-"));
  const root = initializeProject(parent, { projectName: "Thread Commit", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "the access thread advances", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0", active_window: "ACT-1", packets: [{
      chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "advance the access investigation",
      scene_engine: "evidence changes the case", pressure_movement: "worse", character_movement: "chooses evidence",
      relationship_movement: "unchanged", story_thread_refs: ["THREAD-ACCESS"], continuity_refs: [], character_refs: ["CHAR-MARA"], required_research: [],
      profile_fields: { threat_delta: "+1", evidence_delta: "+1", reader_forecast_change: "tampering is proven", protagonist_choice: "acts" },
      ending_hook: "the protected user remains unknown", milestone_gate: null, target_words: 1000,
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml(initialThreads()), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, "books", "book-01", "contracts", "chapters", "CH-001.yaml"), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "e".repeat(64), pov: "CHAR-MARA", purpose: "advance access investigation",
    required_beats: ["Prove access tampering"], active_thread_ids: ["THREAD-ACCESS"], required_record_ids: ["CHAR-MARA", "THREAD-ACCESS"],
    start_state_ids: [], required_end_state: [], forbidden_changes: [], knowledge_boundary_ids: [],
    target_words: { minimum: 300, maximum: 1000 }, ending_hook: "the user remains unknown", small_model_ready: true, missing_small_model_fields: [],
  }), "utf8");

  const stitched = stitch();
  writeChapterStitchArtifact(root, stitched);
  writeChapterValidationArtifact(root, validation(stitched));
  let execution = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter });
  for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta", "scene-accept", "chapter-stitch", "chapter-validate", "chapter-commit"] as const) {
    execution = transitionChapterExecution(execution, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
  }
  execution.accepted_scene_ids = [sceneId];
  writeChapterExecutionState(root, execution);
  return { parent, root };
}

test("guarded chapter commit advances canonical thread state and writes evidence-backed thread summary", () => {
  const { parent, root } = setup();
  try {
    const result = commitValidatedChapter({ root, runId, chapter, now: "2026-07-22T00:02:00.000Z" });
    assert.equal(result.artifact.status, "committed");
    assert.equal(result.artifact.story_threads_path, "series/story-threads.yaml");
    assert.ok(result.artifact.story_threads_hash);
    assert.ok(result.artifact.changed_paths.includes("series/story-threads.yaml"));

    const threads = parseYaml<StoryThreadsV2State>(readFileSync(join(root, "series", "story-threads.yaml"), "utf8"), undefined, "story-threads");
    assert.equal(threads.threads[0]?.status, "advanced");
    assert.equal(threads.threads[0]?.last_touched_in, 1);
    assert.equal(threads.threads[0]?.last_advanced_in, "book-01/chapter-001");
    assert.equal(threads.threads[0]?.next_required_touch, null);

    const summary = parseYaml<ChapterDeltaSummary>(readFileSync(join(root, result.artifact.delta_summary_path!), "utf8"), undefined, "chapter-delta");
    assert.equal(summary.threads.advanced[0]?.id, "THREAD-ACCESS");
    assert.equal(summary.threads.advanced[0]?.description, "Mara proves the access record was deliberately altered.");
    assert.equal(summary.threads.advanced[0]?.evidence_anchor_ids.length, 1);
    assert.equal(summary.manuscript_evidence_anchors[0]?.quote, "proved the access record had been deliberately altered");
    assert.deepEqual(readChapterCommitArtifact(root, runId, chapter), result.artifact);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("thread commit recovery verifies the canonical thread ledger hash", () => {
  const { parent, root } = setup();
  try {
    assert.throws(() => commitValidatedChapter({
      root, runId, chapter,
      onEventApplied: () => { throw new Error("simulated post-event interruption"); },
    }), /simulated post-event interruption/);
    const prepared = readChapterCommitArtifact(root, runId, chapter)!;
    assert.equal(prepared.status, "prepared");
    assert.ok(prepared.story_threads_path);
    assert.ok(existsSync(join(root, prepared.story_threads_path)));

    const recovered = commitValidatedChapter({ root, runId, chapter });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.artifact.status, "committed");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

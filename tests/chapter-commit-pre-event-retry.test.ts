import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitValidatedChapter } from "../src/application/chapter-commit.js";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { ChapterStitchArtifact } from "../src/domain/chapter-stitch-artifact.js";
import type { ChapterValidationArtifact } from "../src/domain/chapter-validation-artifact.js";
import { readChapterCommitArtifact } from "../src/infrastructure/chapter-commit-artifact-store.js";
import { writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { writeChapterValidationArtifact } from "../src/infrastructure/chapter-validation-artifact-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

const hashText = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const artifactHash = (value: unknown) => hashText(JSON.stringify(value));
const runId = "RUN-PRE-EVENT-RETRY";
const chapter = 1;
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const sceneId = "CH-001-SC-01-V1";
const chapterText = "Mara reached the terminal.";

function queue(status: "ready" | "drafted") {
  return {
    schema_version: "1.0.0",
    active_window: "ACT-1",
    packets: [{
      chapter: 1, title: "Opening", status, pov: "CHAR-MARA", purpose: "begin",
      scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
      relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["STATE-MARA-LOCATION"],
      character_refs: ["CHAR-MARA"], required_research: [],
      profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
      ending_hook: "danger", milestone_gate: null, target_words: 1000,
    }],
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-pre-event-retry-"));
  const root = initializeProject(parent, { projectName: "Pre-event Retry", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "location changes", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue("drafted")), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0", records: [{ id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: [] }],
  }), "utf8");
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

  const stitch: ChapterStitchArtifact = {
    schema_version: "1.0.0", run_id: runId, chapter, contract_hash: contractHash,
    story_index_hash: storyIndexHash, scene_ids: [sceneId],
    scenes: [{ scene_id: sceneId, draft_attempt: 1, draft_output_hash: "c".repeat(64), acceptance_artifact_hash: "d".repeat(64), word_count: 4 }],
    chapter_text: chapterText, word_count: 4, output_hash: hashText(chapterText),
    accepted_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal" }],
    next_node: "chapter-validate", created_at: "2026-07-22T00:00:00.000Z",
  };
  const validation: ChapterValidationArtifact = {
    schema_version: "1.0.0", run_id: runId, chapter, stitch_artifact_hash: artifactHash(stitch),
    stitch_output_hash: stitch.output_hash, contract_hash: contractHash, story_index_hash: storyIndexHash,
    scene_ids: [sceneId], findings: [], blocker_count: 0, warning_count: 0, passed: true,
    next_action: "chapter-commit", created_at: "2026-07-22T00:00:01.000Z",
  };
  writeChapterStitchArtifact(root, stitch);
  writeChapterValidationArtifact(root, validation);
  let execution = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter });
  for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta", "scene-accept", "chapter-stitch", "chapter-validate", "chapter-commit"] as const) {
    execution = transitionChapterExecution(execution, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
  }
  execution.accepted_scene_ids = [sceneId];
  writeChapterExecutionState(root, execution);
  return { parent, root };
}

test("a prepared delta summary keeps its identity when a pre-event retry uses a later timestamp", () => {
  const { parent, root } = setup();
  try {
    assert.throws(() => commitValidatedChapter({ root, runId, chapter, now: "2026-07-22T00:02:00.000Z" }), /packet is drafted, not ready/i);
    const prepared = readChapterCommitArtifact(root, runId, chapter)!;
    assert.equal(prepared.status, "prepared");
    const hashBeforeRetry = prepared.delta_summary_hash;
    const projectHashBeforeQueueRepair = projectStateHash(root);

    writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue("ready")), "utf8");
    assert.equal(projectStateHash(root), projectHashBeforeQueueRepair);

    const result = commitValidatedChapter({ root, runId, chapter, now: "2026-07-22T00:03:00.000Z" });
    assert.equal(result.artifact.status, "committed");
    assert.equal(result.artifact.delta_summary_hash, hashBeforeRetry);
    assert.equal(result.artifact.prepared_at, "2026-07-22T00:02:00.000Z");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

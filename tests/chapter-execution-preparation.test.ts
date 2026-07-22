import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareChapterExecution } from "../src/application/chapter-execution-preparation.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import { readChapterExecutionManifest } from "../src/infrastructure/chapter-execution-manifest-store.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function chapterContract(ready = true) {
  return {
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Enter the archive and secure the terminal log.",
    required_beats: ["Enter the archive", "Cross the patrol corridor", "Reach the terminal", "Secure the access log"],
    active_thread_ids: [], required_record_ids: [], start_state_ids: [],
    required_end_state: [{ record_id: "STATE-MARA-LOG", field: "custody", operation: "set", value: "secured" }],
    forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
    target_words: { minimum: 1400, maximum: 1800 }, ending_hook: "The access light stays dark.",
    small_model_ready: ready, missing_small_model_fields: ready ? [] : ["knowledge_boundary_ids"],
  };
}

function setup(ready = true) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-execution-prepare-"));
  const root = initializeProject(parent, {
    projectName: "Execution Prepare", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4",
  });
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(chapterContract(ready)), "utf8");
  return { parent, root };
}

test("preparation compiles deterministic scene hashes and persists dual contract ownership", () => {
  const { parent, root } = setup();
  try {
    const result = prepareChapterExecution({ root, chapter: 1, runId: "RUN-PREP-001", now: "2026-07-22T00:00:00.000Z" });
    assert.equal(result.alreadyPrepared, false);
    assert.equal(result.manifest.scenes.length, 2);
    assert.deepEqual(result.manifest.scenes.map((scene) => scene.scene_id), ["CH-001-SC-01-V1", "CH-001-SC-02-V1"]);
    assert.notEqual(result.manifest.chapter_contract_hash, result.manifest.scenes[0]?.contract_hash);
    assert.notEqual(result.manifest.scenes[0]?.contract_hash, result.manifest.scenes[1]?.contract_hash);
    assert.equal(result.manifest.runtime_profile, "tiny-local");
    assert.equal(result.manifest.model_execution_profile, "small-12b-q4");
    assert.equal(result.state.current_node, "contract-compile");
    assert.equal(result.state.current_scene_id, "CH-001-SC-01-V1");
    assert.equal(result.state.contract_hash, result.manifest.scenes[0]?.contract_hash);
    assert.equal(result.state.chapter_contract_hash, result.manifest.chapter_contract_hash);
    assert.equal(result.state.canon_snapshot_hash, result.manifest.story_index_hash);
    assert.deepEqual(readChapterExecutionManifest(root, "RUN-PREP-001", 1), result.manifest);
    assert.deepEqual(readChapterExecutionState(root, "RUN-PREP-001"), result.state);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("preparation is idempotent for the same run and immutable inputs", () => {
  const { parent, root } = setup();
  try {
    const first = prepareChapterExecution({ root, chapter: 1, runId: "RUN-PREP-002", now: "2026-07-22T00:00:00.000Z" });
    const second = prepareChapterExecution({ root, chapter: 1, runId: "RUN-PREP-002", now: "2026-07-22T00:01:00.000Z" });
    assert.equal(second.alreadyPrepared, true);
    assert.deepEqual(second.manifest, first.manifest);
    assert.deepEqual(second.state, first.state);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("changed chapter contracts or project hashes reject reusing a prepared run", () => {
  const contractChange = setup();
  try {
    prepareChapterExecution({ root: contractChange.root, chapter: 1, runId: "RUN-PREP-003" });
    const changed = chapterContract();
    changed.required_beats[0] = "Enter through the damaged loading door";
    writeFileSync(join(contractChange.root, chapterContractPath("book-01", 1)), stringifyYaml(changed), "utf8");
    assert.throws(() => prepareChapterExecution({ root: contractChange.root, chapter: 1, runId: "RUN-PREP-003" }), /chapter contract.*changed|prepared run.*contract/i);
  } finally { rmSync(contractChange.parent, { recursive: true, force: true }); }

  const projectChange = setup();
  try {
    prepareChapterExecution({ root: projectChange.root, chapter: 1, runId: "RUN-PREP-004" });
    writeFileSync(join(projectChange.root, "series", "voice-profile.md"), "# Voice Profile\n\nChanged after preparation.\n", "utf8");
    assert.throws(() => prepareChapterExecution({ root: projectChange.root, chapter: 1, runId: "RUN-PREP-004" }), /project hash.*changed|prepared run.*project/i);
  } finally { rmSync(projectChange.parent, { recursive: true, force: true }); }
});

test("non-executable contracts and unsafe run IDs write no preparation records", () => {
  const notReady = setup(false);
  try {
    assert.throws(() => prepareChapterExecution({ root: notReady.root, chapter: 1, runId: "RUN-PREP-005" }), /not small-model ready|missing executable/i);
    assert.equal(readChapterExecutionManifest(notReady.root, "RUN-PREP-005", 1), null);
    assert.equal(readChapterExecutionState(notReady.root, "RUN-PREP-005"), null);
  } finally { rmSync(notReady.parent, { recursive: true, force: true }); }

  const unsafe = setup();
  try {
    assert.throws(() => prepareChapterExecution({ root: unsafe.root, chapter: 1, runId: "../escape" }), /invalid run id/i);
  } finally { rmSync(unsafe.parent, { recursive: true, force: true }); }
});

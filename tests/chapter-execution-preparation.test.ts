import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareChapterExecution, rebaseChapterExecution } from "../src/application/chapter-execution-preparation.js";
import { buildExecutionContextCapsule } from "../src/application/execution-context-capsule.js";
import { chapterContractPath, type ChapterContract } from "../src/domain/chapter-contract.js";
import { readChapterExecutionManifest } from "../src/infrastructure/chapter-execution-manifest-store.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { chapterCommitArtifactPath } from "../src/infrastructure/chapter-commit-artifact-store.js";
import { chapterStitchArtifactPath } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { chapterValidationArtifactPath } from "../src/infrastructure/chapter-validation-artifact-store.js";
import { readActiveContextCapsule, writeActiveContextCapsule } from "../src/infrastructure/context-capsule-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
import { latestSceneDraftAttempt } from "../src/application/scene-artifact-discovery.js";

function chapterContract(ready = true): ChapterContract {
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
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: ["Keep cause and effect legible."], prefer: [], avoid: [], monitor: [],
    baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [{
      id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [],
      status: "locked-canon", source: "series-bible", introduced_in: "book-01",
    }],
  }), "utf8");
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

test("explicit rebase recompiles current bindings and capsules while resetting stale progress", () => {
  const { parent, root } = setup();
  try {
    const first = prepareChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-001", now: "2026-07-22T00:00:00.000Z" });
    const oldCapsule = buildExecutionContextCapsule({
      root,
      manifest: first.manifest,
      sceneId: first.manifest.scenes[0]!.scene_id,
      jobType: "plan-scene",
    }).capsule;
    writeChapterExecutionState(root, {
      ...first.state,
      current_node: "state-delta",
      status: "blocked",
      completed_nodes: [`${first.state.current_scene_id}:contract-compile`, `${first.state.current_scene_id}:scene-plan`],
      attempts: { [`${first.state.current_scene_id}:scene-plan`]: 2, [`${first.state.current_scene_id}:draft-scene`]: 1 },
      accepted_scene_ids: [first.state.current_scene_id!],
      blocker: { code: "needs-editorial-decision", message: "Resolve the stale turn.", record_ids: ["CHAR-MARA"] },
      updated_at: "2026-07-22T00:03:00.000Z",
    });

    const changed = chapterContract();
    changed.version = 2;
    changed.required_beats[0] = "Enter through the damaged loading door";
    const staleSceneRoot = join(root, ".pi-book", "runs", "RUN-REBASE-001", "scenes", first.state.current_scene_id!);
    mkdirSync(staleSceneRoot, { recursive: true });
    writeFileSync(join(staleSceneRoot, "draft-attempt-9.json"), "stale artifact\n", "utf8");
    writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(changed), "utf8");

    assert.throws(
      () => prepareChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-001" }),
      /chapter contract.*changed|prepared run.*contract/i,
    );

    const rebased = rebaseChapterExecution({
      root,
      chapter: 1,
      runId: "RUN-REBASE-001",
      now: "2026-07-22T00:05:00.000Z",
    });
    assert.equal(rebased.manifest.run_id, first.manifest.run_id);
    assert.equal(rebased.manifest.chapter, first.manifest.chapter);
    assert.notEqual(rebased.manifest.project_hash, first.manifest.project_hash);
    assert.notEqual(rebased.manifest.story_index_hash, first.manifest.story_index_hash);
    assert.notEqual(rebased.manifest.chapter_contract_hash, first.manifest.chapter_contract_hash);
    assert.deepEqual(rebased.manifest.scenes.map((scene) => scene.scene_id), ["CH-001-SC-01-V2", "CH-001-SC-02-V2"]);
    assert.equal(rebased.state.project_hash, rebased.manifest.project_hash);
    assert.equal(rebased.state.canon_snapshot_hash, rebased.manifest.story_index_hash);
    assert.equal(rebased.state.chapter_contract_hash, rebased.manifest.chapter_contract_hash);
    assert.equal(rebased.state.contract_hash, rebased.manifest.scenes[0]!.contract_hash);
    assert.equal(rebased.state.current_scene_id, rebased.manifest.scenes[0]!.scene_id);
    assert.equal(rebased.state.current_node, "contract-compile");
    assert.equal(rebased.state.status, "active");
    assert.deepEqual(rebased.state.completed_nodes, []);
    assert.deepEqual(rebased.state.attempts, {});
    assert.deepEqual(rebased.state.accepted_scene_ids, []);
    assert.equal(rebased.state.blocker, undefined);
    assert.equal(rebased.capsules.length, rebased.manifest.scenes.length);
    assert.equal(rebased.capsulePaths.length, rebased.capsules.length);
    assert.ok(rebased.capsules.every((capsule) => capsule.job_type === "plan-scene"));
    assert.ok(rebased.capsules.every((capsule) => capsule.story_index_hash === rebased.manifest.story_index_hash));
    assert.notEqual(rebased.capsules[0]!.capsule_id, oldCapsule.capsule_id);
    assert.notEqual(rebased.capsules[0]!.contract_hash, oldCapsule.contract_hash);
    assert.deepEqual(
      rebased.capsules.map((capsule) => capsule.contract_hash),
      rebased.manifest.scenes.map((scene) => scene.contract_hash),
    );
    assert.equal(existsSync(join(root, ".pi-book", "runs", "RUN-REBASE-001", "scenes")), false);
    for (const capsule of rebased.capsules) {
      assert.deepEqual(readActiveContextCapsule(root, "RUN-REBASE-001", capsule.capsule_id), capsule);
    }

    const preparedAgain = prepareChapterExecution({
      root,
      chapter: 1,
      runId: "RUN-REBASE-001",
      now: "2026-07-22T00:06:00.000Z",
    });
    assert.equal(preparedAgain.alreadyPrepared, true);
    assert.deepEqual(preparedAgain.manifest, rebased.manifest);
    assert.deepEqual(preparedAgain.state, rebased.state);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("rebase rejects a non-executable current contract without replacing the prior checkpoint", () => {
  const { parent, root } = setup();
  try {
    const first = prepareChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-002" });
    const manifestBytes = readFileSync(first.manifestPath, "utf8");
    const stateBytes = readFileSync(first.statePath, "utf8");
    const invalid = chapterContract(false);
    invalid.version = 2;
    writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(invalid), "utf8");

    assert.throws(
      () => rebaseChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-002" }),
      /not small-model ready|missing executable/i,
    );
    assert.equal(readFileSync(first.manifestPath, "utf8"), manifestBytes);
    assert.equal(readFileSync(first.statePath, "utf8"), stateBytes);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("rebase publishes no manifest or state when a current capsule cannot be built", () => {
  const { parent, root } = setup();
  try {
    const first = prepareChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-003" });
    const manifestBytes = readFileSync(first.manifestPath, "utf8");
    const stateBytes = readFileSync(first.statePath, "utf8");
    const missingContext = chapterContract();
    missingContext.version = 2;
    missingContext.required_record_ids = ["FACT-MISSING"];
    const staleArtifact = join(root, ".pi-book", "runs", "RUN-REBASE-003", "scenes", "CH-001-SC-01-V1", "draft-attempt-1.json");
    mkdirSync(join(root, ".pi-book", "runs", "RUN-REBASE-003", "scenes", "CH-001-SC-01-V1"), { recursive: true });
    writeFileSync(staleArtifact, "prior artifact\n", "utf8");
    writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(missingContext), "utf8");

    assert.throws(
      () => rebaseChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-003" }),
      /missing required records.*FACT-MISSING/i,
    );
    assert.equal(readFileSync(first.manifestPath, "utf8"), manifestBytes);
    assert.equal(readFileSync(first.statePath, "utf8"), stateBytes);
    assert.equal(readFileSync(staleArtifact, "utf8"), "prior artifact\n");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("rebase refuses to retarget a prepared run to a different active book", () => {
  const { parent, root } = setup();
  try {
    const first = prepareChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-004" });
    const manifestBytes = readFileSync(first.manifestPath, "utf8");
    const stateBytes = readFileSync(first.statePath, "utf8");
    const project = readProject(root);
    const book = readBook(root);
    cpSync(join(root, "books", "book-01"), join(root, "books", "book-02"), { recursive: true });
    writeFileSync(join(root, "books", "book-02", "BOOK.yaml"), stringifyYaml({ ...book, book_id: "book-02" }), "utf8");
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml({ ...project, active_book: "book-02" }), "utf8");

    assert.throws(
      () => rebaseChapterExecution({ root, chapter: 1, runId: "RUN-REBASE-004" }),
      /cannot change.*book|prepared book.*changed|identity/i,
    );
    assert.equal(readFileSync(first.manifestPath, "utf8"), manifestBytes);
    assert.equal(readFileSync(first.statePath, "utf8"), stateBytes);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("project-only rebase replaces capsules and retires every reusable execution artifact", () => {
  const { parent, root } = setup();
  try {
    const runId = "RUN-REBASE-005";
    const first = prepareChapterExecution({ root, chapter: 1, runId, now: "2026-07-22T00:00:00.000Z" });
    const oldCapsule = buildExecutionContextCapsule({
      root,
      manifest: first.manifest,
      sceneId: first.manifest.scenes[0]!.scene_id,
      jobType: "plan-scene",
    }).capsule;
    writeActiveContextCapsule(root, runId, oldCapsule);
    const sceneId = first.manifest.scenes[0]!.scene_id;
    const staleDraft = join(root, ".pi-book", "runs", runId, "scenes", sceneId, "draft-attempt-9.json");
    mkdirSync(join(root, ".pi-book", "runs", runId, "scenes", sceneId), { recursive: true });
    writeFileSync(staleDraft, "stale higher attempt\n", "utf8");
    const lateArtifacts = [
      chapterStitchArtifactPath(root, runId, 1),
      chapterValidationArtifactPath(root, runId, 1),
      chapterCommitArtifactPath(root, runId, 1),
    ];
    for (const path of lateArtifacts) writeFileSync(path, `stale ${path.split("/").at(-1)}\n`, "utf8");
    const budgetLedger = join(root, ".pi-book", "runs", "budget-ledger.json");
    const runReport = join(root, ".pi-book", "runs", runId, "run-report.json");
    writeFileSync(budgetLedger, "preserve budget ledger\n", "utf8");
    writeFileSync(runReport, "preserve run report\n", "utf8");

    const project = readProject(root);
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml({
      ...project,
      automation: { ...project.automation, max_chapters_per_run: project.automation.max_chapters_per_run + 1 },
    }), "utf8");

    const rebased = rebaseChapterExecution({ root, chapter: 1, runId, now: "2026-07-22T00:05:00.000Z" });
    assert.notEqual(rebased.manifest.project_hash, first.manifest.project_hash);
    assert.equal(rebased.manifest.story_index_hash, first.manifest.story_index_hash);
    assert.equal(rebased.manifest.chapter_contract_hash, first.manifest.chapter_contract_hash);
    assert.notEqual(rebased.capsules[0]!.capsule_id, oldCapsule.capsule_id);
    assert.equal(rebased.capsules[0]!.project_hash, rebased.manifest.project_hash);
    assert.deepEqual(
      readdirSync(join(root, ".pi-book", "runs", runId, "capsules")).sort(),
      rebased.capsules.map((capsule) => `${capsule.capsule_id}.json`).sort(),
    );
    assert.equal(latestSceneDraftAttempt(root, runId, sceneId), null);
    assert.ok(lateArtifacts.every((path) => !existsSync(path)));
    assert.equal(readFileSync(budgetLedger, "utf8"), "preserve budget ledger\n");
    assert.equal(readFileSync(runReport, "utf8"), "preserve run report\n");
    assert.equal(existsSync(first.manifestPath), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("rebase rejects a stored manifest and state whose internal run identity does not match their path", () => {
  const { parent, root } = setup();
  try {
    const runId = "RUN-REBASE-006";
    const first = prepareChapterExecution({ root, chapter: 1, runId });
    const manifest = JSON.parse(readFileSync(first.manifestPath, "utf8")) as Record<string, unknown>;
    const state = JSON.parse(readFileSync(first.statePath, "utf8")) as Record<string, unknown>;
    manifest.run_id = "RUN-MISPLACED";
    state.run_id = "RUN-MISPLACED";
    writeFileSync(first.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    writeFileSync(first.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    const manifestBytes = readFileSync(first.manifestPath, "utf8");
    const stateBytes = readFileSync(first.statePath, "utf8");

    assert.throws(
      () => rebaseChapterExecution({ root, chapter: 1, runId }),
      /run identity|run id|does not match.*path/i,
    );
    assert.equal(readFileSync(first.manifestPath, "utf8"), manifestBytes);
    assert.equal(readFileSync(first.statePath, "utf8"), stateBytes);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

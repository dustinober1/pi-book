import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceChapterExecutionStep } from "../src/application/chapter-execution-stepper.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

const runId = "RUN-STEP-001";
const sceneId = "CH-001-SC-01-V1";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-stepper-"));
  const root = initializeProject(parent, {
    projectName: "Execution Stepper", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4",
  });
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: ["Keep cause and effect legible."], prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."], monitor: [], baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [
      { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
      { id: "LOC-ARCHIVE", category: "location", display_name: "Archive", aliases: [], status: "locked-canon", source: "book-bible", introduced_in: "book-01" },
    ],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0", records: [{
      id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-ARCHIVE",
      status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: ["C00-P001"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0", facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The terminal credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }], relationships: [],
  }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Reach the terminal.", required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: [], required_record_ids: ["CAN-ACCESS"], start_state_ids: ["STATE-MARA-LOCATION"],
    required_end_state: [], forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
    target_words: { minimum: 140, maximum: 180 }, ending_hook: "Mara reaches the terminal unseen.",
    small_model_ready: true, missing_small_model_fields: [],
  }), "utf8");
  return { parent, root };
}

const planOutput = {
  schema_version: "1.0.0",
  steps: [
    { required_beat: "Enter the archive", execution: "Mara enters through the maintenance threshold.", pressure: "A patrol cycle narrows the window." },
    { required_beat: "Discover revoked access", execution: "The terminal rejects her credential.", pressure: "The failure may log her presence." },
  ],
  turn_execution: "She notices a conduit beneath the reader.",
  ending_execution: "She reaches the terminal unseen.",
  evidence_record_ids: ["CAN-ACCESS"],
};
const draftProse = Array.from({ length: 160 }, (_, index) => index % 16 === 15 ? `checkpoint${index + 1}.` : `word${index + 1}`).join(" ");

function workerResult(text: string, request: QualityWorkerRequest): QualityWorkerResult {
  return {
    text,
    usage: {
      callId: request.callId,
      stage: request.stage,
      ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
      ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
      ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
      pass: request.pass,
      ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
      estimated: true, elapsedMs: 5, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
    },
  };
}

class ScriptedWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  failNextPlan = false;
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") {
      if (this.failNextPlan) { this.failNextPlan = false; throw new Error("plan model unavailable"); }
      return workerResult(JSON.stringify(planOutput), request);
    }
    if (request.jobType === "draft-scene") return workerResult(draftProse, request);
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

const stepInput = (root: string, worker: QualityWorker) => ({ root, chapter: 1, runId, worker });

test("repeated calls advance exactly one persisted stage through deterministic validation", async () => {
  const { parent, root } = setup();
  try {
    const worker = new ScriptedWorker();
    const actions: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const result = await advanceChapterExecutionStep(stepInput(root, worker));
      actions.push(result.action);
    }
    assert.deepEqual(actions, [
      "prepared", "chapter-contract-compiled", "scene-contracts-compiled", "context-built",
      "scene-planned", "scene-drafted", "scene-validated",
    ]);
    assert.deepEqual(worker.requests.map((request) => request.jobType), ["plan-scene", "draft-scene"]);
    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.current_node, "critic-review");
    assert.equal(state.current_scene_id, sceneId);
    const stopped = await advanceChapterExecutionStep(stepInput(root, worker));
    assert.equal(stopped.action, "awaiting-critic-review");
    assert.equal(worker.requests.length, 2);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a failed plan job remains resumable and increments only its attempt", async () => {
  const { parent, root } = setup();
  try {
    const worker = new ScriptedWorker();
    for (let index = 0; index < 4; index += 1) await advanceChapterExecutionStep(stepInput(root, worker));
    worker.failNextPlan = true;
    await assert.rejects(() => advanceChapterExecutionStep(stepInput(root, worker)), /plan model unavailable/i);
    const failed = readChapterExecutionState(root, runId)!;
    assert.equal(failed.current_node, "scene-plan");
    assert.equal(failed.attempts[`${sceneId}:scene-plan`], 1);
    const resumed = await advanceChapterExecutionStep(stepInput(root, worker));
    assert.equal(resumed.action, "scene-planned");
    assert.equal(resumed.state.current_node, "scene-draft");
    assert.equal(resumed.state.attempts[`${sceneId}:scene-plan`], 2);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("project drift rejects the next step before replaying completed work", async () => {
  const { parent, root } = setup();
  try {
    const worker = new ScriptedWorker();
    const prepared = await advanceChapterExecutionStep(stepInput(root, worker));
    assert.equal(prepared.action, "prepared");
    writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\nChanged after preparation.\n", "utf8");
    await assert.rejects(() => advanceChapterExecutionStep(stepInput(root, worker)), /prepared run project hash changed|project hash.*changed/i);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "contract-compile");
    assert.equal(worker.requests.length, 0);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

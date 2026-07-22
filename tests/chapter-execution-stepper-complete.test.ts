import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceChapterExecutionStep } from "../src/application/chapter-execution-stepper.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

const runId = "RUN-FULL-STEP-001";
const sceneId = "CH-001-SC-01-V1";

function packet() {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "begin",
    scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["CAN-ACCESS"],
    character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
    ending_hook: "danger", milestone_gate: null, target_words: 1000,
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-full-stepper-"));
  const root = initializeProject(parent, {
    projectName: "Full Execution Stepper", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: ["Keep cause and effect legible."], prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."], monitor: [], baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0", facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The terminal credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }], relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "access is tested", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet()] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Reach the terminal.", required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: [], required_record_ids: ["CAN-ACCESS"], start_state_ids: [], required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
    target_words: { minimum: 300, maximum: 360 }, ending_hook: "Mara reaches the terminal unseen.",
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
  turn_execution: "She notices a conduit beneath the reader.", ending_execution: "She reaches the terminal unseen.",
  evidence_record_ids: ["CAN-ACCESS"],
};
const baseDraft = Array.from({ length: 320 }, (_, index) => index % 16 === 15 ? `checkpoint${index + 1}.` : `word${index + 1}`).join(" ");

function usage(request: QualityWorkerRequest): QualityWorkerResult["usage"] {
  return {
    callId: request.callId, stage: request.stage,
    ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
    ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
    ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
    pass: request.pass, ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
    estimated: true, elapsedMs: 5, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
  };
}

class FullWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  constructor(private readonly metaDraft = false) {}
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") return { text: JSON.stringify(planOutput), usage: usage(request) };
    if (request.jobType === "draft-scene") return { text: this.metaDraft ? `Here is the scene. ${baseDraft}` : baseDraft, usage: usage(request) };
    if (request.jobType === "critic-continuity" || request.jobType === "critic-style") {
      return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    }
    if (request.jobType === "extract-state-delta") {
      return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    }
    if (request.jobType === "patch-spans") {
      return { text: JSON.stringify({
        schema_version: "1.0.0",
        operations: [{ operation: "delete", anchor_quote: "Here is the scene. ", replacement: "", finding_refs: ["deterministic:meta-commentary"] }],
      }), usage: usage(request) };
    }
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

const input = (root: string, worker: QualityWorker) => ({
  root, chapter: 1, runId, worker,
  requiredCriticJobTypes: ["critic-continuity", "critic-style"] as const,
});

test("one-step calls complete a clean scene and canonically commit the chapter", async () => {
  const { parent, root } = setup();
  try {
    const worker = new FullWorker();
    const actions: string[] = [];
    for (let index = 0; index < 24; index += 1) {
      const result = await advanceChapterExecutionStep(input(root, worker));
      actions.push(result.action);
      if (result.state.status === "completed") break;
    }
    assert.deepEqual(actions, [
      "prepared", "chapter-contract-compiled", "scene-contracts-compiled", "context-built",
      "scene-planned", "scene-drafted", "scene-validated",
      "critic-completed", "critic-completed", "critic-review-finalized",
      "state-delta-extracted", "scene-accepted", "chapter-stitched", "chapter-validated", "chapter-committed",
    ]);
    assert.deepEqual(worker.requests.map((request) => request.jobType), [
      "plan-scene", "draft-scene", "critic-continuity", "critic-style", "extract-state-delta",
    ]);
    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.status, "completed");
    assert.equal(state.current_node, "complete");
    assert.ok(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md")));
    assert.equal(readProject(root).next_gate, "first-chapter-approval");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("deterministic blockers route through one bounded patch and revalidate the repaired candidate", async () => {
  const { parent, root } = setup();
  try {
    const worker = new FullWorker(true);
    const actions: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const result = await advanceChapterExecutionStep(input(root, worker));
      actions.push(result.action);
      if (result.state.current_node === "critic-review") break;
    }
    assert.deepEqual(actions, [
      "prepared", "chapter-contract-compiled", "scene-contracts-compiled", "context-built",
      "scene-planned", "scene-drafted", "scene-validated", "scene-repaired", "scene-validated",
    ]);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "critic-review");
    assert.ok(readSceneDraftArtifact(root, runId, sceneId, 2));
    assert.deepEqual(worker.requests.map((request) => request.jobType), ["plan-scene", "draft-scene", "patch-spans"]);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

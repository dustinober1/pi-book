import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStateHash } from "../src/application/project-hash.js";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { runSceneDraftJob } from "../src/application/scene-draft-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { ScenePlanArtifact } from "../src/domain/scene-plan-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { writeScenePlanArtifact } from "../src/infrastructure/scene-plan-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const sceneId = "CH-001-SC-01-V1";

function capsule(root: string): ActiveContextCapsule {
  return {
    schema_version: "1.0.0", capsule_id: "CAP-0123456789ABCDEF", job_type: "draft-scene",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0", scene_id: sceneId, chapter_contract_id: "CH-001", chapter_contract_version: 1,
      sequence: 1, pov: "CHAR-MARA", objective: "Reach the terminal.", conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.", required_beats: ["Enter", "Discover revoked access"],
      active_thread_ids: [], required_record_ids: [], start_state_ids: [], expected_state_delta: [],
      forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
      target_words: { minimum: 150, maximum: 260 }, ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash, story_index_hash: storyIndexHash, project_hash: projectStateHash(root), opening_rules: ["Preserve canon."], records: [],
    previous_tail: null, style_card: null,
    closing_task: ["Draft only CH-001-SC-01-V1.", "Return scene prose only."],
    manifest: { included_record_ids: [], omitted_record_ids: [], missing_required_record_ids: [], unsafe_required_record_ids: [], dependency_edges: [], estimated_evidence_tokens: 120, maximum_evidence_tokens: 6000 },
  };
}

function plan(runId: string): ScenePlanArtifact {
  return {
    schema_version: "1.0.0", run_id: runId, chapter: 1, scene_id: sceneId,
    capsule_id: "CAP-5555555555555555", contract_hash: contractHash, story_index_hash: storyIndexHash, plan_attempt: 1,
    steps: [
      { required_beat: "Enter", execution: "Mara enters through the maintenance threshold.", pressure: "A patrol cycle narrows the window." },
      { required_beat: "Discover revoked access", execution: "The terminal reader rejects her credential.", pressure: "The failure may log her presence." },
    ],
    turn_execution: "She spots a conduit beneath the reader.", ending_execution: "She reaches the terminal unseen.",
    evidence_record_ids: [],
    usage: {
      callId: "plan", stage: "drafting", chapter: 1, sceneId, attempt: 1, pass: "plan", jobType: "plan-scene",
      contractHash, capsuleHash: "1".repeat(64), includedRecordCount: 0, estimated: true, elapsedMs: 1,
      promptHash: "2".repeat(64), contextHash: "3".repeat(64), outputHash: "4".repeat(64),
    },
    created_at: "2026-07-22T00:00:03.000Z",
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-draft-"));
  const root = initializeProject(parent, { projectName: "Single Scene Draft", projectType: "standalone", profile: "thriller", runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4" });
  const runId = "RUN-SCENE-001";
  let state = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1, now: "2026-07-22T00:00:00.000Z" });
  state = transitionChapterExecution(state, "scene-contract-compile", "2026-07-22T00:00:01.000Z");
  state = transitionChapterExecution(state, "context-build", "2026-07-22T00:00:02.000Z", sceneId);
  state = transitionChapterExecution(state, "scene-plan", "2026-07-22T00:00:03.000Z", sceneId);
  state = transitionChapterExecution(state, "scene-draft", "2026-07-22T00:00:04.000Z", sceneId);
  writeChapterExecutionState(root, state);
  writeScenePlanArtifact(root, plan(runId));
  return { parent, root, runId };
}

function workerResult(text: string): QualityWorkerResult {
  return { text, usage: { callId: "worker-call", stage: "drafting", pass: "candidate", estimated: true, elapsedMs: 25, promptHash: "c".repeat(64), contextHash: "d".repeat(64), outputHash: "e".repeat(64) } };
}
class StubWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  constructor(private readonly result: QualityWorkerResult | Error) {}
  async run(request: QualityWorkerRequest) { this.requests.push(request); if (this.result instanceof Error) throw this.result; return this.result; }
  async resolveModelCapacity() { return null; }
}

const sceneProse = "Mara held the revoked credential against the reader anyway. The panel stayed dark. She followed the maintenance conduit behind the terminal bank, counting each junction until the access light appeared beneath the floor grate. The route was narrow enough to force her onto one shoulder, but it kept her below the camera line. At the final turn, she heard the security door cycle behind her. She reached the terminal before the patrol entered the archive.";

const draftInput = (root: string, runId: string, worker: QualityWorker) => ({ root, runId, capsule: capsule(root), planAttempt: 1, runtimeProfile: "tiny-local" as const, worker });

test("one draft-scene job consumes one plan, stores one artifact, and advances only to deterministic validation", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(sceneProse));
    const result = await runSceneDraftJob({ ...draftInput(root, runId, worker), now: "2026-07-22T00:01:00.000Z" });
    assert.equal(worker.requests.length, 1);
    const request = worker.requests[0]!;
    assert.equal(request.jobType, "draft-scene");
    assert.equal(request.pass, "candidate");
    assert.equal(request.chapter, 1);
    assert.equal(request.sceneId, sceneId);
    assert.equal(request.attempt, 1);
    assert.equal(request.decoding?.thinking, "off");
    assert.ok(request.context?.startsWith("NON-NEGOTIABLE RULES"));
    assert.ok((request.context?.indexOf("SCENE PLAN") ?? -1) < (request.context?.indexOf("EXACT TASK") ?? -1));
    assert.match(request.context ?? "", /The terminal reader rejects her credential/);
    assert.ok(request.context?.endsWith("EXACT TASK\n- Draft only CH-001-SC-01-V1.\n- Return scene prose only."));
    assert.equal(result.artifact.scene_id, sceneId);
    assert.equal(result.artifact.attempt, 1);
    assert.equal(result.artifact.prose, sceneProse);
    assert.equal(result.state.current_node, "deterministic-validation");
    assert.deepEqual(readSceneDraftArtifact(root, runId, sceneId, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("worker failure records the attempt and leaves the scene resumable at scene-draft", async () => {
  const { parent, root, runId } = setup();
  try {
    await assert.rejects(() => runSceneDraftJob({ ...draftInput(root, runId, new StubWorker(new Error("model unavailable"))), now: "2026-07-22T00:02:00.000Z" }), /model unavailable/i);
    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.current_node, "scene-draft");
    assert.equal(state.attempts[`${sceneId}:scene-draft`], 1);
    assert.equal(readSceneDraftArtifact(root, runId, sceneId, 1), null);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("stale checkpoints, missing plans, and blank output block before scene advancement", async () => {
  const staleSetup = setup();
  try {
    const stale = readChapterExecutionState(staleSetup.root, staleSetup.runId)!;
    writeChapterExecutionState(staleSetup.root, { ...stale, project_hash: "f".repeat(64) });
    const worker = new StubWorker(workerResult(sceneProse));
    await assert.rejects(() => runSceneDraftJob(draftInput(staleSetup.root, staleSetup.runId, worker)), /project hash changed|stale/i);
    assert.equal(worker.requests.length, 0);
  } finally { rmSync(staleSetup.parent, { recursive: true, force: true }); }

  const missing = setup();
  try {
    await assert.rejects(() => runSceneDraftJob({ ...draftInput(missing.root, missing.runId, new StubWorker(workerResult(sceneProse))), planAttempt: 2 }), /plan artifact not found/i);
    assert.equal(readChapterExecutionState(missing.root, missing.runId)?.current_node, "scene-draft");
  } finally { rmSync(missing.parent, { recursive: true, force: true }); }

  const blank = setup();
  try {
    await assert.rejects(() => runSceneDraftJob(draftInput(blank.root, blank.runId, new StubWorker(workerResult("   \n")))), /blank|empty/i);
    const state = readChapterExecutionState(blank.root, blank.runId)!;
    assert.equal(state.current_node, "scene-draft");
    assert.equal(state.attempts[`${sceneId}:scene-draft`], 1);
  } finally { rmSync(blank.parent, { recursive: true, force: true }); }
});

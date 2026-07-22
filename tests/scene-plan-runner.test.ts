import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { runScenePlanJob } from "../src/application/scene-plan-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readScenePlanArtifact } from "../src/infrastructure/scene-plan-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const sceneId = "CH-001-SC-01-V1";

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0", capsule_id: "CAP-5555555555555555", job_type: "plan-scene",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0", scene_id: sceneId, chapter_contract_id: "CH-001", chapter_contract_version: 1,
      sequence: 1, pov: "CHAR-MARA", objective: "Reach the terminal.", conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.", required_beats: ["Enter the archive", "Discover revoked access"],
      active_thread_ids: [], required_record_ids: ["CAN-ACCESS"], start_state_ids: [], expected_state_delta: [],
      forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
      target_words: { minimum: 700, maximum: 900 }, ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash, story_index_hash: storyIndexHash, opening_rules: ["Use only supplied records."],
    records: [{ id: "CAN-ACCESS", kind: "canon-fact", status: "locked-canon", authority: "established", required: true, reason: "explicit scene contract reference", source_path: "series/canon.yaml", source_hash: "c".repeat(64), version: 1, payload: { fact: "The credential is revoked." }, dependencies: [], estimated_tokens: 20 }],
    previous_tail: null, style_card: null,
    closing_task: ["Plan only CH-001-SC-01-V1.", "Return one exact JSON object."],
    manifest: { included_record_ids: ["CAN-ACCESS"], omitted_record_ids: [], missing_required_record_ids: [], unsafe_required_record_ids: [], dependency_edges: [], estimated_evidence_tokens: 150, maximum_evidence_tokens: 5000 },
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-plan-"));
  const root = initializeProject(parent, { projectName: "Scene Plan", projectType: "standalone", profile: "thriller", runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4" });
  const runId = "RUN-PLAN-001";
  let state = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
  state = transitionChapterExecution(state, "scene-contract-compile");
  state = transitionChapterExecution(state, "context-build", undefined, sceneId);
  state = transitionChapterExecution(state, "scene-plan", undefined, sceneId);
  writeChapterExecutionState(root, state);
  return { parent, root, runId };
}

function workerResult(text: string): QualityWorkerResult {
  return { text, usage: { callId: "worker", stage: "drafting", pass: "plan", estimated: true, elapsedMs: 5, promptHash: "d".repeat(64), contextHash: "e".repeat(64), outputHash: "f".repeat(64) } };
}
class StubWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  constructor(private readonly result: QualityWorkerResult | Error) {}
  async run(request: QualityWorkerRequest) { this.requests.push(request); if (this.result instanceof Error) throw this.result; return this.result; }
  async resolveModelCapacity() { return null; }
}

const validPlan = {
  schema_version: "1.0.0",
  steps: [
    { required_beat: "Enter the archive", execution: "Mara enters through the maintenance threshold.", pressure: "A patrol cycle narrows the available time." },
    { required_beat: "Discover revoked access", execution: "The reader rejects her credential at the terminal bank.", pressure: "The rejection risks logging her presence." },
  ],
  turn_execution: "She notices a maintenance conduit below the reader.",
  ending_execution: "She reaches the terminal without revealing the prior user.",
  evidence_record_ids: ["CAN-ACCESS"],
};

test("a structured plan preserves exact beat order and advances to scene drafting", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(JSON.stringify(validPlan)));
    const result = await runScenePlanJob({ root, runId, capsule: capsule(), runtimeProfile: "tiny-local", worker, now: "2026-07-22T00:00:00.000Z" });
    assert.equal(worker.requests[0]?.jobType, "plan-scene");
    assert.equal(worker.requests[0]?.pass, "plan");
    assert.equal(worker.requests[0]?.sceneId, sceneId);
    assert.equal(result.artifact.plan_attempt, 1);
    assert.deepEqual(result.artifact.steps.map((item) => item.required_beat), capsule().scene_contract.required_beats);
    assert.equal(result.state.current_node, "scene-draft");
    assert.deepEqual(readScenePlanArtifact(root, runId, sceneId, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("unknown evidence and reordered beats remain resumable at scene-plan", async () => {
  const reordered = setup();
  try {
    const output = { ...validPlan, steps: [...validPlan.steps].reverse() };
    await assert.rejects(() => runScenePlanJob({ root: reordered.root, runId: reordered.runId, capsule: capsule(), runtimeProfile: "tiny-local", worker: new StubWorker(workerResult(JSON.stringify(output))) }), /required beat.*order|beat sequence/i);
    const state = readChapterExecutionState(reordered.root, reordered.runId)!;
    assert.equal(state.current_node, "scene-plan");
    assert.equal(state.attempts[`${sceneId}:scene-plan`], 1);
    assert.equal(readScenePlanArtifact(reordered.root, reordered.runId, sceneId, 1), null);
  } finally { rmSync(reordered.parent, { recursive: true, force: true }); }

  const unknown = setup();
  try {
    const output = { ...validPlan, evidence_record_ids: ["CAN-UNKNOWN"] };
    await assert.rejects(() => runScenePlanJob({ root: unknown.root, runId: unknown.runId, capsule: capsule(), runtimeProfile: "tiny-local", worker: new StubWorker(workerResult(JSON.stringify(output))) }), /unknown evidence record|CAN-UNKNOWN/i);
    assert.equal(readChapterExecutionState(unknown.root, unknown.runId)?.current_node, "scene-plan");
  } finally { rmSync(unknown.parent, { recursive: true, force: true }); }
});

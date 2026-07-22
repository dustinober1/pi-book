import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { runSceneStateDeltaExtraction } from "../src/application/scene-state-delta-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { SceneCriticSummaryArtifact } from "../src/domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeSceneCriticSummaryArtifact } from "../src/infrastructure/scene-critic-summary-store.js";
import { writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { readSceneStateDeltaArtifact } from "../src/infrastructure/scene-state-delta-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const prose = "Mara crossed the maintenance corridor. Mara reached the terminal. The access light remained dark behind her.";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: "CAP-4444444444444444",
    job_type: "extract-state-delta",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0",
      scene_id: sceneId,
      chapter_contract_id: "CH-001",
      chapter_contract_version: 1,
      sequence: 1,
      pov: "CHAR-MARA",
      objective: "Reach the terminal.",
      conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.",
      required_beats: ["Enter", "Discover revoked access"],
      active_thread_ids: [],
      required_record_ids: ["STATE-MARA-LOCATION"],
      start_state_ids: ["STATE-MARA-LOCATION"],
      expected_state_delta: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbidden_changes: [],
      knowledge_boundary_ids: [],
      target_words: { minimum: 15, maximum: 80 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: ["Extract only evidence-grounded state changes."],
    records: [{
      id: "STATE-MARA-LOCATION",
      kind: "state",
      status: "current-state",
      authority: "established",
      required: true,
      reason: "scene start state",
      source_path: "series/state-ledger.yaml",
      source_hash: "c".repeat(64),
      version: 1,
      payload: { field: "location", value: "LOC-CORRIDOR" },
      dependencies: ["CHAR-MARA"],
      estimated_tokens: 20,
    }],
    previous_tail: null,
    style_card: null,
    closing_task: ["Extract the actual state delta for this scene.", "Return one exact JSON object."],
    manifest: {
      included_record_ids: ["STATE-MARA-LOCATION"], omitted_record_ids: [], missing_required_record_ids: [], unsafe_required_record_ids: [], dependency_edges: [], estimated_evidence_tokens: 150, maximum_evidence_tokens: 4000,
    },
  };
}

function draft(): SceneDraftArtifact {
  const outputHash = hash(prose);
  return {
    schema_version: "1.0.0", run_id: "RUN-DELTA-001", chapter: 1, scene_id: sceneId,
    chapter_contract_id: "CH-001", chapter_contract_version: 1, job_type: "draft-scene",
    capsule_id: "CAP-0123456789ABCDEF", contract_hash: contractHash, story_index_hash: storyIndexHash,
    model_execution_profile: "small-12b-q4", runtime_profile: "tiny-local", attempt: 1,
    prose, word_count: prose.split(/\s+/).length, output_hash: outputHash,
    usage: {
      callId: "draft", stage: "drafting", chapter: 1, sceneId, attempt: 1, pass: "candidate", jobType: "draft-scene",
      contractHash, capsuleHash: "d".repeat(64), includedRecordCount: 1, estimated: true, elapsedMs: 1,
      promptHash: "e".repeat(64), contextHash: "f".repeat(64), outputHash,
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validation(value: SceneDraftArtifact): SceneValidationArtifact {
  return {
    schema_version: "1.0.0", run_id: value.run_id, chapter: 1, scene_id: sceneId, draft_attempt: 1,
    draft_output_hash: value.output_hash, capsule_id: value.capsule_id, contract_hash: contractHash,
    findings: [], blocker_count: 0, warning_count: 0, passed: true, next_node: "critic-review",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

function criticSummary(value: SceneDraftArtifact): SceneCriticSummaryArtifact {
  return {
    schema_version: "1.0.0", run_id: value.run_id, chapter: 1, scene_id: sceneId, draft_attempt: 1,
    draft_output_hash: value.output_hash, contract_hash: contractHash, required_job_types: ["critic-continuity"],
    critics: [{ job_type: "critic-continuity", critic_attempt: 1, verdict: "pass", finding_count: 0 }],
    blocker_count: 0, repair_count: 0, passed: true, next_action: "state-delta",
    created_at: "2026-07-22T00:00:02.000Z",
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-delta-"));
  const root = initializeProject(parent, { projectName: "Scene Delta", projectType: "standalone", profile: "thriller", runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4" });
  const candidate = draft();
  let state = createChapterExecutionState({ runId: candidate.run_id, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
  for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta"] as const) {
    state = transitionChapterExecution(state, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
  }
  writeChapterExecutionState(root, state);
  writeSceneDraftArtifact(root, candidate);
  writeSceneValidationArtifact(root, validation(candidate));
  writeSceneCriticSummaryArtifact(root, criticSummary(candidate));
  return { parent, root, runId: candidate.run_id };
}

function workerResult(text: string): QualityWorkerResult {
  return { text, usage: { callId: "worker-call", stage: "drafting", pass: "verification", estimated: true, elapsedMs: 10, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64) } };
}
class StubWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  constructor(private readonly result: QualityWorkerResult | Error) {}
  async run(request: QualityWorkerRequest) { this.requests.push(request); if (this.result instanceof Error) throw this.result; return this.result; }
  async resolveModelCapacity() { return null; }
}

const matchingMutation = { record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal." } as const;

test("matching evidence-grounded delta routes to scene acceptance", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(JSON.stringify({ schema_version: "1.0.0", mutations: [matchingMutation] })));
    const result = await runSceneStateDeltaExtraction({ root, runId, capsule: capsule(), draftAttempt: 1, runtimeProfile: "tiny-local", worker });
    assert.equal(worker.requests[0]?.jobType, "extract-state-delta");
    assert.ok(worker.requests[0]?.context?.endsWith("EXACT TASK\n- Extract the actual state delta for this scene.\n- Return one exact JSON object."));
    assert.equal(result.artifact.matches_expected, true);
    assert.equal(result.artifact.next_action, "scene-accept");
    assert.equal(result.state.current_node, "scene-accept");
    assert.deepEqual(readSceneStateDeltaArtifact(root, runId, sceneId, 1, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing expected mutation routes to span repair", async () => {
  const { parent, root, runId } = setup();
  try {
    const result = await runSceneStateDeltaExtraction({ root, runId, capsule: capsule(), draftAttempt: 1, runtimeProfile: "tiny-local", worker: new StubWorker(workerResult('{"schema_version":"1.0.0","mutations":[]}')) });
    assert.equal(result.artifact.next_action, "span-repair");
    assert.ok(result.artifact.mismatches.some((item) => item.code === "missing-expected-mutation"));
    assert.equal(result.state.current_node, "span-repair");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("unknown records block while hallucinated evidence remains retryable", async () => {
  const unknown = setup();
  try {
    const mutation = { record_id: "STATE-UNKNOWN", field: "status", operation: "set", value: "open", evidence_quote: "Mara reached the terminal." };
    const result = await runSceneStateDeltaExtraction({ root: unknown.root, runId: unknown.runId, capsule: capsule(), draftAttempt: 1, runtimeProfile: "tiny-local", worker: new StubWorker(workerResult(JSON.stringify({ schema_version: "1.0.0", mutations: [mutation] }))) });
    assert.equal(result.artifact.next_action, "blocked");
    assert.equal(result.state.blocker?.code, "unknown-state-record");
  } finally { rmSync(unknown.parent, { recursive: true, force: true }); }

  const evidence = setup();
  try {
    const mutation = { ...matchingMutation, evidence_quote: "This quote does not exist." };
    await assert.rejects(() => runSceneStateDeltaExtraction({ root: evidence.root, runId: evidence.runId, capsule: capsule(), draftAttempt: 1, runtimeProfile: "tiny-local", worker: new StubWorker(workerResult(JSON.stringify({ schema_version: "1.0.0", mutations: [mutation] }))) }), /evidence quote.*not found|exact evidence/i);
    const state = readChapterExecutionState(evidence.root, evidence.runId)!;
    assert.equal(state.current_node, "state-delta");
    assert.equal(state.attempts[`${sceneId}:state-delta`], 1);
    assert.equal(readSceneStateDeltaArtifact(evidence.root, evidence.runId, sceneId, 1, 1), null);
  } finally { rmSync(evidence.parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStateHash } from "../src/application/project-hash.js";
import {
  createChapterExecutionState,
  transitionChapterExecution,
} from "../src/application/chapter-execution-machine.js";
import { runSceneDraftJob } from "../src/application/scene-draft-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: "CAP-0123456789ABCDEF",
    job_type: "draft-scene",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0",
      scene_id: "CH-001-SC-01-V1",
      chapter_contract_id: "CH-001",
      chapter_contract_version: 1,
      sequence: 1,
      pov: "CHAR-MARA",
      objective: "Reach the terminal.",
      conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.",
      required_beats: ["Enter", "Discover revoked access"],
      active_thread_ids: [],
      required_record_ids: [],
      start_state_ids: [],
      expected_state_delta: [],
      forbidden_changes: ["Do not identify the prior user."],
      knowledge_boundary_ids: [],
      target_words: { minimum: 150, maximum: 260 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: ["Preserve canon."],
    records: [],
    previous_tail: null,
    style_card: null,
    closing_task: ["Draft only CH-001-SC-01-V1.", "Return scene prose only."],
    manifest: {
      included_record_ids: [],
      omitted_record_ids: [],
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: [],
      estimated_evidence_tokens: 120,
      maximum_evidence_tokens: 6000,
    },
  };
}

function setup(): { parent: string; root: string; runId: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-draft-"));
  const root = initializeProject(parent, {
    projectName: "Single Scene Draft",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const runId = "RUN-SCENE-001";
  let state = createChapterExecutionState({
    runId,
    projectHash: projectStateHash(root),
    canonSnapshotHash: storyIndexHash,
    contractHash,
    chapter: 1,
    now: "2026-07-22T00:00:00.000Z",
  });
  state = transitionChapterExecution(state, "scene-contract-compile", "2026-07-22T00:00:01.000Z");
  state = transitionChapterExecution(state, "context-build", "2026-07-22T00:00:02.000Z", "CH-001-SC-01-V1");
  state = transitionChapterExecution(state, "scene-plan", "2026-07-22T00:00:03.000Z", "CH-001-SC-01-V1");
  state = transitionChapterExecution(state, "scene-draft", "2026-07-22T00:00:04.000Z", "CH-001-SC-01-V1");
  writeChapterExecutionState(root, state);
  return { parent, root, runId };
}

function workerResult(text: string): QualityWorkerResult {
  return {
    text,
    usage: {
      callId: "worker-call",
      stage: "drafting",
      pass: "candidate",
      estimated: true,
      elapsedMs: 25,
      promptHash: "c".repeat(64),
      contextHash: "d".repeat(64),
      outputHash: "e".repeat(64),
    },
  };
}

class StubWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  constructor(private readonly result: QualityWorkerResult | Error) {}
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
  async resolveModelCapacity() { return null; }
}

const sceneProse = "Mara held the revoked credential against the reader anyway. The panel stayed dark. She followed the maintenance conduit behind the terminal bank, counting each junction until the access light appeared beneath the floor grate. The route was narrow enough to force her onto one shoulder, but it kept her below the camera line. At the final turn, she heard the security door cycle behind her. She reached the terminal before the patrol entered the archive.";

test("one draft-scene job stores one artifact and advances only to deterministic validation", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(sceneProse));
    const result = await runSceneDraftJob({
      root,
      runId,
      capsule: capsule(),
      runtimeProfile: "tiny-local",
      worker,
      now: "2026-07-22T00:01:00.000Z",
    });

    assert.equal(worker.requests.length, 1);
    const request = worker.requests[0]!;
    assert.equal(request.jobType, "draft-scene");
    assert.equal(request.pass, "candidate");
    assert.equal(request.chapter, 1);
    assert.equal(request.sceneId, "CH-001-SC-01-V1");
    assert.equal(request.attempt, 1);
    assert.equal(request.decoding?.thinking, "off");
    assert.ok(request.context?.startsWith("NON-NEGOTIABLE RULES"));
    assert.ok(request.context?.endsWith("EXACT TASK\n- Draft only CH-001-SC-01-V1.\n- Return scene prose only."));

    assert.equal(result.artifact.scene_id, "CH-001-SC-01-V1");
    assert.equal(result.artifact.attempt, 1);
    assert.equal(result.artifact.prose, sceneProse);
    assert.equal(result.state.current_node, "deterministic-validation");
    assert.equal(result.state.status, "active");
    assert.deepEqual(readSceneDraftArtifact(root, runId, "CH-001-SC-01-V1", 1), result.artifact);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "deterministic-validation");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("worker failure records the attempt and leaves the scene resumable at scene-draft", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(new Error("model unavailable"));
    await assert.rejects(() => runSceneDraftJob({
      root,
      runId,
      capsule: capsule(),
      runtimeProfile: "tiny-local",
      worker,
      now: "2026-07-22T00:02:00.000Z",
    }), /model unavailable/i);
    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.current_node, "scene-draft");
    assert.equal(state.status, "active");
    assert.equal(state.attempts["CH-001-SC-01-V1:scene-draft"], 1);
    assert.equal(readSceneDraftArtifact(root, runId, "CH-001-SC-01-V1", 1), null);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("stale checkpoints and blank model output block before scene advancement", async () => {
  const { parent, root, runId } = setup();
  try {
    const stale = readChapterExecutionState(root, runId)!;
    writeChapterExecutionState(root, { ...stale, project_hash: "f".repeat(64) });
    const staleWorker = new StubWorker(workerResult(sceneProse));
    await assert.rejects(() => runSceneDraftJob({ root, runId, capsule: capsule(), runtimeProfile: "tiny-local", worker: staleWorker }), /project hash changed|stale/i);
    assert.equal(staleWorker.requests.length, 0);

    writeChapterExecutionState(root, stale);
    const blankWorker = new StubWorker(workerResult("   \n"));
    await assert.rejects(() => runSceneDraftJob({ root, runId, capsule: capsule(), runtimeProfile: "tiny-local", worker: blankWorker }), /blank|empty/i);
    const afterBlank = readChapterExecutionState(root, runId)!;
    assert.equal(afterBlank.current_node, "scene-draft");
    assert.equal(afterBlank.attempts["CH-001-SC-01-V1:scene-draft"], 1);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

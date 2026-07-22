import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createChapterExecutionState,
  transitionChapterExecution,
} from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { runSceneCriticJob } from "../src/application/scene-critic-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { readSceneCriticArtifact } from "../src/infrastructure/scene-critic-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const draftProse = `${"Mara checked the access panel. ".repeat(20)}The access panel stayed dark. ${"She traced the maintenance conduit toward the terminal. ".repeat(20)}`.trim();

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function capsule(jobType: "critic-continuity" | "critic-style"): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: jobType === "critic-continuity" ? "CAP-1111111111111111" : "CAP-2222222222222222",
    job_type: jobType,
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
      required_record_ids: [],
      start_state_ids: [],
      expected_state_delta: [],
      forbidden_changes: [],
      knowledge_boundary_ids: [],
      target_words: { minimum: 150, maximum: 300 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: ["Use exact evidence from the candidate scene."],
    records: [],
    previous_tail: null,
    style_card: null,
    closing_task: [`Review only ${jobType}.`, "Return one exact JSON object."],
    manifest: {
      included_record_ids: [],
      omitted_record_ids: [],
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: [],
      estimated_evidence_tokens: 100,
      maximum_evidence_tokens: 10000,
    },
  };
}

function draftArtifact(): SceneDraftArtifact {
  const outputHash = hash(draftProse);
  return {
    schema_version: "1.0.0",
    run_id: "RUN-CRITIC-001",
    chapter: 1,
    scene_id: sceneId,
    chapter_contract_id: "CH-001",
    chapter_contract_version: 1,
    job_type: "draft-scene",
    capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    model_execution_profile: "small-12b-q4",
    runtime_profile: "tiny-local",
    attempt: 1,
    prose: draftProse,
    word_count: draftProse.split(/\s+/).length,
    output_hash: outputHash,
    usage: {
      callId: "RUN-CRITIC-001-DRAFT-1",
      stage: "drafting",
      chapter: 1,
      sceneId,
      attempt: 1,
      pass: "candidate",
      jobType: "draft-scene",
      contractHash,
      capsuleHash: "c".repeat(64),
      includedRecordCount: 0,
      estimated: true,
      elapsedMs: 1,
      promptHash: "d".repeat(64),
      contextHash: "e".repeat(64),
      outputHash,
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validationArtifact(draft: SceneDraftArtifact): SceneValidationArtifact {
  return {
    schema_version: "1.0.0",
    run_id: draft.run_id,
    chapter: 1,
    scene_id: sceneId,
    draft_attempt: 1,
    draft_output_hash: draft.output_hash,
    capsule_id: draft.capsule_id,
    contract_hash: contractHash,
    findings: [],
    blocker_count: 0,
    warning_count: 0,
    passed: true,
    next_node: "critic-review",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

function setup(): { parent: string; root: string; runId: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-critic-"));
  const root = initializeProject(parent, {
    projectName: "Scene Critic",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const draft = draftArtifact();
  const runId = draft.run_id;
  let state = createChapterExecutionState({
    runId,
    projectHash: projectStateHash(root),
    canonSnapshotHash: storyIndexHash,
    contractHash,
    chapter: 1,
  });
  state = transitionChapterExecution(state, "scene-contract-compile");
  state = transitionChapterExecution(state, "context-build", undefined, sceneId);
  state = transitionChapterExecution(state, "scene-plan", undefined, sceneId);
  state = transitionChapterExecution(state, "scene-draft", undefined, sceneId);
  state = transitionChapterExecution(state, "deterministic-validation", undefined, sceneId);
  state = transitionChapterExecution(state, "critic-review", undefined, sceneId);
  writeChapterExecutionState(root, state);
  writeSceneDraftArtifact(root, draft);
  writeSceneValidationArtifact(root, validationArtifact(draft));
  return { parent, root, runId };
}

function workerResult(text: string): QualityWorkerResult {
  return {
    text,
    usage: {
      callId: "worker-call",
      stage: "drafting",
      pass: "critic",
      estimated: true,
      elapsedMs: 10,
      promptHash: "f".repeat(64),
      contextHash: "1".repeat(64),
      outputHash: "2".repeat(64),
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

test("one critic job reviews one concern and stores an independent artifact", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] })));
    const result = await runSceneCriticJob({
      root,
      runId,
      capsule: capsule("critic-continuity"),
      draftAttempt: 1,
      runtimeProfile: "tiny-local",
      worker,
      now: "2026-07-22T00:02:00.000Z",
    });
    assert.equal(worker.requests.length, 1);
    const request = worker.requests[0]!;
    assert.equal(request.jobType, "critic-continuity");
    assert.equal(request.pass, "critic");
    assert.equal(request.sceneId, sceneId);
    assert.equal(request.attempt, 1);
    assert.ok((request.context?.indexOf("SCENE CANDIDATE") ?? -1) < (request.context?.indexOf("EXACT TASK") ?? -1));
    assert.ok(request.context?.endsWith("EXACT TASK\n- Review only critic-continuity.\n- Return one exact JSON object."));
    assert.equal(result.artifact.verdict, "pass");
    assert.equal(result.state.current_node, "critic-review");
    assert.deepEqual(readSceneCriticArtifact(root, runId, sceneId, "critic-continuity", 1), result.artifact);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("critic findings require an exact bounded evidence quote from the candidate scene", async () => {
  const { parent, root, runId } = setup();
  try {
    const validWorker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      verdict: "repair",
      findings: [{ severity: "high", category: "continuity", evidence_quote: "The access panel stayed dark.", required_change: "Clarify why Mara continues after the failed credential." }],
    })));
    const valid = await runSceneCriticJob({ root, runId, capsule: capsule("critic-continuity"), draftAttempt: 1, runtimeProfile: "tiny-local", worker: validWorker });
    assert.equal(valid.artifact.findings[0]?.evidence_quote, "The access panel stayed dark.");

    const hallucinatedWorker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      verdict: "repair",
      findings: [{ severity: "high", category: "continuity", evidence_quote: "A sentence that is not in the draft.", required_change: "Repair it." }],
    })));
    await assert.rejects(() => runSceneCriticJob({ root, runId, capsule: capsule("critic-style"), draftAttempt: 1, runtimeProfile: "tiny-local", worker: hallucinatedWorker }), /evidence quote.*not found|exact evidence/i);
    assert.equal(readSceneCriticArtifact(root, runId, sceneId, "critic-style", 1), null);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "critic-review");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

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
import { runSceneSpanRepair } from "../src/application/scene-span-repair-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { SceneCriticArtifact } from "../src/domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeSceneCriticArtifact } from "../src/infrastructure/scene-critic-artifact-store.js";
import { readSceneDraftArtifact, writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { readScenePatchArtifact } from "../src/infrastructure/scene-patch-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sourceProse(): string {
  return `Here is the scene. ${Array.from({ length: 34 }, (_, index) => `Mara followed conduit ${index + 1} toward the terminal.`).join(" ")}`;
}

function repeatedProse(): string {
  return `${Array.from({ length: 12 }, () => "The panel stayed dark. Mara checked the conduit.").join(" ")} ${Array.from({ length: 20 }, (_, index) => `She counted junction ${index + 1}.`).join(" ")}`;
}

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: "CAP-3333333333333333",
    job_type: "patch-spans",
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
      target_words: { minimum: 150, maximum: 260 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: ["Change only uniquely anchored spans."],
    records: [],
    previous_tail: null,
    style_card: null,
    closing_task: ["Repair only the listed findings.", "Return one exact JSON patch object."],
    manifest: {
      included_record_ids: [],
      omitted_record_ids: [],
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: [],
      estimated_evidence_tokens: 100,
      maximum_evidence_tokens: 5000,
    },
  };
}

function draftArtifact(prose: string): SceneDraftArtifact {
  const outputHash = hash(prose);
  return {
    schema_version: "1.0.0",
    run_id: "RUN-PATCH-001",
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
    prose,
    word_count: prose.split(/\s+/).length,
    output_hash: outputHash,
    usage: {
      callId: "draft-1",
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

function validationArtifact(draft: SceneDraftArtifact, findings: SceneValidationArtifact["findings"]): SceneValidationArtifact {
  return {
    schema_version: "1.0.0",
    run_id: draft.run_id,
    chapter: 1,
    scene_id: sceneId,
    draft_attempt: 1,
    draft_output_hash: draft.output_hash,
    capsule_id: draft.capsule_id,
    contract_hash: contractHash,
    findings,
    blocker_count: findings.filter((item) => item.severity === "blocker").length,
    warning_count: findings.filter((item) => item.severity === "warning").length,
    passed: false,
    next_node: "span-repair",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

function criticArtifact(draft: SceneDraftArtifact): SceneCriticArtifact {
  return {
    schema_version: "1.0.0",
    run_id: draft.run_id,
    chapter: 1,
    scene_id: sceneId,
    draft_attempt: 1,
    draft_output_hash: draft.output_hash,
    job_type: "critic-style",
    capsule_id: "CAP-2222222222222222",
    contract_hash: contractHash,
    critic_attempt: 1,
    verdict: "repair",
    findings: [{
      severity: "high",
      category: "critic-style",
      evidence_quote: "Mara followed conduit 1 toward the terminal.",
      required_change: "Replace the generic opening action with a concrete access check.",
    }],
    usage: {
      callId: "critic-style-1",
      stage: "drafting",
      chapter: 1,
      sceneId,
      attempt: 1,
      pass: "critic",
      jobType: "critic-style",
      contractHash,
      capsuleHash: "f".repeat(64),
      includedRecordCount: 0,
      estimated: true,
      elapsedMs: 1,
      promptHash: "1".repeat(64),
      contextHash: "2".repeat(64),
      outputHash: "3".repeat(64),
    },
    created_at: "2026-07-22T00:00:02.000Z",
  };
}

function setup(prose = sourceProse(), includeCritic = false): { parent: string; root: string; runId: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-patch-"));
  const root = initializeProject(parent, {
    projectName: "Scene Patch",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const draft = draftArtifact(prose);
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
  state = transitionChapterExecution(state, includeCritic ? "critic-review" : "span-repair", undefined, sceneId);
  if (includeCritic) state = transitionChapterExecution(state, "span-repair", undefined, sceneId);
  writeChapterExecutionState(root, state);
  writeSceneDraftArtifact(root, draft);
  writeSceneValidationArtifact(root, validationArtifact(draft, includeCritic ? [] : [{ code: "meta-commentary", severity: "blocker", message: "Remove drafting commentary." }]));
  if (includeCritic) writeSceneCriticArtifact(root, criticArtifact(draft));
  return { parent, root, runId };
}

function workerResult(text: string): QualityWorkerResult {
  return {
    text,
    usage: {
      callId: "worker-call",
      stage: "drafting",
      pass: "revision",
      estimated: true,
      elapsedMs: 10,
      promptHash: "4".repeat(64),
      contextHash: "5".repeat(64),
      outputHash: "6".repeat(64),
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

test("bounded exact-anchor repair creates a new scene version and returns to deterministic validation", async () => {
  const { parent, root, runId } = setup();
  try {
    const worker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      operations: [{ operation: "delete", anchor_quote: "Here is the scene. ", replacement: "", finding_refs: ["deterministic:meta-commentary"] }],
    })));
    const result = await runSceneSpanRepair({
      root,
      runId,
      capsule: capsule(),
      sourceDraftAttempt: 1,
      runtimeProfile: "tiny-local",
      worker,
      now: "2026-07-22T00:03:00.000Z",
    });
    assert.equal(worker.requests.length, 1);
    const request = worker.requests[0]!;
    assert.equal(request.jobType, "patch-spans");
    assert.equal(request.pass, "revision");
    assert.equal(request.sceneId, sceneId);
    assert.ok((request.context?.indexOf("SCENE CANDIDATE") ?? -1) < (request.context?.indexOf("REPAIR FINDINGS") ?? -1));
    assert.ok((request.context?.indexOf("REPAIR FINDINGS") ?? -1) < (request.context?.indexOf("EXACT TASK") ?? -1));
    assert.ok(request.context?.endsWith("EXACT TASK\n- Repair only the listed findings.\n- Return one exact JSON patch object."));
    assert.equal(result.patch.patch_attempt, 1);
    assert.equal(result.repairedDraft.attempt, 2);
    assert.equal(result.repairedDraft.job_type, "patch-spans");
    assert.doesNotMatch(result.repairedDraft.prose, /Here is the scene/);
    assert.equal(result.state.current_node, "deterministic-validation");
    assert.deepEqual(readScenePatchArtifact(root, runId, sceneId, 1), result.patch);
    assert.deepEqual(readSceneDraftArtifact(root, runId, sceneId, 2), result.repairedDraft);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("critic repair findings can drive an exact bounded replacement", async () => {
  const { parent, root, runId } = setup(sourceProse(), true);
  try {
    const worker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      operations: [{
        operation: "replace",
        anchor_quote: "Mara followed conduit 1 toward the terminal.",
        replacement: "Mara tested the dead credential reader before following the first conduit toward the terminal.",
        finding_refs: ["critic-style:1"],
      }],
    })));
    const result = await runSceneSpanRepair({
      root,
      runId,
      capsule: capsule(),
      sourceDraftAttempt: 1,
      runtimeProfile: "tiny-local",
      worker,
      criticAttempts: { "critic-style": 1 },
    });
    assert.match(result.repairedDraft.prose, /tested the dead credential reader/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("ambiguous anchors, excessive edits, and worker failures remain resumable at span-repair", async () => {
  const ambiguousSetup = setup(repeatedProse());
  try {
    const worker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      operations: [{ operation: "replace", anchor_quote: "The panel stayed dark.", replacement: "The panel remained unlit.", finding_refs: ["deterministic:meta-commentary"] }],
    })));
    await assert.rejects(() => runSceneSpanRepair({ root: ambiguousSetup.root, runId: ambiguousSetup.runId, capsule: capsule(), sourceDraftAttempt: 1, runtimeProfile: "tiny-local", worker }), /unique|ambiguous|more than once/i);
    const state = readChapterExecutionState(ambiguousSetup.root, ambiguousSetup.runId)!;
    assert.equal(state.current_node, "span-repair");
    assert.equal(state.attempts[`${sceneId}:span-repair`], 1);
    assert.equal(readScenePatchArtifact(ambiguousSetup.root, ambiguousSetup.runId, sceneId, 1), null);
  } finally {
    rmSync(ambiguousSetup.parent, { recursive: true, force: true });
  }

  const excessiveSetup = setup();
  try {
    const source = sourceProse();
    const anchor = source.slice(0, 200);
    const worker = new StubWorker(workerResult(JSON.stringify({
      schema_version: "1.0.0",
      operations: [{ operation: "replace", anchor_quote: anchor, replacement: "x".repeat(700), finding_refs: ["deterministic:meta-commentary"] }],
    })));
    await assert.rejects(() => runSceneSpanRepair({ root: excessiveSetup.root, runId: excessiveSetup.runId, capsule: capsule(), sourceDraftAttempt: 1, runtimeProfile: "tiny-local", worker }), /bounded|edit volume|replacement/i);
    assert.equal(readChapterExecutionState(excessiveSetup.root, excessiveSetup.runId)?.current_node, "span-repair");
  } finally {
    rmSync(excessiveSetup.parent, { recursive: true, force: true });
  }

  const failureSetup = setup();
  try {
    const worker = new StubWorker(new Error("patch model unavailable"));
    await assert.rejects(() => runSceneSpanRepair({ root: failureSetup.root, runId: failureSetup.runId, capsule: capsule(), sourceDraftAttempt: 1, runtimeProfile: "tiny-local", worker }), /patch model unavailable/i);
    const state = readChapterExecutionState(failureSetup.root, failureSetup.runId)!;
    assert.equal(state.current_node, "span-repair");
    assert.equal(state.attempts[`${sceneId}:span-repair`], 1);
  } finally {
    rmSync(failureSetup.parent, { recursive: true, force: true });
  }
});

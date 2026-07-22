import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { runSceneSpanRepair } from "../src/application/scene-span-repair-runner.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneStateDeltaArtifact } from "../src/domain/scene-state-delta-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact, writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { writeSceneStateDeltaArtifact } from "../src/infrastructure/scene-state-delta-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const runId = "RUN-DELTA-REPAIR-001";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const prose = "Mara reached the terminal and pressed her revoked credential against the reader. The panel stayed dark while the patrol crossed the archive corridor.";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0", capsule_id: "CAP-7777777777777777", job_type: "patch-spans",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0", scene_id: sceneId, chapter_contract_id: "CH-001", chapter_contract_version: 1,
      sequence: 1, pov: "CHAR-MARA", objective: "Reach the terminal.", conflict: "The credential is revoked.",
      turn: "Mara uses the maintenance route.", required_beats: ["Reach the terminal", "Record Mara at the terminal"],
      active_thread_ids: [], required_record_ids: ["STATE-MARA-LOCATION"], start_state_ids: [],
      expected_state_delta: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbidden_changes: [], knowledge_boundary_ids: [], target_words: { minimum: 20, maximum: 120 },
      ending_requirement: "Mara remains at the terminal.",
    },
    contract_hash: contractHash, story_index_hash: storyIndexHash,
    opening_rules: ["Repair only the mismatched state evidence."],
    records: [{
      id: "STATE-MARA-LOCATION", kind: "state", status: "current-state", authority: "established",
      required: true, reason: "expected state delta", source_path: "series/state-ledger.yaml", source_hash: "c".repeat(64),
      version: 1, payload: { subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR" },
      dependencies: [], estimated_tokens: 20,
    }],
    previous_tail: null, style_card: null,
    closing_task: ["Repair only the listed findings.", "Return one exact JSON patch object."],
    manifest: {
      included_record_ids: ["STATE-MARA-LOCATION"], omitted_record_ids: [], missing_required_record_ids: [],
      unsafe_required_record_ids: [], dependency_edges: [], estimated_evidence_tokens: 100, maximum_evidence_tokens: 5000,
    },
  };
}

function usage(callId: string, pass: "candidate" | "verification", jobType: "draft-scene" | "extract-state-delta", outputHash: string) {
  return {
    callId, stage: "drafting", chapter: 1, sceneId, attempt: 1, pass, jobType, contractHash,
    capsuleHash: "d".repeat(64), includedRecordCount: 1, estimated: true, elapsedMs: 1,
    promptHash: "e".repeat(64), contextHash: "f".repeat(64), outputHash,
  } as const;
}

function draft(): SceneDraftArtifact {
  const outputHash = hash(prose);
  return {
    schema_version: "1.0.0", run_id: runId, chapter: 1, scene_id: sceneId,
    chapter_contract_id: "CH-001", chapter_contract_version: 1, job_type: "draft-scene",
    capsule_id: "CAP-1111111111111111", contract_hash: contractHash, story_index_hash: storyIndexHash,
    model_execution_profile: "small-12b-q4", runtime_profile: "tiny-local", attempt: 1,
    prose, word_count: prose.split(/\s+/).length, output_hash: outputHash,
    usage: usage("draft-1", "candidate", "draft-scene", outputHash), created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validation(value: SceneDraftArtifact): SceneValidationArtifact {
  return {
    schema_version: "1.0.0", run_id: runId, chapter: 1, scene_id: sceneId, draft_attempt: 1,
    draft_output_hash: value.output_hash, capsule_id: value.capsule_id, contract_hash: contractHash,
    findings: [], blocker_count: 0, warning_count: 0, passed: true, next_node: "critic-review",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

function delta(value: SceneDraftArtifact): SceneStateDeltaArtifact {
  return {
    schema_version: "1.0.0", run_id: runId, chapter: 1, scene_id: sceneId, draft_attempt: 1,
    draft_output_hash: value.output_hash, capsule_id: "CAP-2222222222222222", contract_hash: contractHash,
    extraction_attempt: 1,
    expected_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
    actual_mutations: [],
    mismatches: [{ code: "missing-expected-mutation", record_id: "STATE-MARA-LOCATION", field: "location", message: "Scene does not establish expected mutation STATE-MARA-LOCATION.location." }],
    matches_expected: false, next_action: "span-repair",
    usage: usage("delta-1", "verification", "extract-state-delta", "4".repeat(64)),
    created_at: "2026-07-22T00:00:02.000Z",
  };
}

class StubWorker implements QualityWorker {
  request: QualityWorkerRequest | null = null;
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.request = request;
    return {
      text: JSON.stringify({
        schema_version: "1.0.0",
        operations: [{
          operation: "replace", anchor_quote: "Mara reached the terminal",
          replacement: "Mara reached the terminal and remained there",
          finding_refs: ["state-delta:missing-expected-mutation:STATE-MARA-LOCATION:location"],
        }],
      }),
      usage: {
        callId: request.callId, stage: request.stage,
        ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
        ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
        ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
        pass: request.pass, ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
        estimated: true, elapsedMs: 1, promptHash: "5".repeat(64), contextHash: "6".repeat(64), outputHash: "7".repeat(64),
      },
    };
  }
  async resolveModelCapacity() { return null; }
}

test("state-delta mismatches become bounded span-repair findings", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-delta-repair-"));
  const root = initializeProject(parent, { projectName: "Delta Repair", projectType: "standalone", profile: "thriller" });
  try {
    const candidate = draft();
    let state = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
    for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta", "span-repair"] as const) {
      state = transitionChapterExecution(state, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
    }
    writeChapterExecutionState(root, state);
    writeSceneDraftArtifact(root, candidate);
    writeSceneValidationArtifact(root, validation(candidate));
    writeSceneStateDeltaArtifact(root, delta(candidate));

    const worker = new StubWorker();
    const repairInput = {
      root, runId, capsule: capsule(), sourceDraftAttempt: 1, stateDeltaExtractionAttempt: 1,
      runtimeProfile: "tiny-local" as const, worker,
    };
    const result = await runSceneSpanRepair(repairInput);

    assert.match(worker.request?.context ?? "", /state-delta:missing-expected-mutation:STATE-MARA-LOCATION:location/);
    assert.match(result.repairedDraft.prose, /remained there/);
    assert.equal(result.state.current_node, "deterministic-validation");
    assert.deepEqual(readSceneDraftArtifact(root, runId, sceneId, 2), result.repairedDraft);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "deterministic-validation");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

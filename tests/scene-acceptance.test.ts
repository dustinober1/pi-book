import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptExecutionScene,
  createChapterExecutionState,
  transitionChapterExecution,
} from "../src/application/chapter-execution-machine.js";
import { acceptSceneCandidate } from "../src/application/scene-acceptance.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { SceneCriticSummaryArtifact } from "../src/domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneStateDeltaArtifact } from "../src/domain/scene-state-delta-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readSceneAcceptanceArtifact } from "../src/infrastructure/scene-acceptance-artifact-store.js";
import { writeSceneCriticSummaryArtifact } from "../src/infrastructure/scene-critic-summary-store.js";
import { writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { writeSceneStateDeltaArtifact } from "../src/infrastructure/scene-state-delta-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const scenes = ["CH-001-SC-01-V1", "CH-001-SC-02-V1"] as const;
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function prose(sceneId: string): string {
  return sceneId === scenes[0]
    ? "Mara crossed the corridor and reached the first terminal."
    : "Mara copied the final access log and sealed the terminal behind her.";
}

function draft(sceneId: string): SceneDraftArtifact {
  const text = prose(sceneId);
  const outputHash = hash(text);
  return {
    schema_version: "1.0.0", run_id: "RUN-ACCEPT-001", chapter: 1, scene_id: sceneId,
    chapter_contract_id: "CH-001", chapter_contract_version: 1, job_type: "draft-scene",
    capsule_id: "CAP-0123456789ABCDEF", contract_hash: contractHash, story_index_hash: storyIndexHash,
    model_execution_profile: "small-12b-q4", runtime_profile: "tiny-local", attempt: 1,
    prose: text, word_count: text.split(/\s+/).length, output_hash: outputHash,
    usage: {
      callId: `${sceneId}-draft`, stage: "drafting", chapter: 1, sceneId, attempt: 1,
      pass: "candidate", jobType: "draft-scene", contractHash, capsuleHash: "c".repeat(64),
      includedRecordCount: 0, estimated: true, elapsedMs: 1,
      promptHash: "d".repeat(64), contextHash: "e".repeat(64), outputHash,
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function validation(value: SceneDraftArtifact): SceneValidationArtifact {
  return {
    schema_version: "1.0.0", run_id: value.run_id, chapter: 1, scene_id: value.scene_id,
    draft_attempt: 1, draft_output_hash: value.output_hash, capsule_id: value.capsule_id,
    contract_hash: contractHash, findings: [], blocker_count: 0, warning_count: 0,
    passed: true, next_node: "critic-review", created_at: "2026-07-22T00:00:01.000Z",
  };
}

function critics(value: SceneDraftArtifact): SceneCriticSummaryArtifact {
  return {
    schema_version: "1.0.0", run_id: value.run_id, chapter: 1, scene_id: value.scene_id,
    draft_attempt: 1, draft_output_hash: value.output_hash, contract_hash: contractHash,
    required_job_types: ["critic-continuity"],
    critics: [{ job_type: "critic-continuity", critic_attempt: 1, verdict: "pass", finding_count: 0 }],
    blocker_count: 0, repair_count: 0, passed: true, next_action: "state-delta",
    created_at: "2026-07-22T00:00:02.000Z",
  };
}

function delta(value: SceneDraftArtifact, matchesExpected = true): SceneStateDeltaArtifact {
  const mutation = value.scene_id === scenes[0]
    ? { record_id: "STATE-MARA-LOCATION", field: "location", operation: "set" as const, value: "LOC-TERMINAL-1" }
    : { record_id: "STATE-MARA-LOG", field: "custody", operation: "set" as const, value: "secured" };
  return {
    schema_version: "1.0.0", run_id: value.run_id, chapter: 1, scene_id: value.scene_id,
    draft_attempt: 1, draft_output_hash: value.output_hash, capsule_id: "CAP-4444444444444444",
    contract_hash: contractHash, extraction_attempt: 1, expected_mutations: [mutation],
    actual_mutations: matchesExpected ? [{ ...mutation, evidence_quote: value.scene_id === scenes[0] ? "reached the first terminal" : "copied the final access log" }] : [],
    mismatches: matchesExpected ? [] : [{ code: "missing-expected-mutation", record_id: mutation.record_id, field: mutation.field, message: "Expected mutation is missing." }],
    matches_expected: matchesExpected, next_action: matchesExpected ? "scene-accept" : "span-repair",
    usage: {
      callId: `${value.scene_id}-delta`, stage: "drafting", chapter: 1, sceneId: value.scene_id,
      attempt: 1, pass: "verification", jobType: "extract-state-delta", contractHash,
      capsuleHash: "f".repeat(64), includedRecordCount: 1, estimated: true, elapsedMs: 1,
      promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
    },
    created_at: "2026-07-22T00:00:03.000Z",
  };
}

function setup(sceneId: typeof scenes[number], accepted: string[] = [], matchesExpected = true) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-accept-"));
  const root = initializeProject(parent, { projectName: "Scene Acceptance", projectType: "standalone", profile: "thriller" });
  const candidate = draft(sceneId);
  let state = createChapterExecutionState({ runId: candidate.run_id, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
  for (const node of ["scene-contract-compile", "context-build", "scene-plan", "scene-draft", "deterministic-validation", "critic-review", "state-delta", "scene-accept"] as const) {
    state = transitionChapterExecution(state, node, undefined, node === "scene-contract-compile" ? undefined : sceneId);
  }
  for (const acceptedScene of accepted) state = acceptExecutionScene(state, acceptedScene);
  writeChapterExecutionState(root, state);
  writeSceneDraftArtifact(root, candidate);
  writeSceneValidationArtifact(root, validation(candidate));
  writeSceneCriticSummaryArtifact(root, critics(candidate));
  writeSceneStateDeltaArtifact(root, delta(candidate, matchesExpected));
  return { parent, root, runId: candidate.run_id };
}

test("accepting a non-final scene records provenance and routes to the next scene context", () => {
  const { parent, root, runId } = setup(scenes[0]);
  try {
    const result = acceptSceneCandidate({ root, runId, sceneId: scenes[0], draftAttempt: 1, stateDeltaExtractionAttempt: 1, chapterSceneIds: [...scenes], now: "2026-07-22T00:01:00.000Z" });
    assert.equal(result.artifact.next_node, "context-build");
    assert.equal(result.artifact.next_scene_id, scenes[1]);
    assert.equal(result.state.current_node, "context-build");
    assert.equal(result.state.current_scene_id, scenes[1]);
    assert.deepEqual(result.state.accepted_scene_ids, [scenes[0]]);
    assert.deepEqual(readSceneAcceptanceArtifact(root, runId, scenes[0], 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("accepting the final ordered scene routes to chapter stitch", () => {
  const { parent, root, runId } = setup(scenes[1], [scenes[0]]);
  try {
    const result = acceptSceneCandidate({ root, runId, sceneId: scenes[1], draftAttempt: 1, stateDeltaExtractionAttempt: 1, chapterSceneIds: [...scenes] });
    assert.equal(result.artifact.next_node, "chapter-stitch");
    assert.equal(result.artifact.next_scene_id, null);
    assert.equal(result.state.current_node, "chapter-stitch");
    assert.deepEqual(result.state.accepted_scene_ids, [...scenes]);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("mismatched delta or skipped prior scene blocks acceptance without changing the checkpoint", () => {
  const mismatch = setup(scenes[0], [], false);
  try {
    assert.throws(() => acceptSceneCandidate({ root: mismatch.root, runId: mismatch.runId, sceneId: scenes[0], draftAttempt: 1, stateDeltaExtractionAttempt: 1, chapterSceneIds: [...scenes] }), /state delta.*match|not ready|scene-accept/i);
    assert.equal(readChapterExecutionState(mismatch.root, mismatch.runId)?.current_node, "scene-accept");
    assert.equal(readSceneAcceptanceArtifact(mismatch.root, mismatch.runId, scenes[0], 1), null);
  } finally { rmSync(mismatch.parent, { recursive: true, force: true }); }

  const skipped = setup(scenes[1]);
  try {
    assert.throws(() => acceptSceneCandidate({ root: skipped.root, runId: skipped.runId, sceneId: scenes[1], draftAttempt: 1, stateDeltaExtractionAttempt: 1, chapterSceneIds: [...scenes] }), /previous scene|order|CH-001-SC-01-V1/i);
    assert.equal(readChapterExecutionState(skipped.root, skipped.runId)?.current_node, "scene-accept");
  } finally { rmSync(skipped.parent, { recursive: true, force: true }); }
});

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
import { finalizeSceneCriticReview } from "../src/application/scene-critic-aggregation.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { SceneCriticArtifact, SceneCriticJobType } from "../src/domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import type { SceneValidationArtifact } from "../src/domain/scene-validation-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeSceneCriticArtifact } from "../src/infrastructure/scene-critic-artifact-store.js";
import { readSceneCriticSummaryArtifact } from "../src/infrastructure/scene-critic-summary-store.js";
import { writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { writeSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const prose = "Mara checked the access panel. The access panel stayed dark. She followed the maintenance conduit until the terminal came into view.";

function hash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

function draftArtifact(): SceneDraftArtifact {
  const outputHash = hash(prose);
  return {
    schema_version: "1.0.0",
    run_id: "RUN-CRITIC-SUMMARY",
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
      callId: "draft",
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

function criticArtifact(jobType: SceneCriticJobType, verdict: "pass" | "repair" | "block"): SceneCriticArtifact {
  const draft = draftArtifact();
  const findings = verdict === "pass" ? [] : [{
    severity: verdict === "block" ? "blocker" as const : "high" as const,
    category: jobType,
    evidence_quote: "The access panel stayed dark.",
    required_change: verdict === "block" ? "Request an editorial decision." : "Clarify the causal response.",
  }];
  return {
    schema_version: "1.0.0",
    run_id: draft.run_id,
    chapter: 1,
    scene_id: sceneId,
    draft_attempt: 1,
    draft_output_hash: draft.output_hash,
    job_type: jobType,
    capsule_id: jobType === "critic-continuity" ? "CAP-1111111111111111" : "CAP-2222222222222222",
    contract_hash: contractHash,
    critic_attempt: 1,
    verdict,
    findings,
    usage: {
      callId: `${jobType}-1`,
      stage: "drafting",
      chapter: 1,
      sceneId,
      attempt: 1,
      pass: "critic",
      jobType,
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

function setup(): { parent: string; root: string; runId: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-critic-summary-"));
  const root = initializeProject(parent, { projectName: "Critic Summary", projectType: "standalone", profile: "thriller" });
  const draft = draftArtifact();
  const runId = draft.run_id;
  let state = createChapterExecutionState({ runId, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
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

test("all required critic passes route the scene to state-delta extraction", () => {
  const { parent, root, runId } = setup();
  try {
    writeSceneCriticArtifact(root, criticArtifact("critic-continuity", "pass"));
    writeSceneCriticArtifact(root, criticArtifact("critic-style", "pass"));
    const result = finalizeSceneCriticReview({
      root,
      runId,
      sceneId,
      draftAttempt: 1,
      requiredJobTypes: ["critic-continuity", "critic-style"],
      criticAttempts: { "critic-continuity": 1, "critic-style": 1 },
    });
    assert.equal(result.artifact.passed, true);
    assert.equal(result.artifact.next_action, "state-delta");
    assert.equal(result.state.current_node, "state-delta");
    assert.deepEqual(readSceneCriticSummaryArtifact(root, runId, sceneId, 1), result.artifact);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("any required repair routes to span-repair and missing critics block aggregation", () => {
  const { parent, root, runId } = setup();
  try {
    writeSceneCriticArtifact(root, criticArtifact("critic-continuity", "pass"));
    assert.throws(() => finalizeSceneCriticReview({
      root,
      runId,
      sceneId,
      draftAttempt: 1,
      requiredJobTypes: ["critic-continuity", "critic-style"],
      criticAttempts: { "critic-continuity": 1, "critic-style": 1 },
    }), /missing required critic|critic-style/i);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "critic-review");

    writeSceneCriticArtifact(root, criticArtifact("critic-style", "repair"));
    const result = finalizeSceneCriticReview({
      root,
      runId,
      sceneId,
      draftAttempt: 1,
      requiredJobTypes: ["critic-continuity", "critic-style"],
      criticAttempts: { "critic-continuity": 1, "critic-style": 1 },
    });
    assert.equal(result.artifact.passed, false);
    assert.equal(result.artifact.next_action, "span-repair");
    assert.equal(result.state.current_node, "span-repair");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a blocking critic pauses execution for an editorial decision", () => {
  const { parent, root, runId } = setup();
  try {
    writeSceneCriticArtifact(root, criticArtifact("critic-continuity", "block"));
    const result = finalizeSceneCriticReview({
      root,
      runId,
      sceneId,
      draftAttempt: 1,
      requiredJobTypes: ["critic-continuity"],
      criticAttempts: { "critic-continuity": 1 },
    });
    assert.equal(result.artifact.next_action, "blocked");
    assert.equal(result.state.status, "blocked");
    assert.equal(result.state.blocker?.code, "needs-editorial-decision");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

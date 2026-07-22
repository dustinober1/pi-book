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
import { validateSceneDraft } from "../src/application/deterministic-scene-validator.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import type { SceneDraftArtifact } from "../src/domain/scene-draft-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeSceneDraftArtifact } from "../src/infrastructure/scene-draft-artifact-store.js";
import { readSceneValidationArtifact } from "../src/infrastructure/scene-validation-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const capsuleId = "CAP-0123456789ABCDEF";
const sceneId = "CH-001-SC-01-V1";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function proseWords(count: number): string {
  return Array.from({ length: count }, (_, index) => index % 12 === 11 ? "checkpoint." : `word${index + 1}`).join(" ");
}

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: capsuleId,
    job_type: "draft-scene",
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
      target_words: { minimum: 150, maximum: 180 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: ["Preserve canon."],
    records: [],
    previous_tail: null,
    style_card: null,
    closing_task: ["Draft the scene."],
    manifest: {
      included_record_ids: [],
      omitted_record_ids: [],
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: [],
      estimated_evidence_tokens: 100,
      maximum_evidence_tokens: 6000,
    },
  };
}

function artifact(prose: string, overrides: Partial<SceneDraftArtifact> = {}): SceneDraftArtifact {
  const outputHash = hash(prose);
  return {
    schema_version: "1.0.0",
    run_id: "RUN-VALIDATE-001",
    chapter: 1,
    scene_id: sceneId,
    chapter_contract_id: "CH-001",
    chapter_contract_version: 1,
    job_type: "draft-scene",
    capsule_id: capsuleId,
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    model_execution_profile: "small-12b-q4",
    runtime_profile: "tiny-local",
    attempt: 1,
    prose,
    word_count: prose.trim().split(/\s+/).filter(Boolean).length,
    output_hash: outputHash,
    usage: {
      callId: "RUN-VALIDATE-001-DRAFT-1",
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
    ...overrides,
  };
}

function setup(draft: SceneDraftArtifact): { parent: string; root: string; runId: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scene-validation-"));
  const root = initializeProject(parent, {
    projectName: "Scene Validation",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const runId = draft.run_id;
  let state = createChapterExecutionState({
    runId,
    projectHash: projectStateHash(root),
    canonSnapshotHash: storyIndexHash,
    contractHash,
    chapter: 1,
    now: "2026-07-22T00:00:00.000Z",
  });
  state = transitionChapterExecution(state, "scene-contract-compile", undefined);
  state = transitionChapterExecution(state, "context-build", undefined, sceneId);
  state = transitionChapterExecution(state, "scene-plan", undefined, sceneId);
  state = transitionChapterExecution(state, "scene-draft", undefined, sceneId);
  state = transitionChapterExecution(state, "deterministic-validation", undefined, sceneId);
  writeChapterExecutionState(root, state);
  writeSceneDraftArtifact(root, draft);
  return { parent, root, runId };
}

test("a structurally valid scene routes to concern-specific critic review", () => {
  const draft = artifact(proseWords(160));
  const { parent, root, runId } = setup(draft);
  try {
    const result = validateSceneDraft({ root, runId, capsule: capsule(), attempt: 1, now: "2026-07-22T00:01:00.000Z" });
    assert.equal(result.artifact.passed, true);
    assert.equal(result.artifact.blocker_count, 0);
    assert.equal(result.artifact.next_node, "critic-review");
    assert.equal(result.state.current_node, "critic-review");
    assert.deepEqual(readSceneValidationArtifact(root, runId, sceneId, 1), result.artifact);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("deterministic blockers route only to bounded span repair with exact codes", () => {
  const draft = artifact("Here is the scene. ```markdown\n# Scene One\nMara waits.\n```");
  const { parent, root, runId } = setup(draft);
  try {
    const result = validateSceneDraft({ root, runId, capsule: capsule(), attempt: 1 });
    const codes = result.artifact.findings.map((finding) => finding.code);
    assert.equal(result.artifact.passed, false);
    assert.equal(result.artifact.next_node, "span-repair");
    assert.equal(result.state.current_node, "span-repair");
    assert.ok(codes.includes("word-count-low"));
    assert.ok(codes.includes("meta-commentary"));
    assert.ok(codes.includes("markdown-fence"));
    assert.ok(codes.includes("prose-heading"));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("draft provenance corruption blocks without advancing execution state", () => {
  const prose = proseWords(160);
  const draft = artifact(prose, { output_hash: "f".repeat(64) });
  const { parent, root, runId } = setup(draft);
  try {
    assert.throws(() => validateSceneDraft({ root, runId, capsule: capsule(), attempt: 1 }), /output hash|provenance|integrity/i);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "deterministic-validation");
    assert.equal(readSceneValidationArtifact(root, runId, sceneId, 1), null);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

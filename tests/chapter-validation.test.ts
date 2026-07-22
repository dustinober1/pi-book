import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptExecutionScene, createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { validateStitchedChapter } from "../src/application/chapter-validation.js";
import type { ChapterStitchArtifact } from "../src/domain/chapter-stitch-artifact.js";
import type { SceneAcceptanceArtifact } from "../src/domain/scene-acceptance-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { writeChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { readChapterValidationArtifact } from "../src/infrastructure/chapter-validation-artifact-store.js";
import { writeSceneAcceptanceArtifact } from "../src/infrastructure/scene-acceptance-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneIds = ["CH-001-SC-01-V1", "CH-001-SC-02-V1"] as const;
const contractHash = "a".repeat(64);
const storyIndexHash = "b".repeat(64);
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function acceptance(sceneId: typeof sceneIds[number], text: string): SceneAcceptanceArtifact {
  const index = sceneIds.indexOf(sceneId);
  const nextScene = sceneIds[index + 1] ?? null;
  return {
    schema_version: "1.0.0", run_id: "RUN-CHAPTER-VALIDATE", chapter: 1, scene_id: sceneId,
    draft_attempt: 1, draft_output_hash: hash(text), draft_capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: contractHash, story_index_hash: storyIndexHash,
    validation_artifact_hash: "c".repeat(64), critic_summary_artifact_hash: "d".repeat(64), state_delta_artifact_hash: "e".repeat(64),
    state_delta_extraction_attempt: 1, accepted_prose: text, word_count: text.trim().split(/\s+/).length,
    accepted_mutations: index === 0
      ? [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "reached the terminal" }]
      : [],
    next_node: nextScene ? "context-build" : "chapter-stitch", next_scene_id: nextScene,
    accepted_at: `2026-07-22T00:00:0${index}.000Z`,
  };
}

function artifactHash(value: unknown): string { return hash(JSON.stringify(value)); }

function setup(options: { firstText?: string; corruptOutputHash?: boolean; corruptAcceptanceHash?: boolean } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-chapter-validation-"));
  const root = initializeProject(parent, { projectName: "Chapter Validation", projectType: "standalone", profile: "thriller" });
  const first = acceptance(sceneIds[0], options.firstText ?? "Mara reached the terminal and tested the dark access panel.");
  const second = acceptance(sceneIds[1], "She copied the access log and sealed the terminal behind her.");
  writeSceneAcceptanceArtifact(root, first);
  writeSceneAcceptanceArtifact(root, second);
  const chapterText = `${first.accepted_prose}\n\n${second.accepted_prose}`;
  const stitch: ChapterStitchArtifact = {
    schema_version: "1.0.0", run_id: first.run_id, chapter: 1, contract_hash: contractHash, story_index_hash: storyIndexHash,
    scene_ids: [...sceneIds],
    scenes: [first, second].map((item, index) => ({
      scene_id: item.scene_id, draft_attempt: 1, draft_output_hash: item.draft_output_hash,
      acceptance_artifact_hash: options.corruptAcceptanceHash && index === 0 ? "f".repeat(64) : artifactHash(item),
      word_count: item.word_count,
    })),
    chapter_text: chapterText,
    word_count: chapterText.trim().split(/\s+/).length,
    output_hash: options.corruptOutputHash ? "f".repeat(64) : hash(chapterText),
    accepted_mutations: [...first.accepted_mutations, ...second.accepted_mutations],
    next_node: "chapter-validate", created_at: "2026-07-22T00:01:00.000Z",
  };
  writeChapterStitchArtifact(root, stitch);
  let state = createChapterExecutionState({ runId: first.run_id, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash, chapter: 1 });
  state = transitionChapterExecution(state, "scene-contract-compile");
  state = transitionChapterExecution(state, "context-build", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "scene-plan", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "scene-draft", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "deterministic-validation", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "critic-review", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "state-delta", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "scene-accept", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "context-build", undefined, sceneIds[0]);
  state = transitionChapterExecution(state, "scene-plan", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "scene-draft", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "deterministic-validation", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "critic-review", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "state-delta", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "scene-accept", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "chapter-stitch", undefined, sceneIds[1]);
  state = transitionChapterExecution(state, "chapter-validate", undefined, sceneIds[1]);
  for (const id of sceneIds) state = acceptExecutionScene(state, id);
  writeChapterExecutionState(root, state);
  return { parent, root, runId: first.run_id };
}

test("an exact clean stitched chapter routes to chapter commit", () => {
  const { parent, root, runId } = setup();
  try {
    const result = validateStitchedChapter({ root, runId, chapter: 1, now: "2026-07-22T00:02:00.000Z" });
    assert.equal(result.artifact.passed, true);
    assert.equal(result.artifact.findings.length, 0);
    assert.equal(result.artifact.next_action, "chapter-commit");
    assert.equal(result.state.current_node, "chapter-commit");
    assert.deepEqual(readChapterValidationArtifact(root, runId, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter-level output hygiene defects produce an artifact and block the checkpoint", () => {
  const { parent, root, runId } = setup({ firstText: "# Scene One\nHere is the chapter. Mara reached the terminal." });
  try {
    const result = validateStitchedChapter({ root, runId, chapter: 1 });
    const codes = result.artifact.findings.map((item) => item.code);
    assert.equal(result.artifact.passed, false);
    assert.equal(result.artifact.next_action, "blocked");
    assert.ok(codes.includes("prose-heading"));
    assert.ok(codes.includes("meta-commentary"));
    assert.equal(result.state.status, "blocked");
    assert.equal(result.state.blocker?.code, "schema-failure");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("stitch or acceptance provenance corruption hard-stops without a validation artifact", () => {
  const stitch = setup({ corruptOutputHash: true });
  try {
    assert.throws(() => validateStitchedChapter({ root: stitch.root, runId: stitch.runId, chapter: 1 }), /output hash|integrity|provenance/i);
    assert.equal(readChapterExecutionState(stitch.root, stitch.runId)?.current_node, "chapter-validate");
    assert.equal(readChapterValidationArtifact(stitch.root, stitch.runId, 1), null);
  } finally { rmSync(stitch.parent, { recursive: true, force: true }); }

  const acceptanceDrift = setup({ corruptAcceptanceHash: true });
  try {
    assert.throws(() => validateStitchedChapter({ root: acceptanceDrift.root, runId: acceptanceDrift.runId, chapter: 1 }), /acceptance artifact hash|provenance/i);
    assert.equal(readChapterExecutionState(acceptanceDrift.root, acceptanceDrift.runId)?.current_node, "chapter-validate");
    assert.equal(readChapterValidationArtifact(acceptanceDrift.root, acceptanceDrift.runId, 1), null);
  } finally { rmSync(acceptanceDrift.parent, { recursive: true, force: true }); }
});

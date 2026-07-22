import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptExecutionScene, createChapterExecutionState } from "../src/application/chapter-execution-machine.js";
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
const chapterContractHash = "a".repeat(64);
const sceneContractHashes = { [sceneIds[0]]: "c".repeat(64), [sceneIds[1]]: "d".repeat(64) };
const storyIndexHash = "b".repeat(64);
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function acceptance(sceneId: typeof sceneIds[number], text: string): SceneAcceptanceArtifact {
  const index = sceneIds.indexOf(sceneId);
  const nextScene = sceneIds[index + 1] ?? null;
  return {
    schema_version: "1.0.0", run_id: "RUN-CHAPTER-VALIDATE", chapter: 1, scene_id: sceneId,
    draft_attempt: 1, draft_output_hash: hash(text), draft_capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: sceneContractHashes[sceneId], story_index_hash: storyIndexHash,
    validation_artifact_hash: "e".repeat(64), critic_summary_artifact_hash: "f".repeat(64), state_delta_artifact_hash: "1".repeat(64),
    state_delta_extraction_attempt: 1, accepted_prose: text, word_count: text.trim().split(/\s+/).length,
    accepted_mutations: index === 0 ? [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "reached the terminal" }] : [],
    accepted_thread_changes: index === 0 ? [{ thread_id: "THREAD-ACCESS", operation: "advanced", description: "The access anomaly advances.", evidence_quote: "dark access panel" }] : [],
    next_node: nextScene ? "context-build" : "chapter-stitch", next_scene_id: nextScene,
    accepted_at: `2026-07-22T00:00:0${index}.000Z`,
  };
}
function artifactHash(value: unknown): string { return hash(JSON.stringify(value)); }

function setup(options: { firstText?: string; corruptOutputHash?: boolean; corruptAcceptanceHash?: boolean; corruptSceneContract?: boolean; corruptThreadChanges?: boolean } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-chapter-validation-"));
  const root = initializeProject(parent, { projectName: "Chapter Validation", projectType: "standalone", profile: "thriller" });
  const first = acceptance(sceneIds[0], options.firstText ?? "Mara reached the terminal and tested the dark access panel.");
  const second = acceptance(sceneIds[1], "She copied the access log and sealed the terminal behind her.");
  writeSceneAcceptanceArtifact(root, first);
  writeSceneAcceptanceArtifact(root, options.corruptSceneContract ? { ...second, contract_hash: "9".repeat(64) } : second);
  const chapterText = `${first.accepted_prose}\n\n${second.accepted_prose}`;
  const stitchedThreadChanges = [...(first.accepted_thread_changes ?? []), ...(second.accepted_thread_changes ?? [])];
  if (options.corruptThreadChanges) stitchedThreadChanges[0] = { ...stitchedThreadChanges[0]!, description: "Injected thread change." };
  const stitch: ChapterStitchArtifact = {
    schema_version: "1.0.0", run_id: first.run_id, chapter: 1, contract_hash: chapterContractHash, story_index_hash: storyIndexHash,
    scene_ids: [...sceneIds],
    scenes: [first, second].map((item, index) => ({
      scene_id: item.scene_id, contract_hash: sceneContractHashes[item.scene_id as typeof sceneIds[number]], draft_attempt: 1,
      draft_output_hash: item.draft_output_hash,
      acceptance_artifact_hash: options.corruptAcceptanceHash && index === 0 ? "8".repeat(64) : artifactHash(index === 1 && options.corruptSceneContract ? { ...item, contract_hash: "9".repeat(64) } : item),
      word_count: item.word_count,
    })),
    chapter_text: chapterText, word_count: chapterText.trim().split(/\s+/).length,
    output_hash: options.corruptOutputHash ? "7".repeat(64) : hash(chapterText),
    accepted_mutations: [...first.accepted_mutations, ...second.accepted_mutations],
    accepted_thread_changes: stitchedThreadChanges,
    next_node: "chapter-validate", created_at: "2026-07-22T00:01:00.000Z",
  };
  writeChapterStitchArtifact(root, stitch);
  let state = createChapterExecutionState({ runId: first.run_id, projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash: sceneContractHashes[sceneIds[1]], chapterContractHash, chapter: 1 });
  state.current_scene_id = sceneIds[1];
  state.current_node = "chapter-validate";
  for (const id of sceneIds) state = acceptExecutionScene(state, id);
  writeChapterExecutionState(root, state);
  return { parent, root, runId: first.run_id };
}

test("an exact clean stitched chapter owned by the chapter contract routes to commit", () => {
  const { parent, root, runId } = setup();
  try {
    const result = validateStitchedChapter({ root, runId, chapter: 1, now: "2026-07-22T00:02:00.000Z" });
    assert.equal(result.artifact.contract_hash, chapterContractHash);
    assert.equal(result.artifact.passed, true);
    assert.equal(result.state.current_node, "chapter-commit");
    assert.deepEqual(readChapterValidationArtifact(root, runId, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter-level output hygiene defects produce an artifact and block the checkpoint", () => {
  const { parent, root, runId } = setup({ firstText: "# Scene One\nHere is the chapter. Mara reached the terminal and tested the dark access panel." });
  try {
    const result = validateStitchedChapter({ root, runId, chapter: 1 });
    const codes = result.artifact.findings.map((item) => item.code);
    assert.equal(result.artifact.passed, false);
    assert.ok(codes.includes("prose-heading"));
    assert.ok(codes.includes("meta-commentary"));
    assert.equal(result.state.status, "blocked");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("stitch, acceptance hash, per-scene contract, or thread-delta corruption hard-stops", () => {
  for (const options of [{ corruptOutputHash: true }, { corruptAcceptanceHash: true }, { corruptSceneContract: true }, { corruptThreadChanges: true }]) {
    const current = setup(options);
    try {
      assert.throws(() => validateStitchedChapter({ root: current.root, runId: current.runId, chapter: 1 }), /output hash|acceptance artifact hash|scene contract|thread.*provenance|provenance|contract/i);
      assert.equal(readChapterExecutionState(current.root, current.runId)?.current_node, "chapter-validate");
      assert.equal(readChapterValidationArtifact(current.root, current.runId, 1), null);
    } finally { rmSync(current.parent, { recursive: true, force: true }); }
  }
});

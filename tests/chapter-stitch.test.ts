import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptExecutionScene, createChapterExecutionState, transitionChapterExecution } from "../src/application/chapter-execution-machine.js";
import { stitchAcceptedChapter } from "../src/application/chapter-stitch.js";
import { projectStateHash } from "../src/application/project-hash.js";
import type { SceneAcceptanceArtifact } from "../src/domain/scene-acceptance-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";
import { writeSceneAcceptanceArtifact } from "../src/infrastructure/scene-acceptance-artifact-store.js";
import { initializeProject } from "../src/project/store.js";

const sceneIds = ["CH-001-SC-01-V1", "CH-001-SC-02-V1"] as const;
const chapterContractHash = "a".repeat(64);
const sceneContractHashes = { [sceneIds[0]]: "c".repeat(64), [sceneIds[1]]: "d".repeat(64) };
const storyIndexHash = "b".repeat(64);
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const prose = { [sceneIds[0]]: "Mara crossed the corridor and reached the first terminal.", [sceneIds[1]]: "Mara copied the final access log and sealed the terminal behind her." };

function acceptance(sceneId: typeof sceneIds[number]): SceneAcceptanceArtifact {
  const index = sceneIds.indexOf(sceneId);
  const nextScene = sceneIds[index + 1] ?? null;
  const acceptedProse = prose[sceneId];
  return {
    schema_version: "1.0.0", run_id: "RUN-STITCH-001", chapter: 1, scene_id: sceneId, draft_attempt: 1,
    draft_output_hash: hash(acceptedProse), draft_capsule_id: "CAP-0123456789ABCDEF",
    contract_hash: sceneContractHashes[sceneId], story_index_hash: storyIndexHash,
    validation_artifact_hash: "e".repeat(64), critic_summary_artifact_hash: "f".repeat(64), state_delta_artifact_hash: "1".repeat(64),
    state_delta_extraction_attempt: 1, accepted_prose: acceptedProse, word_count: acceptedProse.split(/\s+/).length,
    accepted_mutations: index === 0
      ? [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL-1", evidence_quote: "reached the first terminal" }]
      : [{ record_id: "STATE-MARA-LOG", field: "custody", operation: "set", value: "secured", evidence_quote: "copied the final access log" }],
    accepted_thread_changes: [{
      thread_id: "THREAD-ACCESS",
      operation: index === 0 ? "opened" : "advanced",
      description: index === 0 ? "The access anomaly becomes an active thread." : "Mara secures new access evidence.",
      evidence_quote: index === 0 ? "reached the first terminal" : "copied the final access log",
    }],
    next_node: nextScene ? "context-build" : "chapter-stitch", next_scene_id: nextScene,
    accepted_at: `2026-07-22T00:00:0${index}.000Z`,
  };
}

function setup(options: { writeSecond?: boolean; acceptedIds?: string[]; corruptFirstNext?: boolean } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-chapter-stitch-"));
  const root = initializeProject(parent, { projectName: "Chapter Stitch", projectType: "standalone", profile: "thriller" });
  let state = createChapterExecutionState({ runId: "RUN-STITCH-001", projectHash: projectStateHash(root), canonSnapshotHash: storyIndexHash, contractHash: sceneContractHashes[sceneIds[1]], chapterContractHash, chapter: 1 });
  state.current_scene_id = sceneIds[1];
  state.current_node = "chapter-stitch";
  for (const id of options.acceptedIds ?? [...sceneIds]) state = acceptExecutionScene(state, id);
  writeChapterExecutionState(root, state);
  const first = acceptance(sceneIds[0]);
  writeSceneAcceptanceArtifact(root, options.corruptFirstNext ? { ...first, next_scene_id: null, next_node: "chapter-stitch" } : first);
  if (options.writeSecond !== false) writeSceneAcceptanceArtifact(root, acceptance(sceneIds[1]));
  return { parent, root, runId: state.run_id };
}

const stitchInput = (root: string, runId: string) => ({ root, runId, chapterSceneIds: [...sceneIds], sceneContractHashes, draftAttempts: { [sceneIds[0]]: 1, [sceneIds[1]]: 1 } });

test("ordered distinct scene contracts stitch state and thread deltas into the chapter contract", () => {
  const { parent, root, runId } = setup();
  try {
    const result = stitchAcceptedChapter({ ...stitchInput(root, runId), now: "2026-07-22T00:01:00.000Z" });
    assert.equal(result.artifact.contract_hash, chapterContractHash);
    assert.equal(result.artifact.chapter_text, `${prose[sceneIds[0]]}\n\n${prose[sceneIds[1]]}`);
    assert.deepEqual(result.artifact.scenes.map((item) => item.contract_hash), [sceneContractHashes[sceneIds[0]], sceneContractHashes[sceneIds[1]]]);
    assert.equal(result.artifact.accepted_mutations.length, 2);
    assert.deepEqual(result.artifact.accepted_thread_changes?.map((item) => item.operation), ["opened", "advanced"]);
    assert.equal(result.state.current_node, "chapter-validate");
    assert.deepEqual(readChapterStitchArtifact(root, runId, 1), result.artifact);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing scenes, contract drift, order drift, or inconsistent next pointers block stitching", () => {
  const missing = setup({ writeSecond: false });
  try { assert.throws(() => stitchAcceptedChapter(stitchInput(missing.root, missing.runId)), /acceptance artifact.*CH-001-SC-02|missing/i); }
  finally { rmSync(missing.parent, { recursive: true, force: true }); }

  const order = setup({ acceptedIds: [sceneIds[1], sceneIds[0]] });
  try { assert.throws(() => stitchAcceptedChapter(stitchInput(order.root, order.runId)), /accepted scene order|scene order/i); }
  finally { rmSync(order.parent, { recursive: true, force: true }); }

  const pointer = setup({ corruptFirstNext: true });
  try { assert.throws(() => stitchAcceptedChapter(stitchInput(pointer.root, pointer.runId)), /next scene|routing provenance|CH-001-SC-02/i); }
  finally { rmSync(pointer.parent, { recursive: true, force: true }); }

  const drift = setup();
  try {
    const second = acceptance(sceneIds[1]);
    writeSceneAcceptanceArtifact(drift.root, { ...second, contract_hash: "9".repeat(64) });
    assert.throws(() => stitchAcceptedChapter(stitchInput(drift.root, drift.runId)), /contract.*CH-001-SC-02|provenance/i);
  } finally { rmSync(drift.parent, { recursive: true, force: true }); }
});

test("duplicate scene IDs and missing draft attempts reject before artifact reads", () => {
  const { parent, root, runId } = setup();
  try {
    assert.throws(() => stitchAcceptedChapter({ root, runId, chapterSceneIds: [sceneIds[0], sceneIds[0]], sceneContractHashes, draftAttempts: { [sceneIds[0]]: 1 } }), /duplicate|duplicates/i);
    assert.throws(() => stitchAcceptedChapter({ root, runId, chapterSceneIds: [...sceneIds], sceneContractHashes, draftAttempts: { [sceneIds[0]]: 1 } }), /draft attempt.*CH-001-SC-02/i);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "chapter-stitch");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

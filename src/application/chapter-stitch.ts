import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import { ChapterStitchArtifactSchema, type ChapterStitchArtifact, type ChapterStitchScene } from "../domain/chapter-stitch-artifact.js";
import type { SceneAcceptanceArtifact } from "../domain/scene-acceptance-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readChapterStitchArtifact, writeChapterStitchArtifact } from "../infrastructure/chapter-stitch-artifact-store.js";
import { readSceneAcceptanceArtifact } from "../infrastructure/scene-acceptance-artifact-store.js";
import { chapterContractHash, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface StitchAcceptedChapterInput {
  root: string;
  runId: string;
  chapterSceneIds: string[];
  sceneContractHashes?: Record<string, string>;
  draftAttempts: Record<string, number>;
  now?: string;
}
export interface StitchAcceptedChapterResult { artifact: ChapterStitchArtifact; artifactPath: string; state: ChapterExecutionState; }

function hashText(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function artifactHash(value: unknown): string { return hashText(JSON.stringify(value)); }
function timestamp(value?: string): string { return value ?? new Date().toISOString(); }
function countWords(value: string): number { return value.trim().split(/\s+/).filter(Boolean).length; }

function requireState(input: StitchAcceptedChapterInput): ChapterExecutionState {
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "chapter-stitch") throw new Error(`Chapter stitching requires chapter-stitch, current node is ${state.current_node}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot stitch chapter because the project hash changed.");
  return state;
}

function validateSceneOrder(input: StitchAcceptedChapterInput, state: ChapterExecutionState): void {
  if (!input.chapterSceneIds.length) throw new Error("Chapter stitching requires at least one scene ID.");
  if (input.chapterSceneIds.length > 5) throw new Error("Chapter stitching supports at most five scene IDs.");
  const seen = new Set<string>();
  for (const sceneId of input.chapterSceneIds) {
    if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error(`Invalid chapter scene ID: ${sceneId}.`);
    if (seen.has(sceneId)) throw new Error(`Chapter scene list duplicates ${sceneId}.`);
    seen.add(sceneId);
    const attempt = input.draftAttempts[sceneId];
    if (!Number.isInteger(attempt) || Number(attempt) < 1) throw new Error(`Missing or invalid draft attempt for ${sceneId}.`);
    const sceneHash = input.sceneContractHashes?.[sceneId];
    if (input.sceneContractHashes && !/^[a-f0-9]{64}$/.test(sceneHash ?? "")) throw new Error(`Missing or invalid scene contract hash for ${sceneId}.`);
  }
  if (state.accepted_scene_ids.length !== input.chapterSceneIds.length || input.chapterSceneIds.some((sceneId, index) => state.accepted_scene_ids[index] !== sceneId)) throw new Error(`Accepted scene order does not match chapter scene order. Expected ${input.chapterSceneIds.join(", ")}; found ${state.accepted_scene_ids.join(", ")}.`);
  if (state.current_scene_id !== input.chapterSceneIds.at(-1)) throw new Error(`Chapter stitch checkpoint must remain on final scene ${input.chapterSceneIds.at(-1)}.`);
}

function requireAcceptance(input: StitchAcceptedChapterInput, state: ChapterExecutionState, sceneId: string, index: number): SceneAcceptanceArtifact {
  const attempt = Number(input.draftAttempts[sceneId]);
  const acceptance = readSceneAcceptanceArtifact(input.root, input.runId, sceneId, attempt);
  if (!acceptance) throw new Error(`Missing scene acceptance artifact for ${sceneId} draft attempt ${attempt}.`);
  const expectedContractHash = input.sceneContractHashes?.[sceneId] ?? (input.chapterSceneIds.length === 1 ? state.contract_hash : null);
  if (acceptance.run_id !== input.runId || acceptance.chapter !== state.chapter || acceptance.scene_id !== sceneId || acceptance.draft_attempt !== attempt || (expectedContractHash !== null && acceptance.contract_hash !== expectedContractHash) || acceptance.story_index_hash !== state.canon_snapshot_hash) throw new Error(`Scene acceptance artifact provenance or contract hash does not match chapter stitch for ${sceneId}.`);
  if (hashText(acceptance.accepted_prose) !== acceptance.draft_output_hash) throw new Error(`Scene acceptance prose hash does not match for ${sceneId}.`);
  if (acceptance.word_count !== countWords(acceptance.accepted_prose)) throw new Error(`Scene acceptance word count does not match for ${sceneId}.`);
  const expectedNext = input.chapterSceneIds[index + 1] ?? null;
  const expectedNode = expectedNext ? "context-build" : "chapter-stitch";
  if (acceptance.next_scene_id !== expectedNext || acceptance.next_node !== expectedNode) throw new Error(`Scene acceptance routing provenance for ${sceneId} must point to ${expectedNext ?? "chapter-stitch"}.`);
  return acceptance;
}

export function stitchAcceptedChapter(input: StitchAcceptedChapterInput): StitchAcceptedChapterResult {
  const state = requireState(input);
  validateSceneOrder(input, state);
  if (readChapterStitchArtifact(input.root, input.runId, state.chapter)) throw new Error(`Chapter stitch artifact already exists for chapter ${state.chapter}.`);
  const acceptances = input.chapterSceneIds.map((sceneId, index) => requireAcceptance(input, state, sceneId, index));
  const chapterText = acceptances.map((item) => item.accepted_prose).join("\n\n");
  const scenes: ChapterStitchScene[] = acceptances.map((item) => ({ scene_id: item.scene_id, contract_hash: item.contract_hash, draft_attempt: item.draft_attempt, draft_output_hash: item.draft_output_hash, acceptance_artifact_hash: artifactHash(item), word_count: item.word_count }));
  const artifact: ChapterStitchArtifact = {
    schema_version: "1.0.0", run_id: input.runId, chapter: state.chapter,
    contract_hash: chapterContractHash(state), story_index_hash: state.canon_snapshot_hash,
    scene_ids: [...input.chapterSceneIds], scenes, chapter_text: chapterText,
    word_count: countWords(chapterText), output_hash: hashText(chapterText),
    accepted_mutations: acceptances.flatMap((item) => item.accepted_mutations),
    accepted_thread_changes: acceptances.flatMap((item) => item.accepted_thread_changes ?? []),
    next_node: "chapter-validate", created_at: timestamp(input.now),
  };
  if (!Value.Check(ChapterStitchArtifactSchema, artifact)) throw new Error("Chapter stitch artifact failed schema validation.");
  const artifactPath = writeChapterStitchArtifact(input.root, artifact);
  const advanced = transitionChapterExecution(state, "chapter-validate", input.now, state.current_scene_id ?? undefined);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced };
}

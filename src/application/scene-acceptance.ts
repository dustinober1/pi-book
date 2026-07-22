import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import { SceneAcceptanceArtifactSchema, type SceneAcceptanceArtifact } from "../domain/scene-acceptance-artifact.js";
import type { SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneAcceptanceArtifact, writeSceneAcceptanceArtifact } from "../infrastructure/scene-acceptance-artifact-store.js";
import { readSceneCriticSummaryArtifact } from "../infrastructure/scene-critic-summary-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { readSceneStateDeltaArtifact } from "../infrastructure/scene-state-delta-artifact-store.js";
import { readSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { acceptExecutionScene, chapterContractHash, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface AcceptSceneCandidateInput {
  root: string;
  runId: string;
  sceneId: string;
  draftAttempt: number;
  stateDeltaExtractionAttempt: number;
  chapterSceneIds: string[];
  chapterSceneContractHashes?: Record<string, string>;
  now?: string;
}
export interface AcceptSceneCandidateResult { artifact: SceneAcceptanceArtifact; artifactPath: string; state: ChapterExecutionState; }

function hashText(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function artifactHash(value: unknown): string { return hashText(JSON.stringify(value)); }
function timestamp(value?: string): string { return value ?? new Date().toISOString(); }
function countWords(value: string): number { return value.trim().split(/\s+/).filter(Boolean).length; }

function orderedSceneIndex(input: AcceptSceneCandidateInput, state: ChapterExecutionState): number {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(input.sceneId)) throw new Error("Invalid scene ID for scene acceptance.");
  if (!Number.isInteger(input.draftAttempt) || input.draftAttempt < 1) throw new Error("Scene acceptance requires a positive draft attempt.");
  if (!Number.isInteger(input.stateDeltaExtractionAttempt) || input.stateDeltaExtractionAttempt < 1) throw new Error("Scene acceptance requires a positive state-delta extraction attempt.");
  if (!input.chapterSceneIds.length) throw new Error("Scene acceptance requires ordered chapter scene IDs.");
  const seen = new Set<string>();
  for (const sceneId of input.chapterSceneIds) {
    if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error(`Invalid chapter scene ID: ${sceneId}.`);
    if (seen.has(sceneId)) throw new Error(`Chapter scene order duplicates ${sceneId}.`);
    seen.add(sceneId);
    const suppliedHash = input.chapterSceneContractHashes?.[sceneId];
    if (input.chapterSceneContractHashes && !/^[a-f0-9]{64}$/.test(suppliedHash ?? "")) throw new Error(`Chapter scene contract hash is missing or invalid for ${sceneId}.`);
  }
  const index = input.chapterSceneIds.indexOf(input.sceneId);
  if (index < 0) throw new Error(`Scene ${input.sceneId} is not in the ordered chapter scene list.`);
  const expectedAccepted = input.chapterSceneIds.slice(0, index);
  if (state.accepted_scene_ids.length !== expectedAccepted.length || expectedAccepted.some((sceneId, position) => state.accepted_scene_ids[position] !== sceneId)) {
    const missing = expectedAccepted.filter((sceneId) => !state.accepted_scene_ids.includes(sceneId));
    throw new Error(`Cannot accept ${input.sceneId} out of order. Previous scene acceptance required: ${missing.join(", ") || expectedAccepted.join(", ") || "none"}.`);
  }
  if (state.accepted_scene_ids.includes(input.sceneId)) throw new Error(`Scene ${input.sceneId} is already accepted.`);
  return index;
}

function requireState(input: AcceptSceneCandidateInput): ChapterExecutionState {
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "scene-accept") throw new Error(`Scene acceptance requires scene-accept, current node is ${state.current_node}.`);
  if (state.current_scene_id !== input.sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match ${input.sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot accept scene because the project hash changed.");
  const expectedHash = input.chapterSceneContractHashes?.[input.sceneId];
  if (expectedHash && state.contract_hash !== expectedHash) throw new Error(`Active scene contract hash does not match ${input.sceneId}.`);
  return state;
}

function requireDraft(input: AcceptSceneCandidateInput, state: ChapterExecutionState): SceneDraftArtifact {
  const draft = readSceneDraftArtifact(input.root, input.runId, input.sceneId, input.draftAttempt);
  if (!draft) throw new Error(`Scene draft artifact not found for ${input.sceneId} attempt ${input.draftAttempt}.`);
  if (draft.run_id !== input.runId || draft.chapter !== state.chapter || draft.scene_id !== input.sceneId || draft.contract_hash !== state.contract_hash || draft.story_index_hash !== state.canon_snapshot_hash || draft.attempt !== input.draftAttempt) throw new Error("Scene acceptance draft provenance does not match the execution checkpoint.");
  if (hashText(draft.prose) !== draft.output_hash || draft.usage.outputHash !== draft.output_hash) throw new Error("Scene acceptance draft output integrity check failed.");
  if (draft.word_count !== countWords(draft.prose)) throw new Error("Scene acceptance draft word-count integrity check failed.");
  return draft;
}

export function acceptSceneCandidate(input: AcceptSceneCandidateInput): AcceptSceneCandidateResult {
  const state = requireState(input);
  const sceneIndex = orderedSceneIndex(input, state);
  const draft = requireDraft(input, state);
  const validation = readSceneValidationArtifact(input.root, input.runId, input.sceneId, input.draftAttempt);
  if (!validation || !validation.passed || validation.next_node !== "critic-review" || validation.draft_output_hash !== draft.output_hash || validation.contract_hash !== draft.contract_hash) throw new Error("Scene acceptance requires a passed deterministic validation artifact for the same draft.");
  const criticSummary = readSceneCriticSummaryArtifact(input.root, input.runId, input.sceneId, input.draftAttempt);
  if (!criticSummary || !criticSummary.passed || criticSummary.next_action !== "state-delta" || criticSummary.draft_output_hash !== draft.output_hash || criticSummary.contract_hash !== draft.contract_hash) throw new Error("Scene acceptance requires a passed critic summary for the same draft.");
  const stateDelta = readSceneStateDeltaArtifact(input.root, input.runId, input.sceneId, input.draftAttempt, input.stateDeltaExtractionAttempt);
  if (!stateDelta || !stateDelta.matches_expected || stateDelta.next_action !== "scene-accept" || stateDelta.draft_output_hash !== draft.output_hash || stateDelta.contract_hash !== draft.contract_hash) throw new Error("Scene acceptance requires a matching state delta that is ready for scene-accept.");
  if (readSceneAcceptanceArtifact(input.root, input.runId, input.sceneId, input.draftAttempt)) throw new Error(`Scene acceptance artifact already exists for ${input.sceneId} attempt ${input.draftAttempt}.`);

  const nextSceneId = input.chapterSceneIds[sceneIndex + 1] ?? null;
  const nextNode = nextSceneId ? "context-build" : "chapter-stitch";
  const nextContractHash = nextSceneId ? input.chapterSceneContractHashes?.[nextSceneId] : null;
  if (nextSceneId && input.chapterSceneContractHashes && !nextContractHash) throw new Error(`Next scene contract hash is missing for ${nextSceneId}.`);
  const artifact: SceneAcceptanceArtifact = {
    schema_version: "1.0.0", run_id: input.runId, chapter: state.chapter, scene_id: input.sceneId,
    draft_attempt: input.draftAttempt, draft_output_hash: draft.output_hash, draft_capsule_id: draft.capsule_id,
    contract_hash: draft.contract_hash, story_index_hash: draft.story_index_hash,
    validation_artifact_hash: artifactHash(validation), critic_summary_artifact_hash: artifactHash(criticSummary),
    state_delta_artifact_hash: artifactHash(stateDelta), state_delta_extraction_attempt: input.stateDeltaExtractionAttempt,
    accepted_prose: draft.prose, word_count: draft.word_count, accepted_mutations: stateDelta.actual_mutations,
    next_node: nextNode, next_scene_id: nextSceneId, accepted_at: timestamp(input.now),
  };
  if (!Value.Check(SceneAcceptanceArtifactSchema, artifact)) throw new Error("Scene acceptance artifact failed schema validation.");
  const artifactPath = writeSceneAcceptanceArtifact(input.root, artifact);
  const accepted = acceptExecutionScene(state, input.sceneId, input.now);
  const transitioned = transitionChapterExecution(accepted, nextNode, input.now, input.sceneId);
  const advanced: ChapterExecutionState = nextSceneId
    ? { ...transitioned, current_scene_id: nextSceneId, contract_hash: nextContractHash ?? transitioned.contract_hash, updated_at: timestamp(input.now) }
    : { ...transitioned, contract_hash: chapterContractHash(state), updated_at: timestamp(input.now) };
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced };
}

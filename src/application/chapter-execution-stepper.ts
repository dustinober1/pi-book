import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { QualityThinkingLevel, QualityWorker } from "../domain/quality-worker.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { prepareChapterExecution } from "./chapter-execution-preparation.js";
import { transitionChapterExecution } from "./chapter-execution-machine.js";
import { buildExecutionContextCapsule } from "./execution-context-capsule.js";
import { runScenePlanJob } from "./scene-plan-runner.js";
import { runSceneDraftJob } from "./scene-draft-runner.js";
import { validateSceneDraft } from "./deterministic-scene-validator.js";

export type ChapterExecutionStepAction =
  | "prepared"
  | "chapter-contract-compiled"
  | "scene-contracts-compiled"
  | "context-built"
  | "scene-planned"
  | "scene-drafted"
  | "scene-validated"
  | "awaiting-critic-review"
  | "stopped"
  | "complete";

export interface AdvanceChapterExecutionStepInput {
  root: string;
  chapter: number;
  runId: string;
  worker: QualityWorker;
  runtimeProfile?: RuntimeProfileId;
  customModelProfile?: ModelExecutionProfile;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  signal?: AbortSignal;
  now?: string;
}

export interface AdvanceChapterExecutionStepResult {
  action: ChapterExecutionStepAction;
  state: ChapterExecutionState;
  artifact?: unknown;
  cacheHit?: boolean;
  cacheKey?: string;
}

function sceneId(state: ChapterExecutionState): string {
  if (!state.current_scene_id) throw new Error(`Chapter execution node ${state.current_node} requires an active scene.`);
  return state.current_scene_id;
}

function writeTransition(root: string, state: ChapterExecutionState, next: Parameters<typeof transitionChapterExecution>[1], now?: string): ChapterExecutionState {
  const advanced = transitionChapterExecution(state, next, now, state.current_scene_id ?? undefined);
  writeChapterExecutionState(root, advanced);
  return advanced;
}

function latestInitialDraftAttempt(state: ChapterExecutionState): number {
  const currentScene = sceneId(state);
  const attempt = state.attempts[`${currentScene}:scene-draft`] ?? 0;
  if (attempt < 1) throw new Error(`No successful scene draft attempt is recorded for ${currentScene}.`);
  return attempt;
}

export async function advanceChapterExecutionStep(input: AdvanceChapterExecutionStepInput): Promise<AdvanceChapterExecutionStepResult> {
  const prepared = prepareChapterExecution({ root: input.root, chapter: input.chapter, runId: input.runId, ...(input.now ? { now: input.now } : {}) });
  if (!prepared.alreadyPrepared) return { action: "prepared", state: prepared.state };
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state disappeared for ${input.runId}.`);
  if (state.status !== "active") return { action: state.status === "completed" ? "complete" : "stopped", state };

  if (state.current_node === "contract-compile") {
    return { action: "chapter-contract-compiled", state: writeTransition(input.root, state, "scene-contract-compile", input.now) };
  }
  if (state.current_node === "scene-contract-compile") {
    return { action: "scene-contracts-compiled", state: writeTransition(input.root, state, "context-build", input.now) };
  }
  if (state.current_node === "context-build") {
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: sceneId(state),
      jobType: "plan-scene",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    return {
      action: "context-built",
      state: writeTransition(input.root, state, "scene-plan", input.now),
      artifact: built.capsule,
      cacheHit: built.cacheHit,
      cacheKey: built.cacheKey,
    };
  }
  if (state.current_node === "scene-plan") {
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: sceneId(state),
      jobType: "plan-scene",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = await runScenePlanJob({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      runtimeProfile: input.runtimeProfile ?? prepared.manifest.runtime_profile,
      worker: input.worker,
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.thinking ? { thinking: input.thinking } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "scene-planned", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
  }
  if (state.current_node === "scene-draft") {
    const currentScene = sceneId(state);
    const planAttempt = state.attempts[`${currentScene}:scene-plan`] ?? 0;
    if (planAttempt < 1) throw new Error(`Scene draft requires a completed plan attempt for ${currentScene}.`);
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: currentScene,
      jobType: "draft-scene",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = await runSceneDraftJob({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      planAttempt,
      runtimeProfile: input.runtimeProfile ?? prepared.manifest.runtime_profile,
      worker: input.worker,
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.thinking ? { thinking: input.thinking } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "scene-drafted", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
  }
  if (state.current_node === "deterministic-validation") {
    const currentScene = sceneId(state);
    const draftAttempt = latestInitialDraftAttempt(state);
    if (!readSceneDraftArtifact(input.root, input.runId, currentScene, draftAttempt)) {
      throw new Error(`Recorded scene draft artifact is missing for ${currentScene} attempt ${draftAttempt}.`);
    }
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: currentScene,
      jobType: "draft-scene",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = validateSceneDraft({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      attempt: draftAttempt,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "scene-validated", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
  }
  if (state.current_node === "critic-review") return { action: "awaiting-critic-review", state };
  if (state.current_node === "complete") return { action: "complete", state };
  return { action: "stopped", state };
}

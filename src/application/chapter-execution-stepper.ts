import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { QualityThinkingLevel, QualityWorker } from "../domain/quality-worker.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import {
  isSceneCriticJobType,
  type SceneCriticJobType,
} from "../domain/scene-critic-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneCriticArtifact } from "../infrastructure/scene-critic-artifact-store.js";
import { readSceneCriticSummaryArtifact } from "../infrastructure/scene-critic-summary-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { acceptSceneCandidate } from "./scene-acceptance.js";
import {
  acceptedSceneDraftAttempt,
  latestSceneDraftAttempt,
} from "./scene-artifact-discovery.js";
import { commitValidatedChapter } from "./chapter-commit.js";
import { transitionChapterExecution } from "./chapter-execution-machine.js";
import { prepareChapterExecution } from "./chapter-execution-preparation.js";
import { stitchAcceptedChapter } from "./chapter-stitch.js";
import { validateStitchedChapter } from "./chapter-validation.js";
import { validateSceneDraft } from "./deterministic-scene-validator.js";
import { buildExecutionContextCapsule } from "./execution-context-capsule.js";
import { finalizeSceneCriticReview } from "./scene-critic-aggregation.js";
import { runSceneCriticJob } from "./scene-critic-runner.js";
import { runSceneDraftJob } from "./scene-draft-runner.js";
import { runScenePlanJob } from "./scene-plan-runner.js";
import { runSceneSpanRepair } from "./scene-span-repair-runner.js";
import { runSceneStateDeltaExtraction } from "./scene-state-delta-runner.js";

export type ChapterExecutionStepAction =
  | "prepared"
  | "chapter-contract-compiled"
  | "scene-contracts-compiled"
  | "context-built"
  | "scene-planned"
  | "scene-drafted"
  | "scene-validated"
  | "critic-completed"
  | "critic-review-finalized"
  | "scene-repaired"
  | "state-delta-extracted"
  | "scene-accepted"
  | "chapter-stitched"
  | "chapter-validated"
  | "chapter-committed"
  | "awaiting-critic-review"
  | "stopped"
  | "complete";

export interface AdvanceChapterExecutionStepInput {
  root: string;
  chapter: number;
  runId: string;
  worker: QualityWorker;
  requiredCriticJobTypes?: readonly SceneCriticJobType[];
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

function writeTransition(
  root: string,
  state: ChapterExecutionState,
  next: Parameters<typeof transitionChapterExecution>[1],
  now?: string,
): ChapterExecutionState {
  const advanced = transitionChapterExecution(state, next, now, state.current_scene_id ?? undefined);
  writeChapterExecutionState(root, advanced);
  return advanced;
}

function currentDraft(root: string, runId: string, state: ChapterExecutionState) {
  const currentScene = sceneId(state);
  const attempt = latestSceneDraftAttempt(root, runId, currentScene);
  if (attempt === null) throw new Error(`No scene draft artifact is available for ${currentScene}.`);
  const artifact = readSceneDraftArtifact(root, runId, currentScene, attempt);
  if (!artifact) throw new Error(`Latest scene draft artifact disappeared for ${currentScene} attempt ${attempt}.`);
  return { attempt, artifact };
}

function criticJobs(values: readonly SceneCriticJobType[] | undefined): SceneCriticJobType[] | null {
  if (values === undefined) return null;
  const result: SceneCriticJobType[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!isSceneCriticJobType(value)) throw new Error(`Invalid required scene critic job: ${String(value)}.`);
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  if (!result.length) throw new Error("At least one required scene critic job must be supplied.");
  return result;
}

function matchingCriticAttempt(
  root: string,
  runId: string,
  state: ChapterExecutionState,
  jobType: SceneCriticJobType,
  draftAttempt: number,
): number | null {
  const currentScene = sceneId(state);
  const attempt = state.attempts[`${currentScene}:${jobType}`] ?? 0;
  if (attempt < 1) return null;
  const artifact = readSceneCriticArtifact(root, runId, currentScene, jobType, attempt);
  if (!artifact || artifact.draft_attempt !== draftAttempt) return null;
  return attempt;
}

function sceneContractHashes(manifest: ReturnType<typeof prepareChapterExecution>["manifest"]): Record<string, string> {
  return Object.fromEntries(manifest.scenes.map((scene) => [scene.scene_id, scene.contract_hash]));
}

export async function advanceChapterExecutionStep(
  input: AdvanceChapterExecutionStepInput,
): Promise<AdvanceChapterExecutionStepResult> {
  const prepared = prepareChapterExecution({
    root: input.root,
    chapter: input.chapter,
    runId: input.runId,
    ...(input.now ? { now: input.now } : {}),
  });
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
    const draft = currentDraft(input.root, input.runId, state);
    const validationJobType = draft.artifact.job_type === "patch-spans" ? "patch-spans" : "draft-scene";
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: currentScene,
      jobType: validationJobType,
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = validateSceneDraft({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      attempt: draft.attempt,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "scene-validated", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
  }
  if (state.current_node === "critic-review") {
    const requiredJobs = criticJobs(input.requiredCriticJobTypes);
    if (!requiredJobs) return { action: "awaiting-critic-review", state };
    const draft = currentDraft(input.root, input.runId, state);
    const attempts: Partial<Record<SceneCriticJobType, number>> = {};
    for (const jobType of requiredJobs) {
      const attempt = matchingCriticAttempt(input.root, input.runId, state, jobType, draft.attempt);
      if (attempt === null) {
        const built = buildExecutionContextCapsule({
          root: input.root,
          manifest: prepared.manifest,
          sceneId: sceneId(state),
          jobType,
          ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
        });
        const result = await runSceneCriticJob({
          root: input.root,
          runId: input.runId,
          capsule: built.capsule,
          draftAttempt: draft.attempt,
          runtimeProfile: input.runtimeProfile ?? prepared.manifest.runtime_profile,
          worker: input.worker,
          ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.thinking ? { thinking: input.thinking } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
          ...(input.now ? { now: input.now } : {}),
        });
        return { action: "critic-completed", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
      }
      attempts[jobType] = attempt;
    }
    const result = finalizeSceneCriticReview({
      root: input.root,
      runId: input.runId,
      sceneId: sceneId(state),
      draftAttempt: draft.attempt,
      requiredJobTypes: requiredJobs,
      criticAttempts: attempts,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "critic-review-finalized", state: result.state, artifact: result.artifact };
  }
  if (state.current_node === "span-repair") {
    const currentScene = sceneId(state);
    const draft = currentDraft(input.root, input.runId, state);
    const summary = readSceneCriticSummaryArtifact(input.root, input.runId, currentScene, draft.attempt);
    const repairCritics: Partial<Record<SceneCriticJobType, number>> = {};
    for (const critic of summary?.critics ?? []) {
      if (critic.verdict === "repair") repairCritics[critic.job_type] = critic.critic_attempt;
    }
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: currentScene,
      jobType: "patch-spans",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = await runSceneSpanRepair({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      sourceDraftAttempt: draft.attempt,
      runtimeProfile: input.runtimeProfile ?? prepared.manifest.runtime_profile,
      worker: input.worker,
      ...(Object.keys(repairCritics).length ? { criticAttempts: repairCritics } : {}),
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.thinking ? { thinking: input.thinking } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
    return {
      action: "scene-repaired",
      state: result.state,
      artifact: { patch: result.patch, repairedDraft: result.repairedDraft },
      cacheHit: built.cacheHit,
      cacheKey: built.cacheKey,
    };
  }
  if (state.current_node === "state-delta") {
    const draft = currentDraft(input.root, input.runId, state);
    const built = buildExecutionContextCapsule({
      root: input.root,
      manifest: prepared.manifest,
      sceneId: sceneId(state),
      jobType: "extract-state-delta",
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
    });
    const result = await runSceneStateDeltaExtraction({
      root: input.root,
      runId: input.runId,
      capsule: built.capsule,
      draftAttempt: draft.attempt,
      runtimeProfile: input.runtimeProfile ?? prepared.manifest.runtime_profile,
      worker: input.worker,
      ...(input.customModelProfile ? { customModelProfile: input.customModelProfile } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.thinking ? { thinking: input.thinking } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "state-delta-extracted", state: result.state, artifact: result.artifact, cacheHit: built.cacheHit, cacheKey: built.cacheKey };
  }
  if (state.current_node === "scene-accept") {
    const currentScene = sceneId(state);
    const draft = currentDraft(input.root, input.runId, state);
    const extractionAttempt = state.attempts[`${currentScene}:state-delta`] ?? 0;
    if (extractionAttempt < 1) throw new Error(`Scene acceptance requires a completed state-delta attempt for ${currentScene}.`);
    const result = acceptSceneCandidate({
      root: input.root,
      runId: input.runId,
      sceneId: currentScene,
      draftAttempt: draft.attempt,
      stateDeltaExtractionAttempt: extractionAttempt,
      chapterSceneIds: prepared.manifest.scenes.map((scene) => scene.scene_id),
      chapterSceneContractHashes: sceneContractHashes(prepared.manifest),
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "scene-accepted", state: result.state, artifact: result.artifact };
  }
  if (state.current_node === "chapter-stitch") {
    const draftAttempts: Record<string, number> = {};
    for (const scene of prepared.manifest.scenes) {
      const attempt = acceptedSceneDraftAttempt(input.root, input.runId, scene.scene_id);
      if (attempt === null) throw new Error(`Accepted scene draft attempt is missing for ${scene.scene_id}.`);
      draftAttempts[scene.scene_id] = attempt;
    }
    const result = stitchAcceptedChapter({
      root: input.root,
      runId: input.runId,
      chapterSceneIds: prepared.manifest.scenes.map((scene) => scene.scene_id),
      sceneContractHashes: sceneContractHashes(prepared.manifest),
      draftAttempts,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "chapter-stitched", state: result.state, artifact: result.artifact };
  }
  if (state.current_node === "chapter-validate") {
    const result = validateStitchedChapter({
      root: input.root,
      runId: input.runId,
      chapter: input.chapter,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "chapter-validated", state: result.state, artifact: result.artifact };
  }
  if (state.current_node === "chapter-commit") {
    const result = commitValidatedChapter({
      root: input.root,
      runId: input.runId,
      chapter: input.chapter,
      ...(input.now ? { now: input.now } : {}),
    });
    return { action: "chapter-committed", state: result.state, artifact: result.artifact };
  }
  if (state.current_node === "complete") return { action: "complete", state };
  return { action: "stopped", state };
}

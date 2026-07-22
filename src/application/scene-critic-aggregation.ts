import { Value } from "@sinclair/typebox/value";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import {
  SceneCriticSummaryArtifactSchema,
  isSceneCriticJobType,
  type SceneCriticArtifact,
  type SceneCriticJobType,
  type SceneCriticSummaryArtifact,
} from "../domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneCriticArtifact } from "../infrastructure/scene-critic-artifact-store.js";
import { writeSceneCriticSummaryArtifact } from "../infrastructure/scene-critic-summary-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { readSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { blockChapterExecution, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface FinalizeSceneCriticReviewInput {
  root: string;
  runId: string;
  sceneId: string;
  draftAttempt: number;
  requiredJobTypes: SceneCriticJobType[];
  criticAttempts: Partial<Record<SceneCriticJobType, number>>;
  now?: string;
}

export interface FinalizeSceneCriticReviewResult {
  artifact: SceneCriticSummaryArtifact;
  artifactPath: string;
  state: ChapterExecutionState;
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function uniqueJobs(values: readonly SceneCriticJobType[]): SceneCriticJobType[] {
  const result: SceneCriticJobType[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!isSceneCriticJobType(value)) throw new Error(`Invalid required scene critic job: ${String(value)}.`);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  if (!result.length) throw new Error("Scene critic aggregation requires at least one critic job.");
  return result;
}

function requireState(input: FinalizeSceneCriticReviewInput): ChapterExecutionState {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(input.sceneId)) throw new Error("Invalid scene ID for critic aggregation.");
  if (!Number.isInteger(input.draftAttempt) || input.draftAttempt < 1) throw new Error("Critic aggregation requires a positive draft attempt.");
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "critic-review") throw new Error(`Critic aggregation requires critic-review, current node is ${state.current_node}.`);
  if (state.current_scene_id !== input.sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match ${input.sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot aggregate scene critics because the project hash changed.");
  return state;
}

function requireDraft(input: FinalizeSceneCriticReviewInput, state: ChapterExecutionState): SceneDraftArtifact {
  const draft = readSceneDraftArtifact(input.root, input.runId, input.sceneId, input.draftAttempt);
  if (!draft) throw new Error(`Scene draft artifact not found for ${input.sceneId} attempt ${input.draftAttempt}.`);
  if (draft.chapter !== state.chapter
    || draft.contract_hash !== state.contract_hash
    || draft.story_index_hash !== state.canon_snapshot_hash) {
    throw new Error("Scene critic aggregation draft provenance does not match the execution checkpoint.");
  }
  const validation = readSceneValidationArtifact(input.root, input.runId, input.sceneId, input.draftAttempt);
  if (!validation || !validation.passed || validation.draft_output_hash !== draft.output_hash) {
    throw new Error("Scene critic aggregation requires passed deterministic validation for the same draft.");
  }
  return draft;
}

function requireCritics(
  input: FinalizeSceneCriticReviewInput,
  draft: SceneDraftArtifact,
  requiredJobs: SceneCriticJobType[],
): SceneCriticArtifact[] {
  return requiredJobs.map((jobType) => {
    const attempt = input.criticAttempts[jobType];
    if (!Number.isInteger(attempt) || Number(attempt) < 1) {
      throw new Error(`Missing required critic attempt for ${jobType}.`);
    }
    const artifact = readSceneCriticArtifact(input.root, input.runId, input.sceneId, jobType, Number(attempt));
    if (!artifact) throw new Error(`Missing required critic artifact for ${jobType} attempt ${attempt}.`);
    if (artifact.chapter !== draft.chapter
      || artifact.draft_attempt !== input.draftAttempt
      || artifact.draft_output_hash !== draft.output_hash
      || artifact.contract_hash !== draft.contract_hash
      || artifact.scene_id !== draft.scene_id
      || artifact.run_id !== draft.run_id) {
      throw new Error(`Critic artifact ${jobType} does not match the active scene draft provenance.`);
    }
    return artifact;
  });
}

export function finalizeSceneCriticReview(input: FinalizeSceneCriticReviewInput): FinalizeSceneCriticReviewResult {
  const state = requireState(input);
  const draft = requireDraft(input, state);
  const requiredJobs = uniqueJobs(input.requiredJobTypes);
  const critics = requireCritics(input, draft, requiredJobs);
  const hasBlock = critics.some((item) => item.verdict === "block");
  const hasRepair = critics.some((item) => item.verdict === "repair");
  const blockerCount = critics.flatMap((item) => item.findings).filter((item) => item.severity === "blocker").length;
  const repairCount = critics.filter((item) => item.verdict === "repair").length;
  const passed = !hasBlock && !hasRepair;
  const nextAction = hasBlock ? "blocked" : hasRepair ? "span-repair" : "state-delta";
  const artifact: SceneCriticSummaryArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: input.sceneId,
    draft_attempt: input.draftAttempt,
    draft_output_hash: draft.output_hash,
    contract_hash: draft.contract_hash,
    required_job_types: requiredJobs,
    critics: critics.map((item) => ({
      job_type: item.job_type,
      critic_attempt: item.critic_attempt,
      verdict: item.verdict,
      finding_count: item.findings.length,
    })),
    blocker_count: blockerCount,
    repair_count: repairCount,
    passed,
    next_action: nextAction,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneCriticSummaryArtifactSchema, artifact)) throw new Error("Scene critic summary artifact failed schema validation.");
  const artifactPath = writeSceneCriticSummaryArtifact(input.root, artifact);
  const advanced = hasBlock
    ? blockChapterExecution(state, {
      code: "needs-editorial-decision",
      message: `Scene ${input.sceneId} has a critic blocker requiring a human editorial decision.`,
      recordIds: critics.filter((item) => item.verdict === "block").map((item) => item.job_type),
    }, input.now)
    : transitionChapterExecution(state, hasRepair ? "span-repair" : "state-delta", input.now, input.sceneId);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced };
}

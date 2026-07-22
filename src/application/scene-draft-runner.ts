import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { renderActiveContextCapsule } from "../context/active-context-renderer.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import {
  MODEL_EXECUTION_PROFILES,
  type ModelExecutionProfile,
} from "../domain/model-execution-profile.js";
import type { ModelCallReport } from "../domain/run-report.js";
import { ModelCallReportSchema } from "../domain/run-report.js";
import type { QualityThinkingLevel, QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { SceneDraftArtifactSchema, type SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { writeSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { readProject } from "../project/store.js";
import {
  recordChapterExecutionAttempt,
  transitionChapterExecution,
} from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface RunSceneDraftJobInput {
  root: string;
  runId: string;
  capsule: ActiveContextCapsule;
  runtimeProfile: RuntimeProfileId;
  worker: QualityWorker;
  customModelProfile?: ModelExecutionProfile;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  signal?: AbortSignal;
  now?: string;
}

export interface RunSceneDraftJobResult {
  artifact: SceneDraftArtifact;
  artifactPath: string;
  state: ChapterExecutionState;
  request: QualityWorkerRequest;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableHash(value: unknown): string {
  return hashText(JSON.stringify(value));
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function resolveModelProfile(capsule: ActiveContextCapsule, custom?: ModelExecutionProfile): ModelExecutionProfile {
  if (capsule.model_execution_profile === "custom") {
    if (!custom || custom.id !== "custom") throw new Error("Custom scene drafting requires a validated custom model execution profile.");
    return custom;
  }
  const profile = MODEL_EXECUTION_PROFILES[capsule.model_execution_profile];
  if (!profile) throw new Error(`Unknown scene model execution profile: ${capsule.model_execution_profile}.`);
  return profile;
}

function requireExecutionState(input: RunSceneDraftJobInput): ChapterExecutionState {
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "scene-draft") throw new Error(`Scene draft job requires scene-draft, current node is ${state.current_node}.`);
  if (state.current_scene_id !== input.capsule.scene_contract.scene_id) {
    throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${input.capsule.scene_contract.scene_id}.`);
  }
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot draft scene because the project hash changed.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot draft scene because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot draft scene because the canon snapshot or story index changed.");
  if (input.capsule.job_type !== "draft-scene") throw new Error(`Scene draft runner requires a draft-scene capsule, received ${input.capsule.job_type}.`);
  return state;
}

function promptFor(capsule: ActiveContextCapsule): string {
  return [
    `Draft exactly one scene: ${capsule.scene_contract.scene_id}.`,
    "Follow the supplied scene contract, authority labels, knowledge boundaries, and style card.",
    "Return scene prose only. Do not add analysis, headings, notes, or alternative versions.",
  ].join("\n");
}

function validatedProse(text: string, capsule: ActiveContextCapsule): { prose: string; wordCount: number } {
  const prose = text.trim();
  if (!prose) throw new Error("Scene draft output is blank or empty.");
  const wordCount = countWords(prose);
  const hardMaximum = Math.max(300, capsule.scene_contract.target_words.maximum * 2);
  if (wordCount > hardMaximum) {
    throw new Error(`Scene draft output has ${wordCount} words, above the ${hardMaximum}-word single-scene safety ceiling.`);
  }
  return { prose, wordCount };
}

export async function runSceneDraftJob(input: RunSceneDraftJobInput): Promise<RunSceneDraftJobResult> {
  const state = requireExecutionState(input);
  const project = readProject(input.root);
  const runtime = RUNTIME_PROFILES[input.runtimeProfile];
  const modelProfile = resolveModelProfile(input.capsule, input.customModelProfile);
  if (modelProfile.id !== input.capsule.model_execution_profile) {
    throw new Error(`Model profile ${modelProfile.id} does not match capsule profile ${input.capsule.model_execution_profile}.`);
  }

  const sceneId = input.capsule.scene_contract.scene_id;
  const attemptKey = `${sceneId}:scene-draft`;
  const attempted = recordChapterExecutionAttempt(state, attemptKey, input.now);
  const attempt = attempted.attempts[attemptKey]!;
  writeChapterExecutionState(input.root, attempted);

  const context = renderActiveContextCapsule(input.capsule, { style: runtime.promptStyle });
  const prompt = promptFor(input.capsule);
  if (context.length > runtime.maxContextChars) throw new Error("Rendered scene context exceeds the runtime profile before inference.");
  if (prompt.length > runtime.maxPromptChars) throw new Error("Scene draft prompt exceeds the runtime profile before inference.");
  const budget = modelProfile.job_budgets["draft-scene"];
  if (input.capsule.manifest.estimated_evidence_tokens > budget.maximumEvidenceTokens) {
    throw new Error("Scene capsule evidence exceeds the model execution budget before inference.");
  }

  const callId = `${input.runId}-${sceneId}-DRAFT-${attempt}`;
  const request: QualityWorkerRequest = {
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt,
    pass: "candidate",
    jobType: "draft-scene",
    prompt,
    context,
    decoding: modelProfile.decoding["draft-scene"],
    timeoutMs: 10 * 60_000,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
  };

  const result = await input.worker.run(request, input.signal);
  const validated = validatedProse(result.text, input.capsule);
  const outputHash = hashText(validated.prose);
  const capsuleHash = stableHash(input.capsule);
  const usage: ModelCallReport = {
    ...result.usage,
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt,
    pass: "candidate",
    jobType: "draft-scene",
    contractHash: input.capsule.contract_hash,
    capsuleHash,
    includedRecordCount: input.capsule.records.length,
    promptHash: hashText(prompt),
    contextHash: hashText(context),
    outputHash,
  };
  if (!Value.Check(ModelCallReportSchema, usage)) throw new Error("Scene draft worker returned invalid usage telemetry.");

  const artifact: SceneDraftArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: sceneId,
    chapter_contract_id: input.capsule.scene_contract.chapter_contract_id,
    chapter_contract_version: input.capsule.scene_contract.chapter_contract_version,
    job_type: "draft-scene",
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    story_index_hash: input.capsule.story_index_hash,
    model_execution_profile: input.capsule.model_execution_profile,
    runtime_profile: input.runtimeProfile,
    attempt,
    prose: validated.prose,
    word_count: validated.wordCount,
    output_hash: outputHash,
    usage,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneDraftArtifactSchema, artifact)) throw new Error("Scene draft artifact failed schema validation.");
  const artifactPath = writeSceneDraftArtifact(input.root, artifact);
  const advanced = transitionChapterExecution(attempted, "deterministic-validation", input.now, sceneId);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced, request };
}

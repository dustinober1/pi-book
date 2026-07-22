import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { renderActiveContextCapsule } from "../context/active-context-renderer.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import {
  MODEL_EXECUTION_PROFILES,
  type ModelExecutionProfile,
} from "../domain/model-execution-profile.js";
import type { QualityThinkingLevel, QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";
import { ModelCallReportSchema, type ModelCallReport } from "../domain/run-report.js";
import {
  SceneCriticArtifactSchema,
  SceneCriticOutputSchema,
  isSceneCriticJobType,
  type SceneCriticArtifact,
  type SceneCriticOutput,
} from "../domain/scene-critic-artifact.js";
import type { SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { writeSceneCriticArtifact } from "../infrastructure/scene-critic-artifact-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { readSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { parseStructuredQualityArtifact } from "./quality-output.js";
import { recordChapterExecutionAttempt } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface RunSceneCriticJobInput {
  root: string;
  runId: string;
  capsule: ActiveContextCapsule;
  draftAttempt: number;
  runtimeProfile: RuntimeProfileId;
  worker: QualityWorker;
  customModelProfile?: ModelExecutionProfile;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  signal?: AbortSignal;
  now?: string;
}

export interface RunSceneCriticJobResult {
  artifact: SceneCriticArtifact;
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

function resolveModelProfile(capsule: ActiveContextCapsule, custom?: ModelExecutionProfile): ModelExecutionProfile {
  if (capsule.model_execution_profile === "custom") {
    if (!custom || custom.id !== "custom") throw new Error("Custom scene critics require a validated custom model execution profile.");
    return custom;
  }
  const profile = MODEL_EXECUTION_PROFILES[capsule.model_execution_profile];
  if (!profile) throw new Error(`Unknown critic model execution profile: ${capsule.model_execution_profile}.`);
  return profile;
}

function requireState(input: RunSceneCriticJobInput): ChapterExecutionState {
  if (!Number.isInteger(input.draftAttempt) || input.draftAttempt < 1) throw new Error("Scene critic requires a positive draft attempt.");
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "critic-review") throw new Error(`Scene critic requires critic-review, current node is ${state.current_node}.`);
  if (!isSceneCriticJobType(input.capsule.job_type)) throw new Error(`Scene critic capsule has unsupported job type ${input.capsule.job_type}.`);
  const sceneId = input.capsule.scene_contract.scene_id;
  if (state.current_scene_id !== sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot run scene critic because the project hash changed.");
  if (input.capsule.project_hash !== state.project_hash) throw new Error("Cannot run scene critic because the capsule project hash does not match the active project snapshot.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot run scene critic because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot run scene critic because the canon snapshot or story index changed.");
  return state;
}

function requireDraft(input: RunSceneCriticJobInput, state: ChapterExecutionState): SceneDraftArtifact {
  const scene = input.capsule.scene_contract;
  const draft = readSceneDraftArtifact(input.root, input.runId, scene.scene_id, input.draftAttempt);
  if (!draft) throw new Error(`Scene draft artifact not found for ${scene.scene_id} attempt ${input.draftAttempt}.`);
  if (draft.chapter !== state.chapter
    || draft.scene_id !== scene.scene_id
    || draft.chapter_contract_id !== scene.chapter_contract_id
    || draft.chapter_contract_version !== scene.chapter_contract_version
    || draft.contract_hash !== input.capsule.contract_hash
    || draft.story_index_hash !== input.capsule.story_index_hash) {
    throw new Error("Scene critic draft provenance does not match the active capsule and execution state.");
  }
  if (hashText(draft.prose) !== draft.output_hash || draft.usage.outputHash !== draft.output_hash) {
    throw new Error("Scene critic draft output integrity check failed.");
  }
  const validation = readSceneValidationArtifact(input.root, input.runId, scene.scene_id, input.draftAttempt);
  if (!validation || !validation.passed || validation.draft_output_hash !== draft.output_hash) {
    throw new Error("Scene critic requires a passed deterministic validation artifact for the same draft.");
  }
  return draft;
}

function contextWithCandidate(capsule: ActiveContextCapsule, draft: SceneDraftArtifact, style: "compact" | "standard"): string {
  const rendered = renderActiveContextCapsule(capsule, { style });
  const marker = "\n\nEXACT TASK\n";
  const taskIndex = rendered.lastIndexOf(marker);
  if (taskIndex < 0) throw new Error("Active context capsule is missing the exact task section.");
  return `${rendered.slice(0, taskIndex)}\n\nSCENE CANDIDATE\n${draft.prose}${rendered.slice(taskIndex)}`;
}

function criticPrompt(jobType: ActiveContextCapsule["job_type"]): string {
  return [
    `Review only the ${jobType} concern for the supplied scene candidate.`,
    "Return one exact JSON object with schema_version, verdict, and findings.",
    "Each finding must contain severity, category, an exact evidence_quote copied from the candidate, and required_change.",
    "Use verdict pass when no repair is needed, repair for bounded prose changes, or block only when a human editorial decision is required.",
    "Do not include Markdown fences or commentary outside the JSON object.",
  ].join("\n");
}

function validatedOutput(output: SceneCriticOutput, draft: SceneDraftArtifact): SceneCriticOutput {
  if (output.verdict !== "pass" && output.findings.length === 0) {
    throw new Error(`Scene critic verdict ${output.verdict} requires at least one finding.`);
  }
  if (output.verdict === "pass" && output.findings.some((item) => item.severity === "blocker" || item.severity === "high")) {
    throw new Error("Scene critic cannot pass while reporting blocker or high-severity findings.");
  }
  for (const item of output.findings) {
    if (!draft.prose.includes(item.evidence_quote)) {
      throw new Error(`Scene critic exact evidence quote was not found in the candidate: ${item.evidence_quote}`);
    }
  }
  return output;
}

export async function runSceneCriticJob(input: RunSceneCriticJobInput): Promise<RunSceneCriticJobResult> {
  const state = requireState(input);
  const draft = requireDraft(input, state);
  const jobType = input.capsule.job_type;
  if (!isSceneCriticJobType(jobType)) throw new Error(`Unsupported scene critic job type ${jobType}.`);
  const runtime = RUNTIME_PROFILES[input.runtimeProfile];
  const modelProfile = resolveModelProfile(input.capsule, input.customModelProfile);
  if (modelProfile.id !== input.capsule.model_execution_profile) {
    throw new Error(`Model profile ${modelProfile.id} does not match capsule profile ${input.capsule.model_execution_profile}.`);
  }

  const sceneId = draft.scene_id;
  const attemptKey = `${sceneId}:${jobType}`;
  const attempted = recordChapterExecutionAttempt(state, attemptKey, input.now);
  const criticAttempt = attempted.attempts[attemptKey]!;
  writeChapterExecutionState(input.root, attempted);

  const context = contextWithCandidate(input.capsule, draft, runtime.promptStyle);
  const prompt = criticPrompt(jobType);
  if (context.length > runtime.maxContextChars) throw new Error("Rendered scene critic context exceeds the runtime profile before inference.");
  if (prompt.length > runtime.maxPromptChars) throw new Error("Scene critic prompt exceeds the runtime profile before inference.");
  const jobBudget = modelProfile.job_budgets[jobType];
  const estimatedEvidenceTokens = Math.max(1, Math.ceil(Buffer.byteLength(context, "utf8") / 4));
  if (estimatedEvidenceTokens > jobBudget.maximumEvidenceTokens) {
    throw new Error(`Scene critic context needs approximately ${estimatedEvidenceTokens} evidence tokens, above the ${jobBudget.maximumEvidenceTokens}-token budget.`);
  }

  const callId = `${input.runId}-${sceneId}-${jobType.toUpperCase()}-${criticAttempt}`;
  const request: QualityWorkerRequest = {
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: criticAttempt,
    pass: "critic",
    jobType,
    prompt,
    context,
    decoding: modelProfile.decoding[jobType],
    timeoutMs: 10 * 60_000,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
  };
  const result = await input.worker.run(request, input.signal);
  const parsed = parseStructuredQualityArtifact(result.text, SceneCriticOutputSchema, `${jobType} output`);
  const output = validatedOutput(parsed, draft);
  const outputHash = hashText(result.text.trim());
  const capsuleHash = stableHash(input.capsule);
  const usage: ModelCallReport = {
    ...result.usage,
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: criticAttempt,
    pass: "critic",
    jobType,
    contractHash: input.capsule.contract_hash,
    capsuleHash,
    includedRecordCount: input.capsule.records.length,
    promptHash: hashText(prompt),
    contextHash: hashText(context),
    outputHash,
  };
  if (!Value.Check(ModelCallReportSchema, usage)) throw new Error("Scene critic worker returned invalid usage telemetry.");

  const artifact: SceneCriticArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: sceneId,
    draft_attempt: input.draftAttempt,
    draft_output_hash: draft.output_hash,
    job_type: jobType,
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    critic_attempt: criticAttempt,
    verdict: output.verdict,
    findings: output.findings,
    usage,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneCriticArtifactSchema, artifact)) throw new Error("Scene critic artifact failed schema validation.");
  const artifactPath = writeSceneCriticArtifact(input.root, artifact);
  return { artifact, artifactPath, state: attempted, request };
}

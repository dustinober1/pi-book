import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { renderActiveContextCapsule } from "../context/active-context-renderer.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import { MODEL_EXECUTION_PROFILES, type ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { QualityThinkingLevel, QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";
import { ModelCallReportSchema, type ModelCallReport } from "../domain/run-report.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { ScenePlanArtifactSchema, ScenePlanOutputSchema, type ScenePlanArtifact, type ScenePlanOutput } from "../domain/scene-plan-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { writeScenePlanArtifact } from "../infrastructure/scene-plan-artifact-store.js";
import { recordChapterExecutionAttempt, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";
import { parseStructuredQualityArtifact } from "./quality-output.js";

export interface RunScenePlanJobInput {
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

export interface RunScenePlanJobResult {
  artifact: ScenePlanArtifact;
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
    if (!custom || custom.id !== "custom") throw new Error("Custom scene planning requires a validated custom model execution profile.");
    return custom;
  }
  const profile = MODEL_EXECUTION_PROFILES[capsule.model_execution_profile];
  if (!profile) throw new Error(`Unknown scene-plan model execution profile: ${capsule.model_execution_profile}.`);
  return profile;
}

function requireState(input: RunScenePlanJobInput): ChapterExecutionState {
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "scene-plan") throw new Error(`Scene planning requires scene-plan, current node is ${state.current_node}.`);
  const sceneId = input.capsule.scene_contract.scene_id;
  if (state.current_scene_id !== sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot plan scene because the project hash changed.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot plan scene because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot plan scene because the story index changed.");
  if (input.capsule.job_type !== "plan-scene") throw new Error(`Scene plan runner requires plan-scene, received ${input.capsule.job_type}.`);
  return state;
}

function prompt(): string {
  return [
    "Return one exact JSON object with schema_version, steps, turn_execution, ending_execution, and evidence_record_ids.",
    "Create exactly one step for each required beat, in the supplied order, copying required_beat exactly.",
    "Keep each execution and pressure note concise and operational. Do not draft scene prose.",
    "Use only evidence_record_ids included in the active context capsule.",
    "Do not include Markdown fences or commentary outside the JSON object.",
  ].join("\n");
}

function validatePlan(output: ScenePlanOutput, capsule: ActiveContextCapsule): ScenePlanOutput {
  const expected = capsule.scene_contract.required_beats;
  const actual = output.steps.map((item) => item.required_beat);
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    throw new Error(`Scene plan required beat sequence must match the contract order: ${expected.join(" | ")}.`);
  }
  const allowed = new Set(capsule.records.map((record) => record.id));
  const unknown = output.evidence_record_ids.filter((id) => !allowed.has(id));
  if (unknown.length) throw new Error(`Scene plan references unknown evidence record IDs: ${unknown.join(", ")}.`);
  return output;
}

export async function runScenePlanJob(input: RunScenePlanJobInput): Promise<RunScenePlanJobResult> {
  const state = requireState(input);
  const runtime = RUNTIME_PROFILES[input.runtimeProfile];
  const modelProfile = resolveModelProfile(input.capsule, input.customModelProfile);
  if (modelProfile.id !== input.capsule.model_execution_profile) {
    throw new Error(`Model profile ${modelProfile.id} does not match capsule profile ${input.capsule.model_execution_profile}.`);
  }
  const sceneId = input.capsule.scene_contract.scene_id;
  const attemptKey = `${sceneId}:scene-plan`;
  const attempted = recordChapterExecutionAttempt(state, attemptKey, input.now);
  const attempt = attempted.attempts[attemptKey]!;
  writeChapterExecutionState(input.root, attempted);

  const context = renderActiveContextCapsule(input.capsule, { style: runtime.promptStyle });
  const instructions = prompt();
  if (context.length > runtime.maxContextChars) throw new Error("Rendered scene-plan context exceeds the runtime profile before inference.");
  if (instructions.length > runtime.maxPromptChars) throw new Error("Scene-plan prompt exceeds the runtime profile before inference.");
  const budget = modelProfile.job_budgets["plan-scene"];
  const evidenceTokens = Math.max(1, Math.ceil(Buffer.byteLength(context, "utf8") / 4));
  if (evidenceTokens > budget.maximumEvidenceTokens) {
    throw new Error(`Scene-plan context needs approximately ${evidenceTokens} evidence tokens, above the ${budget.maximumEvidenceTokens}-token budget.`);
  }

  const callId = `${input.runId}-${sceneId}-PLAN-${attempt}`;
  const request: QualityWorkerRequest = {
    callId, stage: "drafting", chapter: state.chapter, sceneId, attempt, pass: "plan", jobType: "plan-scene",
    prompt: instructions, context, decoding: modelProfile.decoding["plan-scene"], timeoutMs: 10 * 60_000,
    ...(input.provider ? { provider: input.provider } : {}), ...(input.model ? { model: input.model } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
  };
  const result = await input.worker.run(request, input.signal);
  const output = validatePlan(parseStructuredQualityArtifact(result.text, ScenePlanOutputSchema, "scene plan output"), input.capsule);
  const outputHash = hashText(result.text.trim());
  const capsuleHash = stableHash(input.capsule);
  const usage: ModelCallReport = {
    ...result.usage, callId, stage: "drafting", chapter: state.chapter, sceneId, attempt, pass: "plan", jobType: "plan-scene",
    contractHash: input.capsule.contract_hash, capsuleHash, includedRecordCount: input.capsule.records.length,
    promptHash: hashText(instructions), contextHash: hashText(context), outputHash,
  };
  if (!Value.Check(ModelCallReportSchema, usage)) throw new Error("Scene plan worker returned invalid usage telemetry.");

  const artifact: ScenePlanArtifact = {
    schema_version: "1.0.0", run_id: input.runId, chapter: state.chapter, scene_id: sceneId,
    capsule_id: input.capsule.capsule_id, contract_hash: input.capsule.contract_hash, story_index_hash: input.capsule.story_index_hash,
    plan_attempt: attempt, steps: output.steps, turn_execution: output.turn_execution, ending_execution: output.ending_execution,
    evidence_record_ids: output.evidence_record_ids, usage, created_at: timestamp(input.now),
  };
  if (!Value.Check(ScenePlanArtifactSchema, artifact)) throw new Error("Scene plan artifact failed schema validation.");
  const artifactPath = writeScenePlanArtifact(input.root, artifact);
  const advanced = transitionChapterExecution(attempted, "scene-draft", input.now, sceneId);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced, request };
}

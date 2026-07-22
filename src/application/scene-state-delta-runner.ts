import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { renderActiveContextCapsule } from "../context/active-context-renderer.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { StateMutation } from "../domain/chapter-contract.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import {
  MODEL_EXECUTION_PROFILES,
  type ModelExecutionProfile,
} from "../domain/model-execution-profile.js";
import type { QualityThinkingLevel, QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";
import { ModelCallReportSchema, type ModelCallReport } from "../domain/run-report.js";
import type { SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import {
  SceneStateDeltaArtifactSchema,
  SceneStateDeltaOutputSchema,
  type SceneStateDeltaArtifact,
  type SceneStateDeltaMismatch,
  type SceneStateDeltaMutation,
  type SceneStateDeltaOutput,
} from "../domain/scene-state-delta-artifact.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneCriticSummaryArtifact } from "../infrastructure/scene-critic-summary-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { writeSceneStateDeltaArtifact } from "../infrastructure/scene-state-delta-artifact-store.js";
import { readSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { blockChapterExecution, recordChapterExecutionAttempt, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";
import { parseStructuredQualityArtifact } from "./quality-output.js";

export interface RunSceneStateDeltaExtractionInput {
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

export interface RunSceneStateDeltaExtractionResult {
  artifact: SceneStateDeltaArtifact;
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
    if (!custom || custom.id !== "custom") throw new Error("Custom state-delta extraction requires a validated custom model execution profile.");
    return custom;
  }
  const profile = MODEL_EXECUTION_PROFILES[capsule.model_execution_profile];
  if (!profile) throw new Error(`Unknown state-delta model execution profile: ${capsule.model_execution_profile}.`);
  return profile;
}

function requireState(input: RunSceneStateDeltaExtractionInput): ChapterExecutionState {
  if (!Number.isInteger(input.draftAttempt) || input.draftAttempt < 1) throw new Error("State-delta extraction requires a positive draft attempt.");
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "state-delta") throw new Error(`State-delta extraction requires state-delta, current node is ${state.current_node}.`);
  if (input.capsule.job_type !== "extract-state-delta") throw new Error(`State-delta extraction requires an extract-state-delta capsule, received ${input.capsule.job_type}.`);
  const sceneId = input.capsule.scene_contract.scene_id;
  if (state.current_scene_id !== sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot extract scene state because the project hash changed.");
  if (input.capsule.project_hash !== state.project_hash) throw new Error("Cannot extract scene state because the capsule project hash does not match the active project snapshot.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot extract scene state because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot extract scene state because the story index changed.");
  return state;
}

function requireDraft(input: RunSceneStateDeltaExtractionInput, state: ChapterExecutionState): SceneDraftArtifact {
  const scene = input.capsule.scene_contract;
  const draft = readSceneDraftArtifact(input.root, input.runId, scene.scene_id, input.draftAttempt);
  if (!draft) throw new Error(`Scene draft artifact not found for ${scene.scene_id} attempt ${input.draftAttempt}.`);
  if (draft.chapter !== state.chapter
    || draft.scene_id !== scene.scene_id
    || draft.chapter_contract_id !== scene.chapter_contract_id
    || draft.chapter_contract_version !== scene.chapter_contract_version
    || draft.contract_hash !== input.capsule.contract_hash
    || draft.story_index_hash !== input.capsule.story_index_hash) {
    throw new Error("State-delta source draft provenance does not match the active capsule and execution state.");
  }
  if (hashText(draft.prose) !== draft.output_hash || draft.usage.outputHash !== draft.output_hash) {
    throw new Error("State-delta source draft output integrity check failed.");
  }
  const validation = readSceneValidationArtifact(input.root, input.runId, scene.scene_id, input.draftAttempt);
  if (!validation || !validation.passed || validation.draft_output_hash !== draft.output_hash) {
    throw new Error("State-delta extraction requires passed deterministic validation for the same draft.");
  }
  const critics = readSceneCriticSummaryArtifact(input.root, input.runId, scene.scene_id, input.draftAttempt);
  if (!critics || !critics.passed || critics.next_action !== "state-delta" || critics.draft_output_hash !== draft.output_hash) {
    throw new Error("State-delta extraction requires a passed critic summary for the same draft.");
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

function deltaPrompt(): string {
  return [
    "Return one exact JSON object with schema_version, mutations, and optional thread_changes.",
    "Report only state mutations and story-thread changes that actually occur in the supplied scene candidate.",
    "Each mutation must include record_id, field, operation, value, and an exact evidence_quote copied from the candidate.",
    "Each thread change must include thread_id, operation (opened, advanced, or resolved), description, and an exact evidence_quote copied from the candidate.",
    "Report thread changes only for the active thread IDs in the scene contract.",
    "Use empty arrays when the scene changes no tracked state or thread.",
    "Do not include Markdown fences or commentary outside the JSON object.",
  ].join("\n");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function mutationKey(value: Pick<StateMutation, "record_id" | "field">): string {
  return `${value.record_id}\u0000${value.field}`;
}

function validateOutput(output: SceneStateDeltaOutput, draft: SceneDraftArtifact): SceneStateDeltaOutput {
  const seen = new Set<string>();
  for (const mutation of output.mutations) {
    const key = mutationKey(mutation);
    if (seen.has(key)) throw new Error(`State-delta output duplicates ${mutation.record_id}.${mutation.field}.`);
    seen.add(key);
    if (!draft.prose.includes(mutation.evidence_quote)) {
      throw new Error(`State-delta exact evidence quote was not found in the candidate: ${mutation.evidence_quote}`);
    }
  }
  const seenThreads = new Set<string>();
  for (const change of output.thread_changes ?? []) {
    if (seenThreads.has(change.thread_id)) throw new Error(`State-delta output duplicates thread change ${change.thread_id}.`);
    seenThreads.add(change.thread_id);
    if (!draft.prose.includes(change.evidence_quote)) {
      throw new Error(`Thread-delta exact evidence quote was not found in the candidate: ${change.evidence_quote}`);
    }
  }
  return output;
}

function compareMutations(
  expected: readonly StateMutation[],
  actual: readonly SceneStateDeltaMutation[],
  knownRecordIds: ReadonlySet<string>,
): SceneStateDeltaMismatch[] {
  const mismatches: SceneStateDeltaMismatch[] = [];
  const expectedByKey = new Map(expected.map((item) => [mutationKey(item), item]));
  const actualByKey = new Map(actual.map((item) => [mutationKey(item), item]));

  for (const item of actual) {
    if (!knownRecordIds.has(item.record_id)) {
      mismatches.push({
        code: "unknown-record",
        record_id: item.record_id,
        field: item.field,
        message: `Actual scene delta references unknown record ${item.record_id}.`,
      });
    }
  }
  for (const item of expected) {
    const candidate = actualByKey.get(mutationKey(item));
    if (!candidate) {
      mismatches.push({
        code: "missing-expected-mutation",
        record_id: item.record_id,
        field: item.field,
        message: `Scene does not establish expected mutation ${item.record_id}.${item.field}.`,
      });
      continue;
    }
    if (candidate.operation !== item.operation || canonical(candidate.value) !== canonical(item.value)) {
      mismatches.push({
        code: "mutation-difference",
        record_id: item.record_id,
        field: item.field,
        message: `Actual mutation for ${item.record_id}.${item.field} differs from the scene contract.`,
      });
    }
  }
  for (const item of actual) {
    if (!knownRecordIds.has(item.record_id)) continue;
    if (!expectedByKey.has(mutationKey(item))) {
      mismatches.push({
        code: "unexpected-mutation",
        record_id: item.record_id,
        field: item.field,
        message: `Scene introduces uncontracted mutation ${item.record_id}.${item.field}.`,
      });
    }
  }
  return mismatches;
}

export async function runSceneStateDeltaExtraction(
  input: RunSceneStateDeltaExtractionInput,
): Promise<RunSceneStateDeltaExtractionResult> {
  const state = requireState(input);
  const draft = requireDraft(input, state);
  const runtime = RUNTIME_PROFILES[input.runtimeProfile];
  const modelProfile = resolveModelProfile(input.capsule, input.customModelProfile);
  if (modelProfile.id !== input.capsule.model_execution_profile) {
    throw new Error(`Model profile ${modelProfile.id} does not match capsule profile ${input.capsule.model_execution_profile}.`);
  }

  const sceneId = draft.scene_id;
  const attemptKey = `${sceneId}:state-delta`;
  const attempted = recordChapterExecutionAttempt(state, attemptKey, input.now);
  const extractionAttempt = attempted.attempts[attemptKey]!;
  writeChapterExecutionState(input.root, attempted);

  const context = contextWithCandidate(input.capsule, draft, runtime.promptStyle);
  const prompt = deltaPrompt();
  if (context.length > runtime.maxContextChars) throw new Error("Rendered state-delta context exceeds the runtime profile before inference.");
  if (prompt.length > runtime.maxPromptChars) throw new Error("State-delta prompt exceeds the runtime profile before inference.");
  const budget = modelProfile.job_budgets["extract-state-delta"];
  const estimatedEvidenceTokens = Math.max(1, Math.ceil(Buffer.byteLength(context, "utf8") / 4));
  if (estimatedEvidenceTokens > budget.maximumEvidenceTokens) {
    throw new Error(`State-delta context needs approximately ${estimatedEvidenceTokens} evidence tokens, above the ${budget.maximumEvidenceTokens}-token budget.`);
  }

  const callId = `${input.runId}-${sceneId}-STATE-DELTA-${extractionAttempt}`;
  const request: QualityWorkerRequest = {
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: extractionAttempt,
    pass: "verification",
    jobType: "extract-state-delta",
    prompt,
    context,
    decoding: modelProfile.decoding["extract-state-delta"],
    timeoutMs: 10 * 60_000,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
  };
  const result = await input.worker.run(request, input.signal);
  const output = validateOutput(
    parseStructuredQualityArtifact(result.text, SceneStateDeltaOutputSchema, "scene state-delta output"),
    draft,
  );

  const expectedMutations = input.capsule.scene_contract.expected_state_delta;
  const knownRecordIds = new Set([
    ...input.capsule.records.map((item) => item.id),
    ...expectedMutations.map((item) => item.record_id),
  ]);
  const mismatches = compareMutations(expectedMutations, output.mutations, knownRecordIds);
  const unknownRecords = [...new Set(mismatches.filter((item) => item.code === "unknown-record").map((item) => item.record_id))];
  const activeThreadIds = new Set(input.capsule.scene_contract.active_thread_ids);
  const uncontractedThreadIds = [...new Set((output.thread_changes ?? [])
    .filter((item) => !activeThreadIds.has(item.thread_id))
    .map((item) => item.thread_id))];
  const matchesExpected = mismatches.length === 0;
  const nextAction = unknownRecords.length || uncontractedThreadIds.length
    ? "blocked"
    : matchesExpected ? "scene-accept" : "span-repair";
  const outputHash = hashText(result.text.trim());
  const capsuleHash = stableHash(input.capsule);
  const usage: ModelCallReport = {
    ...result.usage,
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: extractionAttempt,
    pass: "verification",
    jobType: "extract-state-delta",
    contractHash: input.capsule.contract_hash,
    capsuleHash,
    includedRecordCount: input.capsule.records.length,
    promptHash: hashText(prompt),
    contextHash: hashText(context),
    outputHash,
  };
  if (!Value.Check(ModelCallReportSchema, usage)) throw new Error("State-delta worker returned invalid usage telemetry.");

  const artifact: SceneStateDeltaArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: sceneId,
    draft_attempt: input.draftAttempt,
    draft_output_hash: draft.output_hash,
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    extraction_attempt: extractionAttempt,
    expected_mutations: expectedMutations,
    actual_mutations: output.mutations,
    actual_thread_changes: output.thread_changes ?? [],
    mismatches,
    matches_expected: matchesExpected,
    next_action: nextAction,
    usage,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneStateDeltaArtifactSchema, artifact)) throw new Error("Scene state-delta artifact failed schema validation.");
  const artifactPath = writeSceneStateDeltaArtifact(input.root, artifact);
  const advanced = unknownRecords.length
    ? blockChapterExecution(attempted, {
      code: "unknown-state-record",
      message: `Scene ${sceneId} references state records that require a human canon decision.`,
      recordIds: unknownRecords,
    }, input.now)
    : uncontractedThreadIds.length
      ? blockChapterExecution(attempted, {
        code: "needs-editorial-decision",
        message: `Scene ${sceneId} changes story threads outside the active scene contract.`,
        recordIds: uncontractedThreadIds,
      }, input.now)
      : transitionChapterExecution(attempted, matchesExpected ? "scene-accept" : "span-repair", input.now, sceneId);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced, request };
}

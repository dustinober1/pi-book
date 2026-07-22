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
  isSceneCriticJobType,
  type SceneCriticJobType,
} from "../domain/scene-critic-artifact.js";
import { SceneDraftArtifactSchema, type SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import {
  ScenePatchArtifactSchema,
  ScenePatchOutputSchema,
  type ResolvedScenePatchOperation,
  type ScenePatchArtifact,
  type ScenePatchOperationInput,
  type ScenePatchOutput,
} from "../domain/scene-patch-artifact.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneCriticArtifact } from "../infrastructure/scene-critic-artifact-store.js";
import { readSceneDraftArtifact, writeSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { writeScenePatchArtifact } from "../infrastructure/scene-patch-artifact-store.js";
import { readSceneStateDeltaArtifact } from "../infrastructure/scene-state-delta-artifact-store.js";
import { readSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { recordChapterExecutionAttempt, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";
import { parseStructuredQualityArtifact } from "./quality-output.js";

interface RepairFinding {
  ref: string;
  message: string;
  evidenceQuote: string | null;
}

export interface RunSceneSpanRepairInput {
  root: string;
  runId: string;
  capsule: ActiveContextCapsule;
  sourceDraftAttempt: number;
  runtimeProfile: RuntimeProfileId;
  worker: QualityWorker;
  criticAttempts?: Partial<Record<SceneCriticJobType, number>>;
  stateDeltaExtractionAttempt?: number;
  customModelProfile?: ModelExecutionProfile;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  signal?: AbortSignal;
  now?: string;
}

export interface RunSceneSpanRepairResult {
  patch: ScenePatchArtifact;
  patchPath: string;
  repairedDraft: SceneDraftArtifact;
  repairedDraftPath: string;
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
    if (!custom || custom.id !== "custom") throw new Error("Custom span repair requires a validated custom model execution profile.");
    return custom;
  }
  const profile = MODEL_EXECUTION_PROFILES[capsule.model_execution_profile];
  if (!profile) throw new Error(`Unknown span-repair model execution profile: ${capsule.model_execution_profile}.`);
  return profile;
}

function requireState(input: RunSceneSpanRepairInput): ChapterExecutionState {
  if (!Number.isInteger(input.sourceDraftAttempt) || input.sourceDraftAttempt < 1) {
    throw new Error("Scene span repair requires a positive source draft attempt.");
  }
  if (input.stateDeltaExtractionAttempt !== undefined
    && (!Number.isInteger(input.stateDeltaExtractionAttempt) || input.stateDeltaExtractionAttempt < 1)) {
    throw new Error("Scene span repair requires a positive state-delta extraction attempt when supplied.");
  }
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "span-repair") throw new Error(`Scene repair requires span-repair, current node is ${state.current_node}.`);
  if (input.capsule.job_type !== "patch-spans") throw new Error(`Scene repair requires a patch-spans capsule, received ${input.capsule.job_type}.`);
  const sceneId = input.capsule.scene_contract.scene_id;
  if (state.current_scene_id !== sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot repair scene because the project hash changed.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot repair scene because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot repair scene because the story index changed.");
  return state;
}

function requireSourceDraft(input: RunSceneSpanRepairInput, state: ChapterExecutionState): SceneDraftArtifact {
  const scene = input.capsule.scene_contract;
  const draft = readSceneDraftArtifact(input.root, input.runId, scene.scene_id, input.sourceDraftAttempt);
  if (!draft) throw new Error(`Source scene draft not found for ${scene.scene_id} attempt ${input.sourceDraftAttempt}.`);
  if (draft.chapter !== state.chapter
    || draft.scene_id !== scene.scene_id
    || draft.chapter_contract_id !== scene.chapter_contract_id
    || draft.chapter_contract_version !== scene.chapter_contract_version
    || draft.contract_hash !== input.capsule.contract_hash
    || draft.story_index_hash !== input.capsule.story_index_hash) {
    throw new Error("Source scene draft provenance does not match the repair capsule and execution state.");
  }
  if (hashText(draft.prose) !== draft.output_hash || draft.usage.outputHash !== draft.output_hash) {
    throw new Error("Source scene draft output integrity check failed.");
  }
  return draft;
}

function activeStateDeltaAttempt(input: RunSceneSpanRepairInput, draft: SceneDraftArtifact): number | null {
  if (input.stateDeltaExtractionAttempt !== undefined) return input.stateDeltaExtractionAttempt;
  const state = readChapterExecutionState(input.root, input.runId);
  const recorded = state?.attempts[`${draft.scene_id}:state-delta`] ?? 0;
  if (!Number.isInteger(recorded) || recorded < 1) return null;
  const artifact = readSceneStateDeltaArtifact(
    input.root,
    input.runId,
    draft.scene_id,
    input.sourceDraftAttempt,
    recorded,
  );
  return artifact && !artifact.matches_expected && artifact.next_action === "span-repair" ? recorded : null;
}

function activeRepairFindings(input: RunSceneSpanRepairInput, draft: SceneDraftArtifact): RepairFinding[] {
  const findings: RepairFinding[] = [];
  const validation = readSceneValidationArtifact(input.root, input.runId, draft.scene_id, input.sourceDraftAttempt);
  if (validation) {
    if (validation.draft_output_hash !== draft.output_hash || validation.contract_hash !== draft.contract_hash) {
      throw new Error("Deterministic validation provenance does not match the source draft.");
    }
    for (const item of validation.findings.filter((candidate) => candidate.severity === "blocker")) {
      findings.push({ ref: `deterministic:${item.code}`, message: item.message, evidenceQuote: null });
    }
  }
  for (const [rawJobType, rawAttempt] of Object.entries(input.criticAttempts ?? {})) {
    if (!isSceneCriticJobType(rawJobType)) throw new Error(`Invalid critic repair source ${rawJobType}.`);
    const attempt = Number(rawAttempt);
    if (!Number.isInteger(attempt) || attempt < 1) throw new Error(`Invalid critic attempt for ${rawJobType}.`);
    const artifact = readSceneCriticArtifact(input.root, input.runId, draft.scene_id, rawJobType, attempt);
    if (!artifact) throw new Error(`Critic repair source not found for ${rawJobType} attempt ${attempt}.`);
    if (artifact.draft_attempt !== input.sourceDraftAttempt
      || artifact.draft_output_hash !== draft.output_hash
      || artifact.contract_hash !== draft.contract_hash
      || artifact.verdict !== "repair") {
      throw new Error(`Critic repair source ${rawJobType} does not match the active repairable draft.`);
    }
    artifact.findings.forEach((item, index) => {
      findings.push({
        ref: `${rawJobType}:${index + 1}`,
        message: item.required_change,
        evidenceQuote: item.evidence_quote,
      });
    });
  }
  const stateDeltaAttempt = activeStateDeltaAttempt(input, draft);
  if (stateDeltaAttempt !== null) {
    const artifact = readSceneStateDeltaArtifact(
      input.root,
      input.runId,
      draft.scene_id,
      input.sourceDraftAttempt,
      stateDeltaAttempt,
    );
    if (!artifact) {
      throw new Error(`State-delta repair source not found for draft ${input.sourceDraftAttempt} extraction attempt ${stateDeltaAttempt}.`);
    }
    if (artifact.draft_attempt !== input.sourceDraftAttempt
      || artifact.draft_output_hash !== draft.output_hash
      || artifact.contract_hash !== draft.contract_hash
      || artifact.matches_expected
      || artifact.next_action !== "span-repair"
      || artifact.mismatches.length === 0) {
      throw new Error("State-delta repair source does not match the active repairable draft.");
    }
    for (const mismatch of artifact.mismatches) {
      findings.push({
        ref: `state-delta:${mismatch.code}:${mismatch.record_id}:${mismatch.field}`,
        message: mismatch.message,
        evidenceQuote: null,
      });
    }
  }
  const deduplicated = new Map<string, RepairFinding>();
  for (const item of findings) deduplicated.set(item.ref, item);
  const result = [...deduplicated.values()];
  if (!result.length) throw new Error("Scene span repair has no active deterministic, critic, or state-delta findings.");
  return result;
}

function contextWithRepair(
  capsule: ActiveContextCapsule,
  draft: SceneDraftArtifact,
  findings: readonly RepairFinding[],
  style: "compact" | "standard",
): string {
  const rendered = renderActiveContextCapsule(capsule, { style });
  const marker = "\n\nEXACT TASK\n";
  const taskIndex = rendered.lastIndexOf(marker);
  if (taskIndex < 0) throw new Error("Active context capsule is missing the exact task section.");
  const findingLines = findings.flatMap((item) => [
    `- ${item.ref}: ${item.message}`,
    ...(item.evidenceQuote ? [`  Evidence: ${item.evidenceQuote}`] : []),
  ]);
  return `${rendered.slice(0, taskIndex)}\n\nSCENE CANDIDATE\n${draft.prose}\n\nREPAIR FINDINGS\n${findingLines.join("\n")}${rendered.slice(taskIndex)}`;
}

function patchPrompt(): string {
  return [
    "Return one exact JSON patch object with schema_version and operations.",
    "Use no more than eight operations. Each operation must use one exact unique anchor_quote copied from the scene.",
    "Allowed operations are replace, delete, insert-before, and insert-after.",
    "Every operation must cite one or more listed finding_refs. Address every listed finding.",
    "Do not rewrite the whole scene, include Markdown fences, or return commentary outside the JSON object.",
  ].join("\n");
}

function resolveOperation(
  prose: string,
  operation: ScenePatchOperationInput,
  availableRefs: ReadonlySet<string>,
): ResolvedScenePatchOperation {
  for (const ref of operation.finding_refs) {
    if (!availableRefs.has(ref)) throw new Error(`Scene patch cites inactive finding ${ref}.`);
  }
  if (operation.operation === "delete" && operation.replacement !== "") {
    throw new Error("Delete patch operations must use an empty replacement.");
  }
  if (operation.operation !== "delete" && operation.replacement.length === 0) {
    throw new Error(`${operation.operation} patch operations require replacement text.`);
  }
  const first = prose.indexOf(operation.anchor_quote);
  const last = prose.lastIndexOf(operation.anchor_quote);
  if (first < 0) throw new Error(`Scene patch anchor was not found: ${operation.anchor_quote}`);
  if (first !== last) throw new Error(`Scene patch anchor must be unique and appears more than once: ${operation.anchor_quote}`);
  const anchorEnd = first + operation.anchor_quote.length;
  const start = operation.operation === "insert-after" ? anchorEnd : first;
  const end = operation.operation === "insert-before" || operation.operation === "insert-after" ? start : anchorEnd;
  return { ...operation, start, end };
}

function operationsConflict(left: ResolvedScenePatchOperation, right: ResolvedScenePatchOperation): boolean {
  const leftPoint = left.start === left.end;
  const rightPoint = right.start === right.end;
  if (leftPoint && rightPoint) return left.start === right.start;
  if (leftPoint) return left.start >= right.start && left.start <= right.end;
  if (rightPoint) return right.start >= left.start && right.start <= left.end;
  return left.start < right.end && right.start < left.end;
}

function validateAndApplyPatches(
  prose: string,
  output: ScenePatchOutput,
  findings: readonly RepairFinding[],
  maximumWords: number,
): { operations: ResolvedScenePatchOperation[]; repaired: string; affected: number; replacement: number } {
  const refs = new Set(findings.map((item) => item.ref));
  const resolved = output.operations.map((item) => resolveOperation(prose, item, refs));
  for (let left = 0; left < resolved.length; left += 1) {
    for (let right = left + 1; right < resolved.length; right += 1) {
      if (operationsConflict(resolved[left]!, resolved[right]!)) {
        throw new Error("Scene patch operations overlap or target the same insertion point.");
      }
    }
  }
  const addressed = new Set(resolved.flatMap((item) => item.finding_refs));
  const missingRefs = [...refs].filter((ref) => !addressed.has(ref));
  if (missingRefs.length) throw new Error(`Scene patch does not address every active finding: ${missingRefs.join(", ")}.`);

  const affected = resolved.reduce((sum, item) => sum + (item.end - item.start), 0);
  const replacement = resolved.reduce((sum, item) => sum + item.replacement.length, 0);
  const maximumAffected = Math.max(120, Math.floor(prose.length * 0.2));
  const maximumReplacement = Math.max(240, Math.floor(prose.length * 0.25));
  if (affected > maximumAffected || replacement > maximumReplacement) {
    throw new Error(`Scene patch exceeds bounded edit volume: affected ${affected}/${maximumAffected}, replacement ${replacement}/${maximumReplacement}.`);
  }

  let repaired = prose;
  for (const item of [...resolved].sort((left, right) => right.start - left.start || right.end - left.end)) {
    repaired = `${repaired.slice(0, item.start)}${item.replacement}${repaired.slice(item.end)}`;
  }
  repaired = repaired.trim();
  if (!repaired) throw new Error("Scene patch produced blank prose.");
  if (repaired === prose.trim()) throw new Error("Scene patch did not change the candidate prose.");
  const wordCount = countWords(repaired);
  if (wordCount > maximumWords) throw new Error(`Scene patch produced ${wordCount} words, above the ${maximumWords}-word scene safety ceiling.`);
  return { operations: resolved, repaired, affected, replacement };
}

export async function runSceneSpanRepair(input: RunSceneSpanRepairInput): Promise<RunSceneSpanRepairResult> {
  const state = requireState(input);
  const sourceDraft = requireSourceDraft(input, state);
  const findings = activeRepairFindings(input, sourceDraft);
  const runtime = RUNTIME_PROFILES[input.runtimeProfile];
  const modelProfile = resolveModelProfile(input.capsule, input.customModelProfile);
  if (modelProfile.id !== input.capsule.model_execution_profile) {
    throw new Error(`Model profile ${modelProfile.id} does not match capsule profile ${input.capsule.model_execution_profile}.`);
  }

  const sceneId = sourceDraft.scene_id;
  const attemptKey = `${sceneId}:span-repair`;
  const attempted = recordChapterExecutionAttempt(state, attemptKey, input.now);
  const patchAttempt = attempted.attempts[attemptKey]!;
  writeChapterExecutionState(input.root, attempted);

  const context = contextWithRepair(input.capsule, sourceDraft, findings, runtime.promptStyle);
  const prompt = patchPrompt();
  if (context.length > runtime.maxContextChars) throw new Error("Rendered scene repair context exceeds the runtime profile before inference.");
  if (prompt.length > runtime.maxPromptChars) throw new Error("Scene repair prompt exceeds the runtime profile before inference.");
  const budget = modelProfile.job_budgets["patch-spans"];
  const estimatedEvidenceTokens = Math.max(1, Math.ceil(Buffer.byteLength(context, "utf8") / 4));
  if (estimatedEvidenceTokens > budget.maximumEvidenceTokens) {
    throw new Error(`Scene repair context needs approximately ${estimatedEvidenceTokens} evidence tokens, above the ${budget.maximumEvidenceTokens}-token budget.`);
  }

  const callId = `${input.runId}-${sceneId}-PATCH-${patchAttempt}`;
  const request: QualityWorkerRequest = {
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: patchAttempt,
    pass: "revision",
    jobType: "patch-spans",
    prompt,
    context,
    decoding: modelProfile.decoding["patch-spans"],
    timeoutMs: 10 * 60_000,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.thinking ? { thinking: input.thinking } : {}),
  };
  const result = await input.worker.run(request, input.signal);
  const output = parseStructuredQualityArtifact(result.text, ScenePatchOutputSchema, "scene span patch output");
  const applied = validateAndApplyPatches(
    sourceDraft.prose,
    output,
    findings,
    Math.max(300, input.capsule.scene_contract.target_words.maximum * 2),
  );

  const repairedOutputHash = hashText(applied.repaired);
  const rawPatchOutputHash = hashText(result.text.trim());
  const capsuleHash = stableHash(input.capsule);
  const patchUsage: ModelCallReport = {
    ...result.usage,
    callId,
    stage: "drafting",
    chapter: state.chapter,
    sceneId,
    attempt: patchAttempt,
    pass: "revision",
    jobType: "patch-spans",
    contractHash: input.capsule.contract_hash,
    capsuleHash,
    includedRecordCount: input.capsule.records.length,
    promptHash: hashText(prompt),
    contextHash: hashText(context),
    outputHash: rawPatchOutputHash,
  };
  if (!Value.Check(ModelCallReportSchema, patchUsage)) throw new Error("Scene repair worker returned invalid usage telemetry.");

  const repairedDraftAttempt = input.sourceDraftAttempt + patchAttempt;
  const patch: ScenePatchArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: sceneId,
    source_draft_attempt: input.sourceDraftAttempt,
    repaired_draft_attempt: repairedDraftAttempt,
    source_output_hash: sourceDraft.output_hash,
    repaired_output_hash: repairedOutputHash,
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    story_index_hash: input.capsule.story_index_hash,
    patch_attempt: patchAttempt,
    operations: applied.operations,
    affected_character_count: applied.affected,
    replacement_character_count: applied.replacement,
    usage: patchUsage,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(ScenePatchArtifactSchema, patch)) throw new Error("Scene patch artifact failed schema validation.");

  const repairedUsage: ModelCallReport = { ...patchUsage, outputHash: repairedOutputHash };
  const repairedDraft: SceneDraftArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: sceneId,
    chapter_contract_id: sourceDraft.chapter_contract_id,
    chapter_contract_version: sourceDraft.chapter_contract_version,
    job_type: "patch-spans",
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    story_index_hash: input.capsule.story_index_hash,
    model_execution_profile: input.capsule.model_execution_profile,
    runtime_profile: input.runtimeProfile,
    attempt: repairedDraftAttempt,
    prose: applied.repaired,
    word_count: countWords(applied.repaired),
    output_hash: repairedOutputHash,
    usage: repairedUsage,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneDraftArtifactSchema, repairedDraft)) throw new Error("Repaired scene draft failed schema validation.");

  const patchPath = writeScenePatchArtifact(input.root, patch);
  const repairedDraftPath = writeSceneDraftArtifact(input.root, repairedDraft);
  const advanced = transitionChapterExecution(attempted, "deterministic-validation", input.now, sceneId);
  writeChapterExecutionState(input.root, advanced);
  return { patch, patchPath, repairedDraft, repairedDraftPath, state: advanced, request };
}

import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import {
  SceneValidationArtifactSchema,
  type SceneValidationArtifact,
  type SceneValidationFinding,
  type SceneValidationFindingCode,
} from "../domain/scene-validation-artifact.js";
import type { SceneDraftArtifact } from "../domain/scene-draft-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readSceneDraftArtifact } from "../infrastructure/scene-draft-artifact-store.js";
import { writeSceneValidationArtifact } from "../infrastructure/scene-validation-artifact-store.js";
import { transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface ValidateSceneDraftInput {
  root: string;
  runId: string;
  capsule: ActiveContextCapsule;
  attempt: number;
  now?: string;
}

export interface ValidateSceneDraftResult {
  artifact: SceneValidationArtifact;
  artifactPath: string;
  state: ChapterExecutionState;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function finding(code: SceneValidationFindingCode, message: string, severity: "blocker" | "warning" = "blocker"): SceneValidationFinding {
  return { code, severity, message };
}

function requireState(input: ValidateSceneDraftInput): ChapterExecutionState {
  if (!Number.isInteger(input.attempt) || input.attempt < 1) throw new Error("Scene validation requires a positive draft attempt.");
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "deterministic-validation") {
    throw new Error(`Scene validation requires deterministic-validation, current node is ${state.current_node}.`);
  }
  const sceneId = input.capsule.scene_contract.scene_id;
  if (state.current_scene_id !== sceneId) throw new Error(`Execution scene ${state.current_scene_id ?? "none"} does not match capsule scene ${sceneId}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot validate scene because the project hash changed.");
  if (state.contract_hash !== input.capsule.contract_hash) throw new Error("Cannot validate scene because the contract hash changed.");
  if (state.canon_snapshot_hash !== input.capsule.story_index_hash) throw new Error("Cannot validate scene because the canon snapshot or story index changed.");
  return state;
}

function requireDraft(input: ValidateSceneDraftInput, state: ChapterExecutionState): SceneDraftArtifact {
  const scene = input.capsule.scene_contract;
  const draft = readSceneDraftArtifact(input.root, input.runId, scene.scene_id, input.attempt);
  if (!draft) throw new Error(`Scene draft artifact not found for ${scene.scene_id} attempt ${input.attempt}.`);
  const issues: string[] = [];
  if (draft.run_id !== input.runId) issues.push("run ID");
  if (draft.chapter !== state.chapter) issues.push("chapter");
  if (draft.scene_id !== scene.scene_id) issues.push("scene ID");
  if (draft.chapter_contract_id !== scene.chapter_contract_id) issues.push("chapter contract ID");
  if (draft.chapter_contract_version !== scene.chapter_contract_version) issues.push("chapter contract version");
  if (draft.capsule_id !== input.capsule.capsule_id) issues.push("capsule ID");
  if (draft.contract_hash !== input.capsule.contract_hash) issues.push("contract hash");
  if (draft.story_index_hash !== input.capsule.story_index_hash) issues.push("story index hash");
  if (draft.model_execution_profile !== input.capsule.model_execution_profile) issues.push("model execution profile");
  if (draft.attempt !== input.attempt) issues.push("attempt");
  const outputHash = hashText(draft.prose);
  if (draft.output_hash !== outputHash) issues.push("output hash");
  if (draft.usage.outputHash !== draft.output_hash) issues.push("usage output hash");
  if (draft.word_count !== countWords(draft.prose)) issues.push("word count");
  if (issues.length) throw new Error(`Scene draft provenance or integrity mismatch: ${issues.join(", ")}.`);
  return draft;
}

function contentFindings(draft: SceneDraftArtifact, capsule: ActiveContextCapsule): SceneValidationFinding[] {
  const findings: SceneValidationFinding[] = [];
  const words = draft.word_count;
  const target = capsule.scene_contract.target_words;
  if (words < target.minimum) findings.push(finding("word-count-low", `Scene has ${words} words; minimum is ${target.minimum}.`));
  if (words > target.maximum) findings.push(finding("word-count-high", `Scene has ${words} words; maximum is ${target.maximum}.`));
  if (/```/.test(draft.prose)) findings.push(finding("markdown-fence", "Scene prose contains a Markdown code fence."));
  if (/^\s{0,3}#{1,6}\s+\S/m.test(draft.prose)) findings.push(finding("prose-heading", "Scene prose contains a Markdown heading."));
  if (/\b(?:here is|here's)\s+(?:the\s+)?(?:scene|draft)\b|\bas an ai\b|\bi (?:cannot|can't)\b|^\s*analysis\s*:/im.test(draft.prose)) {
    findings.push(finding("meta-commentary", "Scene output contains assistant or drafting commentary."));
  }
  if (/^\s*(?:chapter|scene)\s+(?:\d+|[ivxlcdm]+)\b/im.test(draft.prose)) {
    findings.push(finding("scene-boundary", "Scene output introduces an extra chapter or scene boundary."));
  }
  return findings;
}

export function validateSceneDraft(input: ValidateSceneDraftInput): ValidateSceneDraftResult {
  const state = requireState(input);
  const draft = requireDraft(input, state);
  const findings = contentFindings(draft, input.capsule);
  const blockerCount = findings.filter((item) => item.severity === "blocker").length;
  const warningCount = findings.filter((item) => item.severity === "warning").length;
  const passed = blockerCount === 0;
  const nextNode = passed ? "critic-review" : "span-repair";
  const artifact: SceneValidationArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: state.chapter,
    scene_id: draft.scene_id,
    draft_attempt: input.attempt,
    draft_output_hash: draft.output_hash,
    capsule_id: input.capsule.capsule_id,
    contract_hash: input.capsule.contract_hash,
    findings,
    blocker_count: blockerCount,
    warning_count: warningCount,
    passed,
    next_node: nextNode,
    created_at: timestamp(input.now),
  };
  if (!Value.Check(SceneValidationArtifactSchema, artifact)) throw new Error("Scene validation artifact failed schema validation.");
  const artifactPath = writeSceneValidationArtifact(input.root, artifact);
  const advanced = transitionChapterExecution(state, nextNode, input.now, draft.scene_id);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced };
}

import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import type { ChapterStitchArtifact } from "../domain/chapter-stitch-artifact.js";
import {
  ChapterValidationArtifactSchema,
  type ChapterValidationArtifact,
  type ChapterValidationFinding,
  type ChapterValidationFindingCode,
} from "../domain/chapter-validation-artifact.js";
import type { SceneAcceptanceArtifact } from "../domain/scene-acceptance-artifact.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readChapterStitchArtifact } from "../infrastructure/chapter-stitch-artifact-store.js";
import { readChapterValidationArtifact, writeChapterValidationArtifact } from "../infrastructure/chapter-validation-artifact-store.js";
import { readSceneAcceptanceArtifact } from "../infrastructure/scene-acceptance-artifact-store.js";
import { blockChapterExecution, transitionChapterExecution } from "./chapter-execution-machine.js";
import { projectStateHash } from "./project-hash.js";

export interface ValidateStitchedChapterInput {
  root: string;
  runId: string;
  chapter: number;
  now?: string;
}

export interface ValidateStitchedChapterResult {
  artifact: ChapterValidationArtifact;
  artifactPath: string;
  state: ChapterExecutionState;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function artifactHash(value: unknown): string {
  return hashText(JSON.stringify(value));
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function finding(code: ChapterValidationFindingCode, message: string, severity: "blocker" | "warning" = "blocker"): ChapterValidationFinding {
  return { code, severity, message };
}

function requireState(input: ValidateStitchedChapterInput): ChapterExecutionState {
  if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Chapter validation requires a positive chapter number.");
  const state = readChapterExecutionState(input.root, input.runId);
  if (!state) throw new Error(`Chapter execution state not found for ${input.runId}.`);
  if (state.status !== "active") throw new Error(`Chapter execution is ${state.status}, not active.`);
  if (state.current_node !== "chapter-validate") throw new Error(`Chapter validation requires chapter-validate, current node is ${state.current_node}.`);
  if (state.chapter !== input.chapter) throw new Error(`Execution chapter ${state.chapter} does not match requested chapter ${input.chapter}.`);
  if (state.project_hash !== projectStateHash(input.root)) throw new Error("Cannot validate chapter because the project hash changed.");
  return state;
}

function requireStitch(input: ValidateStitchedChapterInput, state: ChapterExecutionState): ChapterStitchArtifact {
  const stitch = readChapterStitchArtifact(input.root, input.runId, input.chapter);
  if (!stitch) throw new Error(`Stitched chapter artifact not found for chapter ${input.chapter}.`);
  if (stitch.run_id !== input.runId
    || stitch.chapter !== input.chapter
    || stitch.contract_hash !== state.contract_hash
    || stitch.story_index_hash !== state.canon_snapshot_hash
    || stitch.next_node !== "chapter-validate") {
    throw new Error("Chapter stitch provenance does not match the validation checkpoint.");
  }
  if (hashText(stitch.chapter_text) !== stitch.output_hash) throw new Error("Chapter stitch output hash integrity check failed.");
  if (stitch.word_count !== countWords(stitch.chapter_text)) throw new Error("Chapter stitch word-count integrity check failed.");
  if (stitch.scene_ids.length !== stitch.scenes.length
    || stitch.scene_ids.some((sceneId, index) => stitch.scenes[index]?.scene_id !== sceneId)) {
    throw new Error("Chapter stitch scene-order provenance is inconsistent.");
  }
  if (state.accepted_scene_ids.length !== stitch.scene_ids.length
    || stitch.scene_ids.some((sceneId, index) => state.accepted_scene_ids[index] !== sceneId)) {
    throw new Error("Chapter stitch scene order does not match accepted execution scenes.");
  }
  return stitch;
}

function requireAcceptances(input: ValidateStitchedChapterInput, stitch: ChapterStitchArtifact): SceneAcceptanceArtifact[] {
  return stitch.scenes.map((scene, index) => {
    const acceptance = readSceneAcceptanceArtifact(input.root, input.runId, scene.scene_id, scene.draft_attempt);
    if (!acceptance) throw new Error(`Scene acceptance artifact is missing for ${scene.scene_id}.`);
    if (acceptance.run_id !== input.runId
      || acceptance.chapter !== input.chapter
      || acceptance.scene_id !== scene.scene_id
      || acceptance.draft_attempt !== scene.draft_attempt
      || acceptance.draft_output_hash !== scene.draft_output_hash
      || acceptance.word_count !== scene.word_count
      || acceptance.contract_hash !== stitch.contract_hash
      || acceptance.story_index_hash !== stitch.story_index_hash) {
      throw new Error(`Scene acceptance provenance does not match stitched chapter for ${scene.scene_id}.`);
    }
    if (artifactHash(acceptance) !== scene.acceptance_artifact_hash) {
      throw new Error(`Scene acceptance artifact hash provenance failed for ${scene.scene_id}.`);
    }
    const expectedNext = stitch.scene_ids[index + 1] ?? null;
    const expectedNode = expectedNext ? "context-build" : "chapter-stitch";
    if (acceptance.next_scene_id !== expectedNext || acceptance.next_node !== expectedNode) {
      throw new Error(`Scene acceptance routing provenance is inconsistent for ${scene.scene_id}.`);
    }
    return acceptance;
  });
}

function contentFindings(stitch: ChapterStitchArtifact): ChapterValidationFinding[] {
  const findings: ChapterValidationFinding[] = [];
  const text = stitch.chapter_text;
  if (/```/.test(text)) findings.push(finding("markdown-fence", "Stitched chapter contains a Markdown code fence."));
  if (/^\s{0,3}#{1,6}\s+\S/m.test(text)) findings.push(finding("prose-heading", "Stitched chapter contains a Markdown heading."));
  if (/\b(?:here is|here's)\s+(?:the\s+)?(?:chapter|scene|draft)\b|\bas an ai\b|^\s*analysis\s*:/im.test(text)) {
    findings.push(finding("meta-commentary", "Stitched chapter contains assistant or drafting commentary."));
  }
  if (/^\s*(?:chapter|scene)\s+(?:\d+|[ivxlcdm]+)\b/im.test(text)) {
    findings.push(finding("scene-boundary", "Stitched chapter contains an extra chapter or scene boundary."));
  }
  if (text !== text.trim() || /\n{3,}/.test(text)) {
    findings.push(finding("boundary-whitespace", "Stitched chapter contains invalid leading, trailing, or repeated scene-boundary whitespace."));
  }
  for (const mutation of stitch.accepted_mutations) {
    if (!text.includes(mutation.evidence_quote)) {
      findings.push(finding("mutation-evidence-missing", `Accepted mutation ${mutation.record_id}.${mutation.field} has evidence absent from the stitched chapter.`));
    }
  }
  return findings;
}

export function validateStitchedChapter(input: ValidateStitchedChapterInput): ValidateStitchedChapterResult {
  const state = requireState(input);
  const stitch = requireStitch(input, state);
  const acceptances = requireAcceptances(input, stitch);
  const reconstructedText = acceptances.map((item) => item.accepted_prose).join("\n\n");
  if (reconstructedText !== stitch.chapter_text) throw new Error("Chapter stitch reconstruction integrity check failed.");
  const reconstructedMutations = acceptances.flatMap((item) => item.accepted_mutations);
  if (JSON.stringify(reconstructedMutations) !== JSON.stringify(stitch.accepted_mutations)) {
    throw new Error("Chapter stitch accepted-mutation provenance check failed.");
  }
  if (readChapterValidationArtifact(input.root, input.runId, input.chapter)) {
    throw new Error(`Chapter validation artifact already exists for chapter ${input.chapter}.`);
  }

  const findings = contentFindings(stitch);
  const blockerCount = findings.filter((item) => item.severity === "blocker").length;
  const warningCount = findings.filter((item) => item.severity === "warning").length;
  const passed = blockerCount === 0;
  const artifact: ChapterValidationArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: input.chapter,
    stitch_artifact_hash: artifactHash(stitch),
    stitch_output_hash: stitch.output_hash,
    contract_hash: stitch.contract_hash,
    story_index_hash: stitch.story_index_hash,
    scene_ids: [...stitch.scene_ids],
    findings,
    blocker_count: blockerCount,
    warning_count: warningCount,
    passed,
    next_action: passed ? "chapter-commit" : "blocked",
    created_at: timestamp(input.now),
  };
  if (!Value.Check(ChapterValidationArtifactSchema, artifact)) throw new Error("Chapter validation artifact failed schema validation.");
  const artifactPath = writeChapterValidationArtifact(input.root, artifact);
  const advanced = passed
    ? transitionChapterExecution(state, "chapter-commit", input.now, state.current_scene_id ?? undefined)
    : blockChapterExecution(state, {
      code: "schema-failure",
      message: `Chapter ${input.chapter} failed deterministic validation.`,
      recordIds: [...new Set(findings.filter((item) => item.severity === "blocker").map((item) => item.code))],
    }, input.now);
  writeChapterExecutionState(input.root, advanced);
  return { artifact, artifactPath, state: advanced };
}

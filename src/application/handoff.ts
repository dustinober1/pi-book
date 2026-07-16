import { join } from "node:path";
import type { BookState, ProjectState } from "../domain/schemas.js";
import type { ProjectStateV14 } from "../domain/v1-4-project-schema.js";
import {
  TasteProfileSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
  defaultTasteProfile,
  defaultVoiceExperimentIndex,
  defaultVoiceGuardrails,
  type TasteProfile,
  type VoiceExperimentFile,
  type VoiceExperimentIndex,
  type VoiceGuardrails,
} from "../domain/v1-3-schemas.js";
import { readText } from "../infrastructure/files.js";
import { gitState, type GitCheckpointResult } from "../infrastructure/git.js";
import { applyTransaction, type FileChange, type TransactionFileChange } from "../infrastructure/transaction.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { voiceSafetyFindings } from "./influence-palette.js";
import { projectStateHash } from "./project-hash.js";
import { getProjectStatus, type ProjectStatus } from "./status.js";
import { voiceExperimentFindings, type VoiceExperimentAssetMap } from "./voice-experiment.js";

export interface HandoffOptions {
  lastAction?: string;
  checkpoint?: boolean;
}

export interface GuidedProjectEventResult {
  changed: string[];
  git: GitCheckpointResult;
  status: ProjectStatus;
}

function normalizedPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function readFirstPaths(project: ProjectState, book: BookState): string[] {
  const base = `books/${book.book_id}`;
  const paths = ["STATUS.md", "HANDOFF.md", "series/voice-profile.md", "series/canon.yaml", "series/story-threads.yaml"];
  if (["book-planning", "chapter-queue", "drafting", "act-review", "revision", "manuscript-review", "canon-lock", "packaging", "complete"].includes(project.current_stage)) {
    paths.push(`${base}/BOOK.yaml`, `${base}/book-bible.md`, `${base}/plot-grid.yaml`, `${base}/remarkability.yaml`);
  }
  if (["drafting", "act-review", "revision", "manuscript-review", "canon-lock", "packaging", "complete"].includes(project.current_stage)) {
    paths.push(`${base}/chapter-queue.yaml`, `${base}/continuity-delta.yaml`, `${base}/revision-tickets.yaml`);
  }
  return paths;
}

function overlayText(root: string, changes: TransactionFileChange[], path: string): string | null {
  const changed = changes.find((item) => normalizedPath(item.path) === path);
  if (changed) return typeof changed.content === "string" ? changed.content : null;
  return readText(join(root, path));
}

function tasteOverlay(root: string, changes: TransactionFileChange[]): TasteProfile {
  const tasteText = overlayText(root, changes, "series/taste-profile.yaml");
  return tasteText ? parseYaml<TasteProfile>(tasteText, TasteProfileSchema, "series/taste-profile.yaml") : defaultTasteProfile();
}

function guardrailsOverlay(root: string, changes: TransactionFileChange[]): VoiceGuardrails {
  const guardrailsText = overlayText(root, changes, "series/voice-guardrails.yaml");
  return guardrailsText
    ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml")
    : defaultVoiceGuardrails();
}

function experimentIndexOverlay(root: string, changes: TransactionFileChange[]): VoiceExperimentIndex {
  const indexText = overlayText(root, changes, "series/voice-experiments/index.yaml");
  return indexText
    ? parseYaml<VoiceExperimentIndex>(indexText, VoiceExperimentIndexSchema, "series/voice-experiments/index.yaml")
    : defaultVoiceExperimentIndex();
}

function validateVoiceOriginality(root: string, changes: TransactionFileChange[], taste: TasteProfile, guardrails: VoiceGuardrails): void {
  const watched = new Set(["series/taste-profile.yaml", "series/voice-guardrails.yaml", "series/voice-profile.md"]);
  if (!changes.some((item) => watched.has(normalizedPath(item.path)))) return;

  const voiceProfile = overlayText(root, changes, "series/voice-profile.md") ?? "";
  const findings = voiceSafetyFindings({ taste, voiceProfile, guardrails });
  if (findings.length) {
    throw new Error(`Voice originality validation blocked the guided event:\n${findings.map((item) => `- ${item.message}`).join("\n")}`);
  }
}

function expectedExperimentPaths(directory: string, experiment: VoiceExperimentFile): string[] {
  return [
    `${directory}/source-scene.md`,
    ...experiment.variants.map((variant) => `${directory}/variant-${variant.id.toLowerCase()}.md`),
    ...(experiment.baseline_path !== null ? [`${directory}/baseline.md`] : []),
  ];
}

function actualExperimentPaths(experiment: VoiceExperimentFile): string[] {
  return [
    experiment.source_scene_path,
    ...experiment.variants.map((variant) => variant.path),
    ...(experiment.baseline_path !== null ? [experiment.baseline_path] : []),
  ];
}

function validateExperimentPathContract(directory: string, experiment: VoiceExperimentFile): void {
  const ids = experiment.variants.map((variant) => variant.id);
  const expectedOrder = (["A", "B", "C"] as const).slice(0, ids.length);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== expectedOrder[index])) {
    throw new Error(`Voice experiment ${experiment.id} variants must be unique and appear in A, B, C order.`);
  }
  const expected = expectedExperimentPaths(directory, experiment);
  const actual = actualExperimentPaths(experiment);
  if (expected.length !== actual.length || expected.some((path, index) => actual[index] !== path)) {
    throw new Error(`Voice experiment ${experiment.id} assets must use the canonical paths inside ${directory}/.`);
  }
}

function validateExperimentDirectory(
  root: string,
  changes: TransactionFileChange[],
  taste: TasteProfile,
  directory: string,
  directoryId: string,
): VoiceExperimentFile {
  const experimentPath = `${directory}/experiment.yaml`;
  const experimentText = overlayText(root, changes, experimentPath);
  if (!experimentText) throw new Error(`Voice experiment validation requires ${experimentPath}.`);
  const experiment = parseYaml<VoiceExperimentFile>(experimentText, VoiceExperimentFileSchema, experimentPath);
  if (experiment.id !== directoryId) {
    throw new Error(`Voice experiment ${experiment.id} must be stored under series/voice-experiments/${experiment.id}/.`);
  }
  validateExperimentPathContract(directory, experiment);

  const assets: VoiceExperimentAssetMap = {};
  for (const assetPath of actualExperimentPaths(experiment)) {
    const content = overlayText(root, changes, assetPath);
    if (content !== null) assets[assetPath] = content;
  }

  const findings = voiceExperimentFindings(experiment, assets, taste);
  if (findings.length) {
    throw new Error(`Voice experiment validation blocked ${experiment.id}:\n${findings.map((item) => `- ${item.message}`).join("\n")}`);
  }
  return experiment;
}

function validateVoiceExperiments(
  root: string,
  changes: TransactionFileChange[],
  taste: TasteProfile,
  guardrails: VoiceGuardrails,
  index: VoiceExperimentIndex,
): void {
  const changedPaths = changes.map((item) => normalizedPath(item.path));
  const directoryPattern = /^(series\/voice-experiments\/(VE-[0-9]{3}))\/[^/]+\.(?:md|yaml)$/i;
  const indexedPathPattern = /^(series\/voice-experiments\/(VE-[0-9]{3}))\/experiment\.yaml$/;
  const changedDirectories = new Map<string, string>();
  for (const path of changedPaths) {
    const match = path.match(directoryPattern);
    if (match?.[1] && match[2]) changedDirectories.set(match[1], match[2].toUpperCase());
  }

  const selectionWatched = changedPaths.some((path) => [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
  ].includes(path));
  if (selectionWatched) {
    for (const item of index.experiments) {
      const match = item.path.match(indexedPathPattern);
      if (!match?.[1] || !match[2] || match[2] !== item.id) {
        throw new Error(`Voice experiment index entry ${item.id} must point to series/voice-experiments/${item.id}/experiment.yaml.`);
      }
      changedDirectories.set(match[1], item.id);
    }
  }

  const validated = new Map<string, VoiceExperimentFile>();
  for (const [directory, directoryId] of changedDirectories) {
    validated.set(directoryId, validateExperimentDirectory(root, changes, taste, directory, directoryId));
  }

  if (!selectionWatched) return;

  for (const item of index.experiments) {
    const experiment = validated.get(item.id);
    if (!experiment) throw new Error(`Voice experiment index entry ${item.id} could not be validated.`);
    if (experiment.status !== item.status) {
      throw new Error(`Voice experiment index status for ${item.id} does not match its experiment record.`);
    }
    if (experiment.baseline_hash !== item.baseline_hash) {
      throw new Error(`Voice experiment index baseline hash for ${item.id} does not match its experiment record.`);
    }
  }

  const selected = taste.opening_experiment;
  if (selected.status === "accepted") {
    const experiment = validated.get(selected.experiment_id);
    if (!experiment || experiment.status !== "accepted") {
      throw new Error(`Taste profile selects ${selected.experiment_id}, but the experiment is not accepted in the index.`);
    }
    if (selected.baseline_path !== experiment.baseline_path) {
      throw new Error(`Taste profile baseline path for ${selected.experiment_id} does not match the accepted experiment.`);
    }
    if (guardrails.baseline.path !== experiment.baseline_path || guardrails.baseline.content_hash !== experiment.baseline_hash) {
      throw new Error(`Voice guardrails baseline does not match accepted experiment ${selected.experiment_id}.`);
    }
  } else if (guardrails.baseline.path !== null || guardrails.baseline.content_hash !== null) {
    throw new Error("Voice guardrails cannot select a baseline until the taste profile accepts an experiment.");
  }
}

function validateGuidedVoiceEvidence(root: string, changes: TransactionFileChange[]): void {
  const taste = tasteOverlay(root, changes);
  const guardrails = guardrailsOverlay(root, changes);
  const index = experimentIndexOverlay(root, changes);
  validateVoiceOriginality(root, changes, taste, guardrails);
  validateVoiceExperiments(root, changes, taste, guardrails, index);
}

export function renderHandoff(project: ProjectState, book: BookState, status: ProjectStatus, options: HandoffOptions = {}, root?: string): string {
  const git = root ? gitState(root) : { initialized: false, branch: "", dirty: 0 };
  const branch = git.initialized ? (git.branch || "detached") : "not-initialized";
  const stateHash = root ? projectStateHash(root) : "unavailable";
  const gate = project.next_gate ? `${project.next_gate} (${project.gates[project.next_gate] ?? "unknown"})` : "none";
  const protectedFacts = [
    `${project.approvals.length} writer approval${project.approvals.length === 1 ? "" : "s"} recorded`,
    book.canon_locked ? `${book.book_id} canon is locked` : `${book.book_id} canon remains provisional`,
    `Current workflow stage is ${project.current_stage}`,
  ];
  const run = (project as ProjectStateV14).automation.active_run;
  const runLines = run ? [
    `- Run: ${run.id}`,
    `- Status: ${run.status}`,
    `- Target: ${run.target}`,
    `- Current action: ${run.currentAction}`,
    `- Progress: ${run.completedEventKeys.length} completed event${run.completedEventKeys.length === 1 ? "" : "s"}`,
    `- Stop reason: ${run.stopReason ?? "none"}`,
    ...(run.status === "paused" ? ["- Exact resume command: `/novel-run --resume`"] : []),
    ...(run.status === "active" ? ["- Pause command: `/novel-run --pause`"] : []),
  ] : [];
  const continuation = [
    `Continue the Novel Forge project ${project.project_name}.`,
    `The active book is ${book.book_id} (${book.profile}) at stage ${project.current_stage}.`,
    "Read STATUS.md and HANDOFF.md first, then follow the exact recommended action through /novel.",
    `Do not edit PROJECT.yaml, BOOK.yaml, STATUS.md, or HANDOFF.md directly and do not bypass the active human gate ${gate}.`,
  ].join(" ");

  return [
    "# Novel Forge Handoff",
    "",
    `- Project: ${project.project_name}`,
    `- Active book: ${book.book_id}`,
    `- Profile: ${book.profile}`,
    `- Stage: ${project.current_stage}`,
    `- Git reference: ${branch} @ HEAD`,
    `- Project state hash: ${stateHash}`,
    `- Last completed action: ${options.lastAction ?? "Guidance refreshed"}`,
    `- Active gate or blocker: ${project.next_gate ? gate : status.primaryBlocker ?? "none"}`,
    `- Current chapter: ${book.current_chapter}`,
    `- Manuscript words: ${book.actual_words}`,
    ...(runLines.length ? ["", "## Automation run", "", ...runLines] : []),
    "",
    "## Locked and protected state",
    "",
    ...protectedFacts.map((item) => `- ${item}`),
    "",
    "## Read first",
    "",
    ...readFirstPaths(project, book).map((path) => `- ${path}`),
    "",
    "## Do not edit directly",
    "",
    "- PROJECT.yaml",
    `- books/${book.book_id}/BOOK.yaml`,
    "- STATUS.md",
    "- HANDOFF.md",
    "",
    "## Exact next action",
    "",
    "Run exactly: `/novel`",
    "",
    `Reason: ${status.headline}`,
    "",
    "## Continuation prompt",
    "",
    "```text",
    continuation,
    "```",
    "",
  ].join("\n");
}

function buildGuidance(root: string, options: HandoffOptions = {}, gitDirtyOverride?: number): { status: ProjectStatus; changes: FileChange[] } {
  const project = readProject(root);
  const book = readBook(root);
  const status = getProjectStatus(root, { ...(gitDirtyOverride !== undefined ? { gitDirtyOverride } : {}) });
  return {
    status,
    changes: [
      { path: "STATUS.md", content: status.markdown },
      { path: "HANDOFF.md", content: renderHandoff(project, book, status, options, root) },
    ],
  };
}

function checkpointMessage(lastAction: string): string {
  return `Novel Forge: ${lastAction.trim().replace(/^[A-Z]/, (letter) => letter.toLowerCase())}`;
}

export function refreshGuidance(root: string, options: HandoffOptions = {}): ProjectStatus {
  const guidance = buildGuidance(root, options);
  const project = readProject(root);
  const shouldCheckpoint = options.checkpoint ?? Boolean(options.lastAction);
  applyTransaction(root, guidance.changes, {
    gitCheckpoint: shouldCheckpoint && project.automation.git_checkpoints,
    ...(shouldCheckpoint && options.lastAction ? { commitMessage: checkpointMessage(options.lastAction) } : {}),
  });
  return guidance.status;
}

export function applyGuidedProjectEvent(root: string, changes: TransactionFileChange[], message: string, options: HandoffOptions = {}): GuidedProjectEventResult {
  validateGuidedVoiceEvidence(root, changes);
  const checkpointEnabled = readProject(root).automation.git_checkpoints;
  const preexistingDirty = gitState(root).dirty;
  let finalStatus: ProjectStatus | null = null;
  const transaction = applyTransaction(root, changes, {
    gitCheckpoint: checkpointEnabled,
    commitMessage: message,
    deriveChanges() {
      const guidance = buildGuidance(root, { lastAction: options.lastAction ?? message.replace(/^Novel Forge:\s*/, "") }, preexistingDirty);
      finalStatus = guidance.status;
      return guidance.changes;
    },
  });
  const git = transaction.git ?? { initialized: gitState(root).initialized, committed: false, message: "Git checkpoints disabled." };
  if (!finalStatus) throw new Error("Novel Forge could not derive the final project status.");
  return { changed: transaction.changed, git, status: finalStatus };
}

export function guidancePaths(root: string): string[] {
  return [join(root, "STATUS.md"), join(root, "HANDOFF.md")];
}

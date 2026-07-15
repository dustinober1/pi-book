import { join } from "node:path";
import type { BookState, ProjectState } from "../domain/schemas.js";
import {
  TasteProfileSchema,
  VoiceExperimentFileSchema,
  VoiceGuardrailsSchema,
  defaultTasteProfile,
  defaultVoiceGuardrails,
  type TasteProfile,
  type VoiceExperimentFile,
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

function validateVoiceOriginality(root: string, changes: TransactionFileChange[], taste: TasteProfile): void {
  const watched = new Set(["series/taste-profile.yaml", "series/voice-guardrails.yaml", "series/voice-profile.md"]);
  if (!changes.some((item) => watched.has(normalizedPath(item.path)))) return;

  const guardrailsText = overlayText(root, changes, "series/voice-guardrails.yaml");
  const guardrails = guardrailsText
    ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml")
    : defaultVoiceGuardrails();
  const voiceProfile = overlayText(root, changes, "series/voice-profile.md") ?? "";
  const findings = voiceSafetyFindings({ taste, voiceProfile, guardrails });
  if (findings.length) {
    throw new Error(`Voice originality validation blocked the guided event:\n${findings.map((item) => `- ${item.message}`).join("\n")}`);
  }
}

function validateVoiceExperiments(root: string, changes: TransactionFileChange[], taste: TasteProfile): void {
  const directoryPattern = /^(series\/voice-experiments\/(VE-[0-9]{3}))\/[^/]+\.(?:md|yaml)$/i;
  const changedDirectories = new Map<string, string>();
  for (const change of changes) {
    const match = normalizedPath(change.path).match(directoryPattern);
    if (match?.[1] && match[2]) changedDirectories.set(match[1], match[2].toUpperCase());
  }

  for (const [directory, directoryId] of changedDirectories) {
    const experimentPath = `${directory}/experiment.yaml`;
    const experimentText = overlayText(root, changes, experimentPath);
    if (!experimentText) throw new Error(`Voice experiment validation requires ${experimentPath}.`);
    const experiment = parseYaml<VoiceExperimentFile>(experimentText, VoiceExperimentFileSchema, experimentPath);
    if (experiment.id !== directoryId) {
      throw new Error(`Voice experiment ${experiment.id} must be stored under series/voice-experiments/${experiment.id}/.`);
    }

    const assets: VoiceExperimentAssetMap = {};
    const referencedPaths = [
      experiment.source_scene_path,
      ...experiment.variants.map((variant) => variant.path),
      ...(experiment.baseline_path ? [experiment.baseline_path] : []),
    ];
    for (const assetPath of referencedPaths) {
      const content = overlayText(root, changes, assetPath);
      if (content !== null) assets[assetPath] = content;
    }

    const findings = voiceExperimentFindings(experiment, assets, taste);
    if (findings.length) {
      throw new Error(`Voice experiment validation blocked ${experiment.id}:\n${findings.map((item) => `- ${item.message}`).join("\n")}`);
    }
  }
}

function validateGuidedVoiceEvidence(root: string, changes: TransactionFileChange[]): void {
  const taste = tasteOverlay(root, changes);
  validateVoiceOriginality(root, changes, taste);
  validateVoiceExperiments(root, changes, taste);
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

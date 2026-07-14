import { join } from "node:path";
import type { BookState, ProjectState } from "../domain/schemas.js";
import { gitState, type GitCheckpointResult } from "../infrastructure/git.js";
import { applyTransaction, type FileChange } from "../infrastructure/transaction.js";
import { readBook, readProject } from "../project/store.js";
import { projectStateHash } from "./project-hash.js";
import { getProjectStatus, type ProjectStatus } from "./status.js";

export interface HandoffOptions {
  lastAction?: string;
}

export interface GuidedProjectEventResult {
  changed: string[];
  git: GitCheckpointResult;
  status: ProjectStatus;
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

function buildGuidance(root: string, options: HandoffOptions = {}): { status: ProjectStatus; changes: FileChange[] } {
  const project = readProject(root);
  const book = readBook(root);
  const status = getProjectStatus(root);
  return {
    status,
    changes: [
      { path: "STATUS.md", content: status.markdown },
      { path: "HANDOFF.md", content: renderHandoff(project, book, status, options, root) },
    ],
  };
}

export function refreshGuidance(root: string, options: HandoffOptions = {}): ProjectStatus {
  const guidance = buildGuidance(root, options);
  applyTransaction(root, guidance.changes, { gitCheckpoint: false });
  return guidance.status;
}

export function applyGuidedProjectEvent(root: string, changes: FileChange[], message: string, options: HandoffOptions = {}): GuidedProjectEventResult {
  const checkpointEnabled = readProject(root).automation.git_checkpoints;
  let finalStatus: ProjectStatus | null = null;
  const transaction = applyTransaction(root, changes, {
    gitCheckpoint: checkpointEnabled,
    commitMessage: message,
    deriveChanges() {
      const guidance = buildGuidance(root, { lastAction: options.lastAction ?? message.replace(/^Novel Forge:\s*/, "") });
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
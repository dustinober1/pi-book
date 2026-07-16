import { existsSync } from "node:fs";
import { join } from "node:path";
import { listChapterFiles } from "../infrastructure/files.js";
import { readBook, readProject } from "../project/store.js";
import { buildNextBookInheritanceProposal } from "./next-book.js";
import { buildPackagingChecklist } from "./package-checklist.js";
import { projectStateHash } from "./project-hash.js";
import { getProjectStatus } from "./status.js";
import type { WizardActionRegistry, WizardProposalEnvelope, WizardWorkflow } from "../wizard/types.js";

export interface WizardWorkflowHandler {
  snapshot?(): Promise<unknown> | unknown;
  preview?(action: string, payload: unknown): Promise<unknown> | unknown;
  apply?(envelope: WizardProposalEnvelope): Promise<unknown> | unknown;
}

export type WizardWorkflowHandlers = Partial<Record<WizardWorkflow, WizardWorkflowHandler>>;

function projectSnapshot(root: string) {
  const project = readProject(root);
  const book = readBook(root);
  const status = getProjectStatus(root);
  return {
    project: {
      name: project.project_name,
      type: project.project_type,
      active_book: project.active_book,
      stage: project.current_stage,
      next_gate: project.next_gate,
      profile: project.default_profile,
      novel_forge_version: project.novel_forge_version ?? "",
      state_hash: projectStateHash(root),
    },
    book: {
      id: book.book_id,
      title: book.title,
      profile: book.profile,
      status: book.status,
      current_chapter: book.current_chapter,
      target_words: book.target_words,
      actual_words: book.actual_words,
      canon_locked: book.canon_locked,
    },
    decision: {
      headline: status.headline,
      reason: status.reason,
      recommended_command: status.recommendedCommand,
      primary_blocker: status.primaryBlocker,
    },
  };
}

function workflowSnapshot(root: string, workflow: Exclude<WizardWorkflow, "research">): unknown {
  const base = projectSnapshot(root);
  const bookId = base.book.id;
  if (workflow === "adoption") {
    const chapters = listChapterFiles(join(root, "books", bookId));
    return { ...base, workflow: { id: workflow, eligible: chapters.length === 0, existing_chapter_count: chapters.length, accepted_sources: ["docx", "epub", "markdown", "text", "chapter-directory"] } };
  }
  if (workflow === "readers") {
    return { ...base, workflow: { id: workflow, v2_index_exists: existsSync(join(root, "books", bookId, "reader-kits", "index.yaml")), legacy_state_exists: existsSync(join(root, "books", bookId, "reader-experiments.yaml")) } };
  }
  if (workflow === "packaging") {
    return { ...base, workflow: { id: workflow, checklist: buildPackagingChecklist(root) } };
  }
  let proposal: unknown;
  try { proposal = buildNextBookInheritanceProposal(root); }
  catch (error) { proposal = { eligible: false, reason: error instanceof Error ? error.message : "Next book is not available." }; }
  return { ...base, workflow: { id: workflow, proposal } };
}

export function createWizardRegistry(root: string, handlers: WizardWorkflowHandlers = {}): WizardActionRegistry {
  return {
    snapshot(workflow) {
      const handler = handlers[workflow];
      if (handler?.snapshot) return { ...projectSnapshot(root), workflow: handler.snapshot() };
      if (workflow === "research") throw new Error("research snapshot is not available yet.");
      return workflowSnapshot(root, workflow);
    },
    preview(workflow, action, payload) {
      const handler = handlers[workflow];
      if (!handler?.preview) throw new Error(`${workflow} preview action ${action} is not available yet.`);
      return handler.preview(action, payload);
    },
    apply(envelope) {
      const project = readProject(root);
      if (envelope.expected_stage !== project.current_stage) throw new Error(`Stale wizard stage: expected ${envelope.expected_stage}, current ${project.current_stage}.`);
      if (envelope.expected_project_hash !== projectStateHash(root)) throw new Error("Stale wizard project hash; reload the workflow before applying.");
      const handler = handlers[envelope.workflow];
      if (!handler?.apply) throw new Error(`${envelope.workflow} apply action ${envelope.action} is not available yet.`);
      return handler.apply(envelope);
    },
  };
}

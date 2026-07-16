import { join } from "node:path";
import { buildChapterContext } from "../context/context-builder.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5, type RevisionTicketsPhase5 } from "../domain/v1-3-audit-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject, readTickets } from "../project/store.js";
import { openBlockingTickets } from "../review/review.js";
import { getProjectStatus } from "./status.js";
import { approveGate } from "./gates.js";
import { assertOperationAllowed } from "./authorization.js";
import { automationDraftPrompt, bookPlanPrompt, canonLockPrompt, draftPrompt, guardrailPromotionPrompt, packagePrompt, queuePrompt, reviewPrompt, revisionPrompt, seriesPlanPrompt, voiceAuditPrompt, voicePlanPrompt } from "./prompts.js";
import { compileActiveBook } from "./package.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { promotionCandidates } from "./revision-learning.js";
import { nextVoiceAuditRequirement } from "./voice-drift.js";

export interface RunOptions { approve?: string; until?: string; maxChapters?: number; noProse?: boolean; reviewOnly?: boolean; stopOnWarning?: boolean }
export interface RunDecision { action: string; prompt: string | null; message: string }

function readStrategy(root: string): BookStrategyPhase5 | null {
  const book = readBook(root);
  const path = join(root, "books", book.book_id, "book-strategy.yaml");
  const text = readText(path);
  return text ? parseYaml<BookStrategyPhase5>(text, BookStrategyPhase5Schema, "book-strategy.yaml") : null;
}

function nonPendingGateBlockers(blockers: readonly string[]): string[] {
  return blockers.filter((blocker) => !blocker.startsWith("Human approval required:"));
}

export function approveProjectGate(root: string, gate: string, note = ""): RunDecision {
  const project = approveGate(root, structuredClone(readProject(root)), gate, note);
  applyGuidedProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], `Novel Forge: approve ${gate}`, { lastAction: `Approved ${gate}` });
  return { action: "approved", prompt: null, message: `Approved ${gate}. Current stage: ${project.current_stage}.` };
}

export function rejectProjectGate(root: string, gate: string, note: string): RunDecision {
  const project = structuredClone(readProject(root));
  if (project.next_gate !== gate) throw new Error(`Gate ${gate} is not active.`);
  if (project.gates[gate] !== "pending") throw new Error(`Gate ${gate} must be pending before changes can be requested.`);
  if (!note.trim()) throw new Error("Requesting changes requires a writer note.");
  project.gates[gate] = "rejected";
  project.next_gate = gate;
  const book = readBook(root);
  const path = `books/${book.book_id}/gate-decisions.md`;
  const existing = readText(join(root, path))?.trim() ?? "# Gate Decisions";
  const entry = [existing, "", `## ${new Date().toISOString()} — ${gate}`, "", "Decision: changes requested", "", note.trim(), ""].join("\n");
  applyGuidedProjectEvent(root, [
    { path: "PROJECT.yaml", content: stringifyYaml(project) },
    { path, content: entry },
  ], `Novel Forge: reject ${gate}`, { lastAction: `Requested changes to ${gate}` });
  return { action: "rejected", prompt: null, message: `Changes requested for ${gate}. The gate remains active until repaired and approved.` };
}

export function decideNextRun(root: string, options: RunOptions = {}): RunDecision {
  if (options.approve) return approveProjectGate(root, options.approve);

  const status = getProjectStatus(root);
  const hardBlockers = nonPendingGateBlockers(status.blockers);
  if (hardBlockers.length) return { action: "blocked", prompt: null, message: hardBlockers[0] ?? "Project is blocked." };
  if (options.stopOnWarning && status.warnings.length) return { action: "warning-stop", prompt: null, message: status.warnings[0] ?? "Project warning." };

  const dueAudit = nextVoiceAuditRequirement(root);
  if (dueAudit) {
    return { action: "voice-audit", prompt: voiceAuditPrompt(root, dueAudit), message: `Queued required voice audit ${dueAudit.milestone_ref}.` };
  }

  if (status.blockers.length) return { action: "blocked", prompt: null, message: status.blockers[0] ?? "Project is blocked." };
  const project = readProject(root);
  if (options.reviewOnly) {
    if (project.current_stage === "act-review") return { action: "review", prompt: reviewPrompt(root, "act"), message: "Queued act review." };
    if (project.current_stage === "manuscript-review") return { action: "review", prompt: reviewPrompt(root, "manuscript"), message: "Queued manuscript review." };
    return { action: "blocked", prompt: null, message: `Review-only mode is not available during ${project.current_stage}.` };
  }

  const candidates = promotionCandidates(readTickets(root) as RevisionTicketsPhase5, readStrategy(root) ?? undefined);
  if (candidates.length) {
    const candidate = candidates[0]!;
    return { action: "guardrail-promotion", prompt: guardrailPromotionPrompt(root, candidate), message: `Queued writer decision for recurring pattern ${candidate.pattern_key}.` };
  }

  switch (project.current_stage) {
    case "voice-intake": return { action: "voice", prompt: voicePlanPrompt(root), message: "Queued voice intake." };
    case "series-planning": return { action: "series-plan", prompt: seriesPlanPrompt(root), message: "Queued series plan." };
    case "book-planning": return { action: "book-plan", prompt: bookPlanPrompt(root), message: "Queued book plan." };
    case "chapter-queue": return { action: "queue", prompt: queuePrompt(root), message: "Queued chapter packets." };
    case "drafting": {
      if (options.noProse) return { action: "queue", prompt: queuePrompt(root), message: "No-prose mode queued packet maintenance." };
      const maxChapters = options.maxChapters ?? project.automation.max_chapters_per_run;
      return { action: "bounded-draft", prompt: automationDraftPrompt(root, maxChapters, options.until), message: `Queued a bounded drafting run of up to ${maxChapters} chapter(s).` };
    }
    case "act-review": return { action: "review", prompt: reviewPrompt(root, "act"), message: "Queued act review." };
    case "revision": {
      const tickets = openBlockingTickets(readTickets(root));
      return { action: "revise", prompt: revisionPrompt(root, tickets.slice(0, 3)), message: `Queued ${Math.min(3, tickets.length)} blocking ticket(s).` };
    }
    case "manuscript-review": return { action: "review", prompt: reviewPrompt(root, "manuscript"), message: "Queued manuscript review." };
    case "canon-lock": return { action: "canon-lock", prompt: canonLockPrompt(root), message: "Queued canon lock." };
    case "packaging": {
      const compiled = compileActiveBook(root);
      return { action: "package", prompt: packagePrompt(root), message: `Compiled ${compiled.chapters} chapters (${compiled.words} words) and queued packaging.` };
    }
    case "complete": return { action: "complete", prompt: null, message: "Project is complete." };
  }
}

export function directDraftDecision(root: string, chapter?: number): RunDecision {
  const project = readProject(root);
  try { assertOperationAllowed(project, "draft"); } catch (error) { return { action: "blocked", prompt: null, message: error instanceof Error ? error.message : String(error) }; }
  const status = getProjectStatus(root);
  const hardBlockers = nonPendingGateBlockers(status.blockers);
  if (hardBlockers.length) return { action: "blocked", prompt: null, message: hardBlockers[0] ?? "Project is blocked." };
  const dueAudit = nextVoiceAuditRequirement(root);
  if (dueAudit) return { action: "blocked", prompt: null, message: `Required voice audit ${dueAudit.milestone_ref} must be completed through /novel before drafting.` };
  if (status.blockers.length) return { action: "blocked", prompt: null, message: status.blockers[0] ?? "Project is blocked." };
  const context = buildChapterContext(root, chapter);
  return { action: "draft", prompt: draftPrompt(context), message: `Queued Chapter ${context.packet.chapter}.` };
}

export function directRevisionDecision(root: string, ticketIds: string[] = []): RunDecision {
  const project = readProject(root);
  try { assertOperationAllowed(project, "revise"); } catch (error) { return { action: "blocked", prompt: null, message: error instanceof Error ? error.message : String(error) }; }
  const tickets = readTickets(root).tickets.filter((ticket) => ["open", "in-progress"].includes(ticket.status));
  const selected = ticketIds.length ? tickets.filter((ticket) => ticketIds.includes(ticket.id)) : tickets.slice(0, 3);
  if (!selected.length) return { action: "no-tickets", prompt: null, message: "No open tickets matched the request." };
  return { action: "revise", prompt: revisionPrompt(root, selected), message: `Queued revision for ${selected.map((ticket) => ticket.id).join(", ")}.` };
}

export function bookPath(root: string): string { return join(root, "books", readBook(root).book_id); }

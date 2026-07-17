import { join } from "node:path";
import { buildChapterContext } from "../context/context-builder.js";
import type { RuntimeProfile, RuntimeProfileId } from "../domain/runtime-profile.js";
import type { ProjectStateV14 } from "../domain/v1-4-project-schema.js";
import { readText } from "../infrastructure/files.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject, readTickets } from "../project/store.js";
import { openBlockingTickets } from "../review/review.js";
import { getProjectStatus } from "./status.js";
import { approveGate } from "./gates.js";
import { assertOperationAllowed } from "./authorization.js";
import { automationDraftPrompt, bookPlanPrompt, canonLockPrompt, draftPrompt, packagePrompt, premisePlanPrompt, queuePrompt, reviewPrompt, revisionPrompt, seriesPlanPrompt, voicePlanPrompt } from "./prompts.js";
import { compileActiveBook } from "./package.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { canRetryEvent, rejectionInstruction, type EventRejectionDetail } from "./event-rejection.js";
import { creativeProjectStateHash } from "./project-hash.js";
import { recordPreparedPersistentRun } from "./persistent-run-telemetry.js";
import { applyRuntimeLimits, resolveRuntimeProfile } from "./runtime-profile-resolver.js";
import { cancelAutomationRun, pauseAutomationRun, resumeAutomationRun, startAutomationRun } from "./automation-run.js";
import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";
import { parseYaml } from "../infrastructure/yaml.js";

export interface RunOptions {
  approve?: string;
  until?: string;
  maxChapters?: number;
  runtimeProfile?: RuntimeProfileId;
  noProse?: boolean;
  reviewOnly?: boolean;
  stopOnWarning?: boolean;
  resume?: boolean;
  pause?: boolean;
  cancel?: boolean;
}
export interface RunDecision { action: string; prompt: string | null; message: string; runtimeProfile?: RuntimeProfileId }
export interface BeginPersistentRunOptions { target: string; maxChapters: number; runtimeProfile?: RuntimeProfileId; now?: string }

function projectV14(root: string): ProjectStateV14 {
  return readProject(root) as ProjectStateV14;
}

function runtimeFor(project: ProjectStateV14, explicit?: RuntimeProfileId): RuntimeProfile {
  return resolveRuntimeProfile({ explicit, project: project.runtime?.profile });
}

function runtimeForActiveRun(project: ProjectStateV14): RuntimeProfile {
  return resolveRuntimeProfile({ explicit: project.automation.active_run?.runtimeProfile ?? "full" });
}

function runtimeDecision(profile: RuntimeProfile, decision: Omit<RunDecision, "runtimeProfile">): RunDecision {
  return {
    ...decision,
    runtimeProfile: profile.id,
    message: `${decision.message} Runtime profile: ${profile.id}.`,
  };
}

function nextRunId(project: ProjectStateV14): string {
  const current = project.automation.active_run?.id.match(/^RUN-(\d+)$/)?.[1];
  return `RUN-${String((current ? Number(current) : 0) + 1).padStart(3, "0")}`;
}

function persistRunProject(root: string, project: ProjectStateV14, subject: string, lastAction: string): void {
  applyGuidedProjectEvent(
    root,
    [{ path: "PROJECT.yaml", content: stringifyYaml(project) }],
    `Novel Forge: ${subject}`,
    { lastAction },
  );
}

export function approveProjectGate(root: string, gate: string, note = ""): RunDecision {
  const runtimeProfile = runtimeFor(projectV14(root));
  const project = approveGate(root, structuredClone(readProject(root)), gate, note);
  applyGuidedProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], `Novel Forge: approve ${gate}`, { lastAction: `Approved ${gate}` });
  return runtimeDecision(runtimeProfile, { action: "approved", prompt: null, message: `Approved ${gate}. Current stage: ${project.current_stage}.` });
}

export function rejectProjectGate(root: string, gate: string, note: string): RunDecision {
  const runtimeProfile = runtimeFor(projectV14(root));
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
  return runtimeDecision(runtimeProfile, { action: "rejected", prompt: null, message: `Changes requested for ${gate}. The gate remains active until repaired and approved.` });
}

export function decideNextRun(root: string, options: RunOptions = {}): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeFor(project, options.runtimeProfile);
  const finish = (decision: Omit<RunDecision, "runtimeProfile">): RunDecision => runtimeDecision(runtimeProfile, decision);
  if (options.approve) {
    const approved = approveProjectGate(root, options.approve);
    return { ...approved, runtimeProfile: runtimeProfile.id, message: approved.message.replace(/ Runtime profile: [^.]+\.$/, ` Runtime profile: ${runtimeProfile.id}.`) };
  }
  const status = getProjectStatus(root);
  if (status.blockers.length) return finish({ action: "blocked", prompt: null, message: status.blockers[0] ?? "Project is blocked." });
  if (options.stopOnWarning && status.warnings.length) return finish({ action: "warning-stop", prompt: null, message: status.warnings[0] ?? "Project warning." });
  if (options.reviewOnly) {
    if (project.current_stage === "act-review") return finish({ action: "review", prompt: reviewPrompt(root, "act", runtimeProfile), message: "Queued act review." });
    if (project.current_stage === "manuscript-review") return finish({ action: "review", prompt: reviewPrompt(root, "manuscript", runtimeProfile), message: "Queued manuscript review." });
    return finish({ action: "blocked", prompt: null, message: `Review-only mode is not available during ${project.current_stage}.` });
  }
  switch (project.current_stage) {
    case "voice-intake": return finish({ action: "voice", prompt: voicePlanPrompt(root, runtimeProfile), message: "Queued voice intake." });
    case "series-planning": return finish({ action: "series-plan", prompt: seriesPlanPrompt(root, runtimeProfile), message: "Queued series plan." });
    case "book-planning": return finish({ action: "book-plan", prompt: bookPlanPrompt(root, runtimeProfile), message: "Queued book plan." });
    case "chapter-queue": return finish({ action: "queue", prompt: queuePrompt(root, runtimeProfile), message: "Queued chapter packets." });
    case "drafting": {
      if (options.noProse) return finish({ action: "queue", prompt: queuePrompt(root, runtimeProfile), message: "No-prose mode queued packet maintenance." });
      const limits = applyRuntimeLimits({
        profile: runtimeProfile,
        projectMaxChapters: project.automation.max_chapters_per_run,
        ...(options.maxChapters !== undefined ? { requestedMaxChapters: options.maxChapters } : {}),
      });
      return finish({ action: "bounded-draft", prompt: automationDraftPrompt(root, limits.maxChapters, options.until, runtimeProfile), message: `Queued a bounded drafting run of up to ${limits.maxChapters} chapter(s).` });
    }
    case "act-review": return finish({ action: "review", prompt: reviewPrompt(root, "act", runtimeProfile), message: "Queued act review." });
    case "revision": {
      const tickets = openBlockingTickets(readTickets(root));
      const ticketLimit = runtimeProfile.maxRevisionTickets ?? 3;
      return finish({ action: "revise", prompt: revisionPrompt(root, tickets.slice(0, ticketLimit), runtimeProfile), message: `Queued ${Math.min(ticketLimit, tickets.length)} blocking ticket(s).` });
    }
    case "manuscript-review": return finish({ action: "review", prompt: reviewPrompt(root, "manuscript", runtimeProfile), message: "Queued manuscript review." });
    case "canon-lock": return finish({ action: "canon-lock", prompt: canonLockPrompt(root, runtimeProfile), message: "Queued canon lock." });
    case "packaging": {
      const compiled = compileActiveBook(root);
      return finish({ action: "package", prompt: packagePrompt(root, runtimeProfile), message: `Compiled ${compiled.chapters} chapters (${compiled.words} words) and queued packaging.` });
    }
    case "complete": return finish({ action: "complete", prompt: null, message: "Project is complete." });
  }
}

export function beginPersistentRun(root: string, options: BeginPersistentRunOptions): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeFor(project, options.runtimeProfile);
  const limits = applyRuntimeLimits({
    profile: runtimeProfile,
    projectMaxChapters: project.automation.max_chapters_per_run,
    requestedMaxChapters: options.maxChapters,
  });
  const initial = decideNextRun(root, { until: options.target, maxChapters: limits.maxChapters, runtimeProfile: runtimeProfile.id });
  if (!initial.prompt) return initial;
  const now = options.now ?? new Date().toISOString();
  const updated = startAutomationRun(project, {
    id: nextRunId(project),
    target: options.target,
    currentAction: initial.action,
    requestedMaxChapters: limits.maxChapters,
    runtimeProfile: runtimeProfile.id,
    creativeHash: creativeProjectStateHash(root),
    startedAt: now,
  });
  const run = updated.automation.active_run!;
  persistRunProject(root, updated, `start automation ${run.id}`, `Started automation run ${run.id}`);
  const telemetryMessage = recordPreparedPersistentRun(root, {
    telemetryEnabled: updated.runtime?.telemetry,
    runId: run.id,
    runtimeProfile: runtimeProfile.id,
    promptChars: initial.prompt.length,
    projectHashBefore: run.lastProjectHash,
  });
  return { ...initial, message: `${initial.message} Persistent run ${run.id} started.${telemetryMessage}` };
}

export function pausePersistentRun(root: string, now = new Date().toISOString()): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeForActiveRun(project);
  const updated = pauseAutomationRun(project, now);
  if (updated !== project) persistRunProject(root, updated, `pause automation ${updated.automation.active_run!.id}`, `Paused automation run ${updated.automation.active_run!.id}`);
  return runtimeDecision(runtimeProfile, { action: "paused-run", prompt: null, message: `Automation run ${updated.automation.active_run!.id} is paused.` });
}

export function cancelPersistentRun(root: string, now = new Date().toISOString()): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeForActiveRun(project);
  const updated = cancelAutomationRun(project, now);
  if (updated !== project) persistRunProject(root, updated, `cancel automation ${updated.automation.active_run!.id}`, `Cancelled automation run ${updated.automation.active_run!.id}`);
  return runtimeDecision(runtimeProfile, { action: "cancelled-run", prompt: null, message: `Automation run ${updated.automation.active_run!.id} is cancelled.` });
}

export function resumePersistentRun(root: string, now = new Date().toISOString()): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeForActiveRun(project);
  const updated = resumeAutomationRun(project, project.current_stage, creativeProjectStateHash(root), now);
  if (updated.automation.active_run?.status === "stopped") {
    persistRunProject(root, updated, `stop automation ${updated.automation.active_run.id}`, `Stopped automation run ${updated.automation.active_run.id}`);
    return runtimeDecision(runtimeProfile, { action: "blocked", prompt: null, message: `Automation run ${updated.automation.active_run.id} stopped because creative state changed. Reload and start a new run.` });
  }
  if (updated !== project) persistRunProject(root, updated, `resume automation ${updated.automation.active_run!.id}`, `Resumed automation run ${updated.automation.active_run!.id}`);
  const activeRun = updated.automation.active_run!;
  let decision: RunDecision;
  if (updated.current_stage === "book-planning") {
    const book = readBook(root);
    const path = join(root, "books", book.book_id, "premise-lab.yaml");
    const text = readText(path);
    const lab = text ? parseYaml<PremiseLab>(text, PremiseLabSchema, path) : null;
    if (lab && lab.variants.length === 0) decision = runtimeDecision(runtimeProfile, { action: "premise-plan", prompt: premisePlanPrompt(root, runtimeProfile), message: "Queued premise comparison before book architecture." });
    else if (lab && (!lab.selected_variant_id || !lab.selection_decision_id)) decision = runtimeDecision(runtimeProfile, { action: "premise-selection", prompt: null, message: "Automation stopped so the writer can select a premise variant." });
    else decision = decideNextRun(root, { until: activeRun.target, maxChapters: activeRun.requestedMaxChapters, runtimeProfile: runtimeProfile.id });
  } else decision = decideNextRun(root, { until: activeRun.target, maxChapters: activeRun.requestedMaxChapters, runtimeProfile: runtimeProfile.id });
  return { ...decision, message: `${decision.message} Resumed ${activeRun.id}.` };
}

export function directDraftDecision(root: string, chapter?: number): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeFor(project);
  try { assertOperationAllowed(project, "draft"); } catch (error) { return runtimeDecision(runtimeProfile, { action: "blocked", prompt: null, message: error instanceof Error ? error.message : String(error) }); }
  const status = getProjectStatus(root);
  if (status.blockers.length) return runtimeDecision(runtimeProfile, { action: "blocked", prompt: null, message: status.blockers[0] ?? "Project is blocked." });
  const context = buildChapterContext(root, chapter, runtimeProfile.maxContextChars, runtimeProfile.graphDepth);
  return runtimeDecision(runtimeProfile, { action: "draft", prompt: draftPrompt(context, runtimeProfile), message: `Queued Chapter ${context.packet.chapter}.` });
}

export function directRevisionDecision(root: string, ticketIds: string[] = []): RunDecision {
  const project = projectV14(root);
  const runtimeProfile = runtimeFor(project);
  try { assertOperationAllowed(project, "revise"); } catch (error) { return runtimeDecision(runtimeProfile, { action: "blocked", prompt: null, message: error instanceof Error ? error.message : String(error) }); }
  const tickets = readTickets(root).tickets.filter((ticket) => ["open", "in-progress"].includes(ticket.status));
  const ticketLimit = runtimeProfile.maxRevisionTickets ?? 3;
  const selected = (ticketIds.length ? tickets.filter((ticket) => ticketIds.includes(ticket.id)) : tickets).slice(0, ticketLimit);
  if (!selected.length) return runtimeDecision(runtimeProfile, { action: "no-tickets", prompt: null, message: "No open tickets matched the request." });
  return runtimeDecision(runtimeProfile, { action: "revise", prompt: revisionPrompt(root, selected, runtimeProfile), message: `Queued revision for ${selected.map((ticket) => ticket.id).join(", ")}.` });
}

export function bookPath(root: string): string { return join(root, "books", readBook(root).book_id); }

export function rejectionRunDecision(detail: EventRejectionDetail, previousRetries = 0): RunDecision {
  const instruction = rejectionInstruction(detail, previousRetries);
  if (canRetryEvent(detail, previousRetries)) {
    return { action: "repair-rejection", prompt: null, message: `${detail.message} ${instruction}` };
  }
  if (detail.retryable) {
    return { action: "blocked", prompt: null, message: `Retry limit reached. ${instruction}` };
  }
  if (detail.requiresReload) {
    return { action: "reload-state", prompt: null, message: `${detail.message} ${instruction}` };
  }
  return { action: "blocked", prompt: null, message: `${detail.message} ${instruction}` };
}

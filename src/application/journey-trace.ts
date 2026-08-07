import type { AuthorJourneyEvent } from "../evaluation/author-journey.js";
import { appendJourneyEvent, readJourneyTrace } from "../infrastructure/journey-trace-store.js";

/**
 * Record what a book actually cost its author.
 *
 * Every function here is best-effort: a trace is diagnostic, and failing to
 * write one must never fail the work being measured. Recording is off unless a
 * project opts in through `runtime.telemetry`, matching how run reports already
 * behave.
 */

export type JourneyRecorderEnabled = boolean | undefined;

function enabled(telemetry: JourneyRecorderEnabled): boolean {
  // Undefined means "not configured", and new projects set it true. Only an
  // explicit false disables recording.
  return telemetry !== false;
}

function nextOrdinal(root: string, prefix: string): number {
  const existing = readJourneyTrace(root);
  const used = existing.filter((event) => "id" in event && typeof event.id === "string" && event.id.startsWith(`${prefix}-`));
  return used.length + 1;
}

function record(root: string, telemetry: JourneyRecorderEnabled, event: AuthorJourneyEvent): void {
  if (!enabled(telemetry)) return;
  try {
    appendJourneyEvent(root, event);
  } catch {
    // Diagnostics never break the workflow they measure.
  }
}

export function recordAuthorQuestion(root: string, telemetry: JourneyRecorderEnabled): void {
  if (!enabled(telemetry)) return;
  try {
    record(root, telemetry, { type: "author-question", id: `Q-${String(nextOrdinal(root, "Q")).padStart(3, "0")}` });
  } catch { /* diagnostic only */ }
}

export function recordModelPrompt(root: string, telemetry: JourneyRecorderEnabled): void {
  if (!enabled(telemetry)) return;
  try {
    record(root, telemetry, { type: "model-prompt", id: `P-${String(nextOrdinal(root, "P")).padStart(3, "0")}` });
  } catch { /* diagnostic only */ }
}

export interface RecordGuardedEventInput {
  action: string;
  outcome: "accepted" | "rejected";
  chapter?: number;
}

/**
 * A guarded event, with retries resolved against the trace itself.
 *
 * The evaluator counts a retry when an event names an earlier one via
 * `retry_of`, so a resubmission after a rejection has to be linked rather than
 * counted as a fresh attempt. The link is derived from the most recent rejected
 * event of the same action and chapter that nothing has already retried, which
 * is exactly the workflow's one-corrected-resubmission contract.
 */
export function recordGuardedEvent(root: string, telemetry: JourneyRecorderEnabled, input: RecordGuardedEventInput): void {
  if (!enabled(telemetry)) return;
  try {
    const existing = readJourneyTrace(root);
    const guarded = existing.filter((event): event is Extract<AuthorJourneyEvent, { type: "guarded-event" }> => event.type === "guarded-event");
    const alreadyRetried = new Set(guarded.map((event) => event.retry_of).filter((value): value is string => Boolean(value)));
    const retryOf = [...guarded]
      .reverse()
      .find((event) => event.outcome === "rejected"
        && event.action === input.action
        && event.chapter === input.chapter
        && !alreadyRetried.has(event.id))?.id;
    record(root, telemetry, {
      type: "guarded-event",
      id: `E-${String(guarded.length + 1).padStart(3, "0")}`,
      action: input.action,
      outcome: input.outcome,
      ...(input.chapter !== undefined ? { chapter: input.chapter } : {}),
      ...(retryOf ? { retry_of: retryOf } : {}),
    });
  } catch { /* diagnostic only */ }
}

export function recordWriterApproval(root: string, telemetry: JourneyRecorderEnabled, gate: string): void {
  record(root, telemetry, { type: "writer-approval", gate });
}

export function recordContextSize(root: string, telemetry: JourneyRecorderEnabled, characters: number): void {
  if (!Number.isFinite(characters) || characters < 0) return;
  record(root, telemetry, { type: "context", characters: Math.floor(characters) });
}

export function recordRunState(
  root: string,
  telemetry: JourneyRecorderEnabled,
  runId: string,
  state: "started" | "paused" | "resumed" | "completed",
): void {
  record(root, telemetry, { type: "run-state", run_id: runId, state });
}

export function recordStop(root: string, telemetry: JourneyRecorderEnabled, reason: string): void {
  const trimmed = reason.trim();
  if (!trimmed) return;
  record(root, telemetry, { type: "stop", reason: trimmed });
}

export interface JourneyVelocity {
  chaptersCompleted: number;
  authorActions: number;
  hostPrompts: number;
  guardedEvents: number;
  rejectedEvents: number;
  authorActionsPerChapter: number | null;
  hostPromptsPerChapter: number | null;
}

/**
 * The number this whole effort is aimed at. Author actions are the questions a
 * writer had to answer plus the gates they had to decide — the work that cannot
 * be automated away without crossing a boundary this project holds. Host
 * prompts are what the automation cost on top.
 */
export function summarizeJourneyVelocity(events: readonly AuthorJourneyEvent[]): JourneyVelocity {
  const chapters = new Set<number>();
  let authorQuestions = 0;
  let approvals = 0;
  let hostPrompts = 0;
  let guardedEvents = 0;
  let rejectedEvents = 0;
  for (const event of events) {
    if (event.type === "author-question") authorQuestions += 1;
    else if (event.type === "writer-approval") approvals += 1;
    else if (event.type === "model-prompt") hostPrompts += 1;
    else if (event.type === "guarded-event") {
      guardedEvents += 1;
      if (event.outcome === "rejected") rejectedEvents += 1;
      if (event.action === "draft-chapter" && event.outcome === "accepted" && typeof event.chapter === "number") chapters.add(event.chapter);
    }
  }
  const chaptersCompleted = chapters.size;
  const authorActions = authorQuestions + approvals;
  return {
    chaptersCompleted,
    authorActions,
    hostPrompts,
    guardedEvents,
    rejectedEvents,
    authorActionsPerChapter: chaptersCompleted ? authorActions / chaptersCompleted : null,
    hostPromptsPerChapter: chaptersCompleted ? hostPrompts / chaptersCompleted : null,
  };
}

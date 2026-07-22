import {
  normalizeStoryThreads,
  type CompatibleStoryThreadsState,
  type StoryThreadPriority,
  type StoryThreadV2,
} from "../domain/story-thread-v2.js";

export interface ThreadScheduleFinding {
  severity: "warning" | "blocker";
  code: string;
  thread_id: string;
  message: string;
}

export interface ThreadScheduleResult {
  active_thread_ids: string[];
  deferred_thread_ids: string[];
  findings: ThreadScheduleFinding[];
  selection_reasons: Record<string, string[]>;
}

export interface ScheduleStoryThreadsInput {
  threads: CompatibleStoryThreadsState;
  chapter: number;
  explicitThreadIds?: readonly string[];
  maximumActiveThreads?: number;
  starvationLimitChapters?: number;
}

const PRIORITY_SCORE: Record<StoryThreadPriority, number> = {
  critical: 400,
  high: 300,
  normal: 200,
  low: 100,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function terminal(thread: StoryThreadV2): boolean {
  return thread.status === "paid-off" || thread.status === "abandoned";
}

function schedulable(thread: StoryThreadV2, explicit: ReadonlySet<string>): boolean {
  if (terminal(thread)) return false;
  return thread.status === "open" || thread.status === "advanced" || explicit.has(thread.id);
}

interface Candidate {
  thread: StoryThreadV2;
  score: number;
  reasons: string[];
  blocked: boolean;
}

export function scheduleStoryThreads(input: ScheduleStoryThreadsInput): ThreadScheduleResult {
  if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Thread scheduling requires a positive chapter number.");
  const maximumActiveThreads = input.maximumActiveThreads ?? 4;
  if (!Number.isInteger(maximumActiveThreads) || maximumActiveThreads < 1 || maximumActiveThreads > 8) {
    throw new Error("Thread scheduling capacity must be an integer from 1 to 8.");
  }
  const starvationLimitChapters = input.starvationLimitChapters ?? 4;
  if (!Number.isInteger(starvationLimitChapters) || starvationLimitChapters < 1) {
    throw new Error("Thread starvation limit must be a positive integer.");
  }

  const normalized = normalizeStoryThreads(input.threads);
  const byId = new Map<string, StoryThreadV2>();
  for (const thread of normalized.threads) {
    if (byId.has(thread.id)) throw new Error(`Thread scheduling found duplicate thread ID ${thread.id}.`);
    byId.set(thread.id, thread);
  }

  const explicitThreadIds = unique(input.explicitThreadIds ?? []);
  if (explicitThreadIds.length > maximumActiveThreads) {
    throw new Error(`Explicit thread count ${explicitThreadIds.length} exceeds chapter capacity ${maximumActiveThreads}.`);
  }
  const explicit = new Set(explicitThreadIds);
  for (const id of explicitThreadIds) {
    const thread = byId.get(id);
    if (!thread) throw new Error(`Explicit chapter thread ${id} does not exist.`);
    if (terminal(thread)) throw new Error(`Explicit chapter thread ${id} is already ${thread.status}.`);
  }

  const findings: ThreadScheduleFinding[] = [];
  const candidates: Candidate[] = [];
  for (const thread of normalized.threads) {
    if (!schedulable(thread, explicit)) continue;
    const reasons: string[] = [];
    let score = PRIORITY_SCORE[thread.priority];
    if (explicit.has(thread.id)) {
      reasons.push("explicit");
      score += 10_000;
    }

    const overdueBy = thread.next_required_touch !== null && thread.next_required_touch < input.chapter
      ? input.chapter - thread.next_required_touch
      : 0;
    if (overdueBy > 0) {
      reasons.push("overdue");
      score += 5_000 + overdueBy * 10;
      findings.push({
        severity: "warning",
        code: "thread-overdue",
        thread_id: thread.id,
        message: `Thread ${thread.id} required a touch by Chapter ${thread.next_required_touch} and is ${overdueBy} chapter${overdueBy === 1 ? "" : "s"} overdue.`,
      });
    } else if (thread.next_required_touch === input.chapter) {
      reasons.push("due");
      score += 2_000;
    }

    const latestPayoff = thread.payoff_window.latest_chapter;
    if (latestPayoff !== null && latestPayoff < input.chapter) {
      const overdue = input.chapter - latestPayoff;
      reasons.push("payoff-overdue");
      score += 6_000 + overdue * 10;
      findings.push({
        severity: "warning",
        code: "thread-payoff-overdue",
        thread_id: thread.id,
        message: `Thread ${thread.id} passed its payoff window in Chapter ${latestPayoff}.`,
      });
    } else if (thread.payoff_window.earliest_chapter === input.chapter) {
      reasons.push("payoff-window-open");
      score += 1_500;
    }

    const lastTouched = thread.last_touched_in ?? thread.opened_in;
    const untouchedChapters = lastTouched === null ? 0 : input.chapter - lastTouched;
    if (untouchedChapters >= starvationLimitChapters) {
      reasons.push("starving");
      score += 3_000 + untouchedChapters * 10;
      findings.push({
        severity: "warning",
        code: "thread-starving",
        thread_id: thread.id,
        message: `Thread ${thread.id} has not been touched for ${untouchedChapters} chapters.`,
      });
    }

    const unresolvedDependencies = thread.dependent_thread_ids.filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !terminal(dependency);
    });
    const blocked = unresolvedDependencies.length > 0;
    if (blocked) {
      reasons.push("dependency-blocked");
      findings.push({
        severity: "blocker",
        code: "thread-dependency-blocked",
        thread_id: thread.id,
        message: `Thread ${thread.id} depends on unresolved thread${unresolvedDependencies.length === 1 ? "" : "s"} ${unresolvedDependencies.join(", ")}.`,
      });
      if (explicit.has(thread.id)) {
        throw new Error(`Explicit chapter thread ${thread.id} is dependency-blocked by ${unresolvedDependencies.join(", ")}.`);
      }
    }
    candidates.push({ thread, score, reasons, blocked });
  }

  const selected: Candidate[] = [];
  for (const id of explicitThreadIds) {
    const candidate = candidates.find((item) => item.thread.id === id);
    if (!candidate || candidate.blocked) throw new Error(`Explicit chapter thread ${id} could not be scheduled.`);
    selected.push(candidate);
  }
  const selectedIds = new Set(selected.map((item) => item.thread.id));
  const ranked = candidates
    .filter((item) => !item.blocked && !selectedIds.has(item.thread.id))
    .sort((left, right) => right.score - left.score
      || (left.thread.last_touched_in ?? Number.MAX_SAFE_INTEGER) - (right.thread.last_touched_in ?? Number.MAX_SAFE_INTEGER)
      || left.thread.id.localeCompare(right.thread.id));
  for (const candidate of ranked) {
    if (selected.length >= maximumActiveThreads) break;
    selected.push(candidate);
    selectedIds.add(candidate.thread.id);
  }

  const deferred = candidates.filter((item) => !selectedIds.has(item.thread.id)).map((item) => item.thread.id);
  for (const candidate of ranked) {
    if (selectedIds.has(candidate.thread.id)) continue;
    if (!candidate.reasons.some((reason) => ["due", "overdue", "starving", "payoff-overdue", "payoff-window-open"].includes(reason))) continue;
    findings.push({
      severity: "warning",
      code: "thread-capacity-deferred",
      thread_id: candidate.thread.id,
      message: `Thread ${candidate.thread.id} was due for attention but deferred by the ${maximumActiveThreads}-thread chapter capacity.`,
    });
  }

  return {
    active_thread_ids: selected.map((item) => item.thread.id),
    deferred_thread_ids: deferred,
    findings,
    selection_reasons: Object.fromEntries(selected.map((item) => [item.thread.id, [...item.reasons]])),
  };
}

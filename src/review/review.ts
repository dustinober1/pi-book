import type { RevisionTicket, RevisionTicketsState } from "../domain/schemas.js";
import type { RevisionRecurrence, RevisionTicketPhase5 } from "../domain/v1-3-audit-schemas.js";

export interface ReviewFinding {
  severity: RevisionTicket["severity"];
  category: string;
  chapter: number | null;
  evidence: string;
  problem: string;
  requiredChange: string;
  protectedConstraints?: string[];
  acceptanceTests: string[];
  guardrailCandidate?: string;
}

export interface SynthesizeTicketOptions {
  milestoneReviewId?: string;
}

function normalizedText(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

function normalizedKey(finding: ReviewFinding): string {
  return `${finding.category}|${finding.chapter ?? "book"}|${normalizedText(finding.problem)}`;
}

function patternKey(category: string, problem: string): string {
  return `${normalizedText(category)}|${normalizedText(problem)}`;
}

function nextTicketCounter(existing: RevisionTicketsState, bookNumber: number): number {
  const prefix = `B${String(bookNumber).padStart(2, "0")}-T`;
  return Math.max(0, ...existing.tickets.map((ticket) => ticket.id.startsWith(prefix) ? Number.parseInt(ticket.id.slice(prefix.length), 10) || 0 : 0)) + 1;
}

function distinctNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function distinctStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function recurrenceFor(ticket: RevisionTicketPhase5, options: SynthesizeTicketOptions, candidate?: string): RevisionRecurrence {
  const existing = ticket.recurrence;
  return {
    pattern_key: existing?.pattern_key ?? patternKey(ticket.category, ticket.problem),
    occurrence_chapters: distinctNumbers([...(existing?.occurrence_chapters ?? []), ...(ticket.chapter ? [ticket.chapter] : [])]),
    milestone_review_ids: distinctStrings([...(existing?.milestone_review_ids ?? []), ...(options.milestoneReviewId ? [options.milestoneReviewId] : [])]),
    promotion_status: existing?.promotion_status ?? "not-eligible",
    candidate_guardrail: candidate?.trim() || existing?.candidate_guardrail || ticket.required_change.trim() || null,
  };
}

function refreshRecurrence(existing: RevisionTicketsState): void {
  const groups = new Map<string, RevisionTicketPhase5[]>();
  for (const base of existing.tickets) {
    const ticket = base as RevisionTicketPhase5;
    if (!ticket.recurrence) continue;
    const group = groups.get(ticket.recurrence.pattern_key) ?? [];
    group.push(ticket);
    groups.set(ticket.recurrence.pattern_key, group);
  }
  for (const group of groups.values()) {
    const chapters = distinctNumbers(group.flatMap((ticket) => ticket.recurrence?.occurrence_chapters ?? []));
    const milestones = distinctStrings(group.flatMap((ticket) => ticket.recurrence?.milestone_review_ids ?? []));
    const terminalStatus = group.map((ticket) => ticket.recurrence?.promotion_status).find((status) => status === "approved" || status === "rejected");
    const status = terminalStatus ?? (chapters.length >= 3 || milestones.length >= 2 ? "candidate" : "not-eligible");
    const candidate = group.map((ticket) => ticket.recurrence?.candidate_guardrail?.trim() ?? "").find(Boolean)
      ?? group.map((ticket) => ticket.required_change.trim()).find(Boolean)
      ?? null;
    for (const ticket of group) {
      if (!ticket.recurrence) continue;
      ticket.recurrence.occurrence_chapters = chapters;
      ticket.recurrence.milestone_review_ids = milestones;
      ticket.recurrence.promotion_status = status;
      ticket.recurrence.candidate_guardrail = candidate;
    }
  }
}

export function synthesizeTickets(
  existing: RevisionTicketsState,
  findings: ReviewFinding[],
  bookNumber = 1,
  options: SynthesizeTicketOptions = {},
): RevisionTicketsState {
  const byKey = new Map(existing.tickets.map((ticket) => [`${ticket.category}|${ticket.chapter ?? "book"}|${normalizedText(ticket.problem)}`, ticket]));
  let counter = nextTicketCounter(existing, bookNumber);
  for (const finding of findings) {
    const key = normalizedKey(finding);
    const current = byKey.get(key);
    if (current) {
      current.evidence = [current.evidence, finding.evidence].filter(Boolean).join("\n\n");
      current.acceptance_tests = [...new Set([...current.acceptance_tests, ...finding.acceptanceTests])];
      const extended = current as RevisionTicketPhase5;
      extended.recurrence = recurrenceFor(extended, options, finding.guardrailCandidate ?? finding.requiredChange);
      continue;
    }
    const ticket = {
      id: `B${String(bookNumber).padStart(2, "0")}-T${String(counter).padStart(3, "0")}`,
      severity: finding.severity,
      category: finding.category,
      chapter: finding.chapter,
      evidence: finding.evidence,
      problem: finding.problem,
      required_change: finding.requiredChange,
      protected_constraints: finding.protectedConstraints ?? [],
      acceptance_tests: finding.acceptanceTests,
      status: "open" as const,
    } as RevisionTicketPhase5;
    ticket.recurrence = recurrenceFor(ticket, options, finding.guardrailCandidate ?? finding.requiredChange);
    existing.tickets.push(ticket as RevisionTicket);
    byKey.set(key, ticket as RevisionTicket);
    counter += 1;
  }
  refreshRecurrence(existing);
  return existing;
}

export function openBlockingTickets(tickets: RevisionTicketsState): RevisionTicket[] {
  return tickets.tickets.filter((ticket) => ["open", "in-progress"].includes(ticket.status) && ["blocker", "high"].includes(ticket.severity));
}

export function regressionChecklist(ticket: RevisionTicket): string[] {
  return [
    ...ticket.acceptance_tests,
    "Locked canon remains unchanged unless the ticket explicitly authorizes a canon update.",
    "Future reveal order and story-thread state remain valid.",
    "Protected voice and structural constraints remain intact.",
    "No new chronology, continuity, or repeated-exposition defect was introduced.",
    "Adjacent chapter transitions still work after the revision.",
  ];
}

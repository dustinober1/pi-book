import type { RevisionTicket } from "../domain/schemas.js";
import type {
  RevisionTicketPhase5,
  RevisionTicketsPhase5,
} from "../domain/v1-3-audit-schemas.js";

export interface ReviewFinding {
  severity: RevisionTicket["severity"];
  category: string;
  chapter: number | null;
  evidence: string;
  problem: string;
  requiredChange: string;
  protectedConstraints?: string[];
  acceptanceTests: string[];
  recurrenceKey?: string;
  milestoneReview?: string;
}

function normalizedKey(finding: ReviewFinding): string {
  return `${finding.category}|${finding.chapter ?? "book"}|${finding.problem.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function nextTicketCounter(existing: RevisionTicketsPhase5, bookNumber: number): number {
  const prefix = `B${String(bookNumber).padStart(2, "0")}-T`;
  return Math.max(0, ...existing.tickets.map((ticket) => ticket.id.startsWith(prefix) ? Number.parseInt(ticket.id.slice(prefix.length), 10) || 0 : 0)) + 1;
}

export function synthesizeTickets(
  existing: RevisionTicketsPhase5,
  findings: ReviewFinding[],
  bookNumber = 1,
): RevisionTicketsPhase5 {
  const byKey = new Map(existing.tickets.map((ticket) => [
    `${ticket.category}|${ticket.chapter ?? "book"}|${ticket.problem.toLowerCase().replace(/\s+/g, " ").trim()}`,
    ticket,
  ]));
  let counter = nextTicketCounter(existing, bookNumber);
  for (const finding of findings) {
    const key = normalizedKey(finding);
    const current = byKey.get(key);
    if (current) {
      current.evidence = [current.evidence, finding.evidence].filter(Boolean).join("\n\n");
      current.acceptance_tests = [...new Set([...current.acceptance_tests, ...finding.acceptanceTests])];
      if (!current.recurrence && finding.recurrenceKey) {
        current.recurrence = {
          pattern_id: finding.recurrenceKey,
          milestone_review: finding.milestoneReview ?? null,
        };
      }
      continue;
    }
    const ticket: RevisionTicketPhase5 = {
      id: `B${String(bookNumber).padStart(2, "0")}-T${String(counter).padStart(3, "0")}`,
      severity: finding.severity,
      category: finding.category,
      chapter: finding.chapter,
      evidence: finding.evidence,
      problem: finding.problem,
      required_change: finding.requiredChange,
      protected_constraints: finding.protectedConstraints ?? [],
      acceptance_tests: finding.acceptanceTests,
      status: "open",
      ...(finding.recurrenceKey ? {
        recurrence: {
          pattern_id: finding.recurrenceKey,
          milestone_review: finding.milestoneReview ?? null,
        },
      } : {}),
    };
    existing.tickets.push(ticket);
    byKey.set(key, ticket);
    counter += 1;
  }
  return existing;
}

export function openBlockingTickets(tickets: RevisionTicketsPhase5): RevisionTicketPhase5[] {
  return tickets.tickets.filter((ticket) => ["open", "in-progress"].includes(ticket.status) && ["blocker", "high"].includes(ticket.severity));
}

export function regressionChecklist(ticket: RevisionTicketPhase5): string[] {
  return [
    ...ticket.acceptance_tests,
    "Locked canon remains unchanged unless the ticket explicitly authorizes a canon update.",
    "Future reveal order and story-thread state remain valid.",
    "Protected voice and structural constraints remain intact.",
    "No new chronology, continuity, or repeated-exposition defect was introduced.",
    "Adjacent chapter transitions still work after the revision.",
  ];
}

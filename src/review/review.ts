import type { RevisionTicket, RevisionTicketsState } from "../domain/schemas.js";

export interface ReviewFinding {
  severity: RevisionTicket["severity"];
  category: string;
  chapter: number | null;
  evidence: string;
  problem: string;
  requiredChange: string;
  protectedConstraints?: string[];
  acceptanceTests: string[];
}

function normalizedKey(finding: ReviewFinding): string {
  return `${finding.category}|${finding.chapter ?? "book"}|${finding.problem.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function synthesizeTickets(existing: RevisionTicketsState, findings: ReviewFinding[], bookNumber = 1): RevisionTicketsState {
  const byKey = new Map(existing.tickets.map((ticket) => [`${ticket.category}|${ticket.chapter ?? "book"}|${ticket.problem.toLowerCase().replace(/\s+/g, " ").trim()}`, ticket]));
  let counter = existing.tickets.length + 1;
  for (const finding of findings) {
    const key = normalizedKey(finding);
    const current = byKey.get(key);
    if (current) {
      current.evidence = [current.evidence, finding.evidence].filter(Boolean).join("\n\n");
      current.acceptance_tests = [...new Set([...current.acceptance_tests, ...finding.acceptanceTests])];
      continue;
    }
    const ticket: RevisionTicket = {
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
    };
    existing.tickets.push(ticket);
    byKey.set(key, ticket);
    counter += 1;
  }
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

import type {
  BookStrategyPhase5,
  RevisionTicketPhase5,
  RevisionTicketsPhase5,
} from "../domain/v1-3-audit-schemas.js";

export interface GuardrailPromotionCandidate {
  pattern_key: string;
  rule: string;
  source_ticket_ids: string[];
  occurrence_chapters: number[];
  milestone_review_ids: string[];
}

function distinctSorted<T extends string | number>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
}

function eligible(chapters: readonly number[], milestoneIds: readonly string[]): boolean {
  return new Set(chapters).size >= 3 || new Set(milestoneIds).size >= 2;
}

function resolvedByStrategy(candidate: GuardrailPromotionCandidate, strategy?: BookStrategyPhase5): boolean {
  if (!strategy) return false;
  return strategy.review_derived_guardrails.some((guardrail) => {
    if (guardrail.status !== "approved" && guardrail.status !== "rejected") return false;
    const ticketIds = guardrail.source_ticket_ids ?? [];
    return candidate.source_ticket_ids.some((id) => ticketIds.includes(id));
  });
}

export function promotionCandidates(tickets: RevisionTicketsPhase5, strategy?: BookStrategyPhase5): GuardrailPromotionCandidate[] {
  const groups = new Map<string, RevisionTicketPhase5[]>();
  for (const ticket of tickets.tickets) {
    const key = ticket.recurrence?.pattern_key;
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(ticket);
    groups.set(key, group);
  }

  const candidates: GuardrailPromotionCandidate[] = [];
  for (const [patternKey, group] of groups) {
    const statuses = new Set(group.map((ticket) => ticket.recurrence?.promotion_status).filter(Boolean));
    if (statuses.has("approved") || statuses.has("rejected")) continue;
    const occurrenceChapters = distinctSorted(group.flatMap((ticket) => ticket.recurrence?.occurrence_chapters ?? []));
    const milestoneIds = distinctSorted(group.flatMap((ticket) => ticket.recurrence?.milestone_review_ids ?? []));
    if (!eligible(occurrenceChapters, milestoneIds)) continue;
    const rule = group.map((ticket) => ticket.recurrence?.candidate_guardrail?.trim() ?? "").find(Boolean)
      ?? group.map((ticket) => ticket.required_change.trim()).find(Boolean)
      ?? "Prevent the recurring revision pattern.";
    const candidate = {
      pattern_key: patternKey,
      rule,
      source_ticket_ids: distinctSorted(group.map((ticket) => ticket.id)),
      occurrence_chapters: occurrenceChapters,
      milestone_review_ids: milestoneIds,
    };
    if (!resolvedByStrategy(candidate, strategy)) candidates.push(candidate);
  }
  return candidates.sort((a, b) => a.pattern_key.localeCompare(b.pattern_key));
}

export function applyGuardrailDecision(
  strategy: BookStrategyPhase5,
  candidate: GuardrailPromotionCandidate,
  decision: "proposed" | "approved" | "rejected",
  decidedAt: string,
): BookStrategyPhase5 {
  const next = structuredClone(strategy);
  const existing = next.review_derived_guardrails.find((guardrail) => {
    const ticketIds = guardrail.source_ticket_ids ?? [];
    return ticketIds.some((id) => candidate.source_ticket_ids.includes(id))
      || (guardrail.rule.trim() === candidate.rule.trim() && candidate.rule.trim().length > 0);
  });
  const approvedAt = decision === "approved" ? decidedAt : null;
  if (existing) {
    existing.rule = candidate.rule.trim();
    existing.status = decision;
    existing.source_ticket_ids = distinctSorted(candidate.source_ticket_ids);
    existing.source_milestone_ids = distinctSorted(candidate.milestone_review_ids);
    existing.approved_at = approvedAt;
    return next;
  }
  next.review_derived_guardrails.push({
    id: `GR-LRN-${String(next.review_derived_guardrails.length + 1).padStart(3, "0")}`,
    rule: candidate.rule.trim(),
    source_cluster_ids: [],
    status: decision,
    source_ticket_ids: distinctSorted(candidate.source_ticket_ids),
    source_milestone_ids: distinctSorted(candidate.milestone_review_ids),
    approved_at: approvedAt,
  });
  return next;
}

export interface RevisionLearningFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

export function revisionLearningFindings(tickets: RevisionTicketsPhase5, strategy?: BookStrategyPhase5): RevisionLearningFinding[] {
  const findings: RevisionLearningFinding[] = [];
  for (const ticket of tickets.tickets) {
    const recurrence = ticket.recurrence;
    if (!recurrence) continue;
    const qualifies = eligible(recurrence.occurrence_chapters, recurrence.milestone_review_ids);
    if (recurrence.promotion_status === "candidate" && !qualifies) {
      findings.push({ severity: "blocker", code: "premature-promotion-candidate", message: `${ticket.id} is a promotion candidate before three distinct chapters or two milestone reviews.` });
    }
    if ((recurrence.promotion_status === "candidate" || recurrence.promotion_status === "approved") && !recurrence.candidate_guardrail?.trim()) {
      findings.push({ severity: "blocker", code: "missing-candidate-guardrail", message: `${ticket.id} requires a concise candidate guardrail.` });
    }
  }
  if (strategy) {
    const ticketById = new Map(tickets.tickets.map((ticket) => [ticket.id, ticket]));
    for (const guardrail of strategy.review_derived_guardrails) {
      const sourceIds = distinctSorted(guardrail.source_ticket_ids ?? []);
      if (!sourceIds.length) continue;
      const missingIds = sourceIds.filter((id) => !ticketById.has(id));
      if (missingIds.length) {
        findings.push({ severity: "blocker", code: "missing-guardrail-ticket-source", message: `${guardrail.id} references missing learned-guardrail source ticket(s): ${missingIds.join(", ")}.` });
      }
      const sourceTickets = sourceIds.map((id) => ticketById.get(id)).filter((ticket): ticket is RevisionTicketPhase5 => Boolean(ticket));
      const occurrenceChapters = distinctSorted(sourceTickets.flatMap((ticket) => ticket.recurrence?.occurrence_chapters ?? []));
      const milestoneIds = distinctSorted(sourceTickets.flatMap((ticket) => ticket.recurrence?.milestone_review_ids ?? []));
      if ((guardrail.status === "approved" || guardrail.status === "rejected") && !eligible(occurrenceChapters, milestoneIds)) {
        findings.push({ severity: "blocker", code: "unsupported-learned-guardrail", message: `${guardrail.id} resolves a learned guardrail before three distinct chapters or two distinct milestone reviews.` });
      }
      const unsupportedMilestones = (guardrail.source_milestone_ids ?? []).filter((id) => !milestoneIds.includes(id));
      if (unsupportedMilestones.length) {
        findings.push({ severity: "blocker", code: "invalid-guardrail-milestone-source", message: `${guardrail.id} references milestone review(s) absent from its source tickets: ${unsupportedMilestones.join(", ")}.` });
      }
      if (guardrail.status === "approved") {
        if (!guardrail.rule.trim()) findings.push({ severity: "blocker", code: "blank-approved-learned-guardrail", message: `${guardrail.id} is approved but has no rule.` });
        if (!guardrail.approved_at?.trim()) findings.push({ severity: "blocker", code: "missing-guardrail-approval-time", message: `${guardrail.id} is approved but has no approval timestamp.` });
      }
    }
  }
  return findings;
}

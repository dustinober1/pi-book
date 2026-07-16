import type {
  BookStrategyPhase5,
  RevisionTicketsPhase5,
} from "../domain/v1-3-audit-schemas.js";

export interface LearningCandidate {
  patternId: string;
  ticketIds: string[];
  distinctChapters: number[];
  milestoneReviews: string[];
  eligible: boolean;
}

export interface LearningFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

function sortedUniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function sortedUniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function sameStrings(a: string[], b: string[]): boolean {
  return JSON.stringify(sortedUniqueStrings(a)) === JSON.stringify(sortedUniqueStrings(b));
}

function sameNumbers(a: number[], b: number[]): boolean {
  return JSON.stringify(sortedUniqueNumbers(a)) === JSON.stringify(sortedUniqueNumbers(b));
}

export function revisionLearningCandidates(tickets: RevisionTicketsPhase5): LearningCandidate[] {
  const groups = new Map<string, { ticketIds: string[]; chapters: number[]; reviews: string[] }>();
  for (const ticket of tickets.tickets) {
    const recurrence = ticket.recurrence;
    if (!recurrence?.pattern_id.trim()) continue;
    const patternId = recurrence.pattern_id.trim();
    const group = groups.get(patternId) ?? { ticketIds: [], chapters: [], reviews: [] };
    group.ticketIds.push(ticket.id);
    if (ticket.chapter !== null) group.chapters.push(ticket.chapter);
    if (recurrence.milestone_review) group.reviews.push(recurrence.milestone_review);
    groups.set(patternId, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([patternId, group]) => {
      const distinctChapters = sortedUniqueNumbers(group.chapters);
      const milestoneReviews = sortedUniqueStrings(group.reviews);
      return {
        patternId,
        ticketIds: sortedUniqueStrings(group.ticketIds),
        distinctChapters,
        milestoneReviews,
        eligible: distinctChapters.length >= 3 || milestoneReviews.length >= 2,
      };
    });
}

export function revisionLearningFindings(
  strategy: BookStrategyPhase5,
  tickets: RevisionTicketsPhase5,
): LearningFinding[] {
  const findings: LearningFinding[] = [];
  const candidates = new Map(revisionLearningCandidates(tickets).map((candidate) => [candidate.patternId, candidate]));
  const seenIds = new Set<string>();
  const seenPatterns = new Set<string>();

  for (const guardrail of strategy.revision_learning_guardrails ?? []) {
    if (seenIds.has(guardrail.id)) {
      findings.push({ severity: "blocker", code: "duplicate-learning-id", message: `Learning guardrail ID ${guardrail.id} is duplicated.` });
    }
    seenIds.add(guardrail.id);

    if (guardrail.status === "approved" && seenPatterns.has(guardrail.pattern_id)) {
      findings.push({ severity: "blocker", code: "duplicate-approved-pattern", message: `Pattern ${guardrail.pattern_id} has more than one approved learning guardrail.` });
    }
    if (guardrail.status === "approved") seenPatterns.add(guardrail.pattern_id);
    if (guardrail.status !== "approved") continue;

    const candidate = candidates.get(guardrail.pattern_id);
    if (!candidate?.eligible) {
      findings.push({
        severity: "blocker",
        code: "ineligible-learning-guardrail",
        message: `Approved learning guardrail ${guardrail.id} does not meet the threshold of three distinct chapters or two milestone reviews.`,
      });
      continue;
    }
    if (!sameStrings(guardrail.source_ticket_ids, candidate.ticketIds)) {
      findings.push({
        severity: "blocker",
        code: "learning-ticket-mismatch",
        message: `Approved learning guardrail ${guardrail.id} must reference exactly the supporting tickets for ${guardrail.pattern_id}.`,
      });
    }
    if (!sameNumbers(guardrail.distinct_chapters, candidate.distinctChapters)) {
      findings.push({
        severity: "blocker",
        code: "learning-chapter-mismatch",
        message: `Approved learning guardrail ${guardrail.id} has incorrect distinct-chapter evidence.`,
      });
    }
    if (!sameStrings(guardrail.milestone_reviews, candidate.milestoneReviews)) {
      findings.push({
        severity: "blocker",
        code: "learning-review-mismatch",
        message: `Approved learning guardrail ${guardrail.id} has incorrect milestone-review evidence.`,
      });
    }
  }

  return findings;
}

export function renderApprovedLearningGuardrails(strategy: BookStrategyPhase5): string {
  const rules = sortedUniqueStrings(
    (strategy.revision_learning_guardrails ?? [])
      .filter((guardrail) => guardrail.status === "approved")
      .map((guardrail) => guardrail.rule),
  );
  return rules.map((rule) => `- ${rule}`).join("\n");
}

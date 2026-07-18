import type { ChapterQueueState, GenreConfig, PlotGridState } from "../domain/schemas.js";
import type { HistoricalContext, InventionLedger } from "../domain/historical-fiction.js";
import type { SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import type { ResearchLedger } from "../domain/v1-3-schemas.js";
import type { DecisionLedger } from "../domain/v1-4-schemas.js";

export interface HistoricalIntegrityInput {
  genre: GenreConfig;
  context: HistoricalContext;
  inventions: InventionLedger;
  research: ResearchLedger;
  sources: SourceRegisterV13;
  queue: ChapterQueueState;
  plot: PlotGridState;
  decisions: DecisionLedger;
}

export interface HistoricalIntegrityFinding {
  severity: "blocker" | "warning";
  code: string;
  path: string;
  message: string;
}

function finding(code: string, path: string, message: string, severity: "blocker" | "warning" = "blocker"): HistoricalIntegrityFinding {
  return { severity, code, path, message };
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    else seen.add(value);
  }
  return [...repeated].sort();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sameSettings(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = [
    "story_mode", "relationship_to_history", "accuracy_contract", "prose_register",
    "real_person_policy", "counterfactual_policy",
  ];
  return keys.every((key) => left[key] === right[key])
    && Object.keys(left).length === keys.length
    && Object.keys(right).length === keys.length;
}

export function historicalIntegrityFindings(input: HistoricalIntegrityInput): HistoricalIntegrityFinding[] {
  const findings: HistoricalIntegrityFinding[] = [];
  const contextPath = `books/${input.context.book_id}/historical-context.yaml`;
  const ledgerPath = `books/${input.inventions.book_id}/invention-ledger.yaml`;

  if (!sameSettings(input.genre.settings, input.context.settings as unknown as Record<string, unknown>)) {
    findings.push(finding(
      "historical-settings-mismatch",
      contextPath,
      "Historical context settings must exactly match the authoritative genre.yaml settings.",
    ));
  }
  if (input.context.book_id !== input.inventions.book_id) {
    findings.push(finding("historical-book-id-mismatch", ledgerPath, "Historical context and invention ledger must name the same book."));
  }

  const chronologyIds = input.context.chronology.map((item) => item.id);
  const constraintIds = input.context.constraints.map((item) => item.id);
  const knowledgeIds = input.context.knowledge_boundaries.map((item) => item.id);
  const uncertaintyIds = input.context.uncertainties.map((item) => item.id);
  const inventionIds = input.inventions.entries.map((item) => item.id);
  const allHistoricalIds = [...chronologyIds, ...constraintIds, ...knowledgeIds, ...uncertaintyIds, ...inventionIds];
  for (const id of duplicates(allHistoricalIds)) {
    findings.push(finding("duplicate-historical-id", contextPath, `Historical ID ${id} is duplicated.`));
  }
  for (const sequence of duplicates(input.context.chronology.map((item) => String(item.sequence)))) {
    findings.push(finding("duplicate-chronology-sequence", contextPath, `Chronology sequence ${sequence} is duplicated.`));
  }
  for (let index = 1; index < input.context.chronology.length; index += 1) {
    if (input.context.chronology[index]!.sequence <= input.context.chronology[index - 1]!.sequence) {
      findings.push(finding("chronology-out-of-order", contextPath, "Chronology entries must be stored in increasing sequence order."));
      break;
    }
  }

  const chronologyById = new Map(input.context.chronology.map((item) => [item.id, item]));
  const constraintsById = new Map(input.context.constraints.map((item) => [item.id, item]));
  const knowledgeById = new Map(input.context.knowledge_boundaries.map((item) => [item.id, item]));
  const inventionsById = new Map(input.inventions.entries.map((item) => [item.id, item]));
  const researchById = new Map(input.research.items.map((item) => [item.id, item]));
  const sourceById = new Map(input.sources.sources.map((item) => [item.id, item]));
  const chapterNumbers = new Set(input.plot.chapters.map((item) => item.chapter));

  const checkEvidenceReferences = (owner: string, sourceIds: readonly string[], researchIds: readonly string[], path: string) => {
    for (const id of sourceIds) if (!sourceById.has(id)) findings.push(finding("unknown-historical-source", path, `${owner} references missing source ${id}.`));
    for (const id of researchIds) if (!researchById.has(id)) findings.push(finding("unknown-historical-research", path, `${owner} references missing research ${id}.`));
  };

  for (const entry of input.context.chronology) {
    checkEvidenceReferences(entry.id, entry.source_ids, entry.research_ids, contextPath);
    if (entry.certainty === "fictional" && !inventionsById.has(entry.invention_ref)) {
      findings.push(finding("unknown-invention-reference", contextPath, `${entry.id} references missing invention ${entry.invention_ref}.`));
    }
  }
  for (const constraint of input.context.constraints) {
    checkEvidenceReferences(constraint.id, constraint.source_ids, constraint.research_ids, contextPath);
    if (constraint.risk === "high") {
      const supported = constraint.research_ids.some((id) => {
        const item = researchById.get(id);
        return item?.status === "ready" && item.confidence !== "low";
      });
      if (!supported) findings.push(finding("high-risk-research-required", contextPath, `${constraint.id} is high risk and requires ready, non-low-confidence research.`));
    }
  }
  for (const boundary of input.context.knowledge_boundaries) {
    checkEvidenceReferences(boundary.id, [], boundary.research_ids, contextPath);
    if (!chronologyById.has(boundary.as_of)) {
      findings.push(finding("unknown-chronology-reference", contextPath, `${boundary.id} references missing chronology ${boundary.as_of}.`));
    }
  }
  for (const uncertainty of input.context.uncertainties) {
    checkEvidenceReferences(uncertainty.id, [], uncertainty.research_ids, contextPath);
    if (uncertainty.invention_ref && !inventionsById.has(uncertainty.invention_ref)) {
      findings.push(finding("unknown-invention-reference", contextPath, `${uncertainty.id} references missing invention ${uncertainty.invention_ref}.`));
    }
  }

  const replacedDecisionIds = new Set(input.decisions.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  const activeDecisionById = new Map(input.decisions.decisions.filter((item) => !replacedDecisionIds.has(item.id)).map((item) => [item.id, item]));
  const counterfactualPolicy = input.genre.settings["counterfactual_policy"];
  for (const invention of input.inventions.entries) {
    checkEvidenceReferences(invention.id, invention.source_ids, invention.research_ids, ledgerPath);
    for (const chapter of invention.affected_chapters) {
      if (!chapterNumbers.has(chapter)) findings.push(finding("unknown-affected-chapter", ledgerPath, `${invention.id} affects missing plot chapter ${chapter}.`));
    }
    if (invention.major_counterfactual && counterfactualPolicy === "prohibit-major") {
      findings.push(finding("major-counterfactual-prohibited", ledgerPath, `${invention.id} is a major counterfactual but genre policy prohibits major counterfactuals.`));
    }
    const requiresDecision = invention.classification === "counterfactual"
      || (invention.risk === "high" && ["compressed", "composite", "invented"].includes(invention.classification));
    if (requiresDecision) {
      const decision = invention.writer_decision_id ? activeDecisionById.get(invention.writer_decision_id) : undefined;
      const expectedChoice = `accept:${invention.classification}:${invention.risk}:${invention.disclosure}`;
      if (!decision
        || decision.scope !== input.inventions.book_id
        || decision.subject !== `historical-invention:${invention.id}`
        || decision.choice !== expectedChoice) {
        findings.push(finding(
          "historical-invention-decision-required",
          ledgerPath,
          `${invention.id} requires an active writer decision with subject historical-invention:${invention.id} and choice ${expectedChoice}.`,
        ));
      }
    }
  }

  for (const packet of input.queue.packets.filter((item) => item.status === "ready")) {
    const chronologyRefs = stringList(packet.profile_fields["chronology_refs"]);
    const constraintRefs = stringList(packet.profile_fields["constraint_refs"]);
    const inventionRefs = stringList(packet.profile_fields["invention_refs"]);
    const knowledgeBoundary = packet.profile_fields["knowledge_boundary"];
    for (const id of chronologyRefs) if (!chronologyById.has(id)) findings.push(finding("unknown-chronology-reference", contextPath, `Chapter ${packet.chapter} references missing chronology ${id}.`));
    for (const id of constraintRefs) if (!constraintsById.has(id)) findings.push(finding("unknown-constraint-reference", contextPath, `Chapter ${packet.chapter} references missing constraint ${id}.`));
    for (const id of inventionRefs) if (!inventionsById.has(id)) findings.push(finding("unknown-invention-reference", ledgerPath, `Chapter ${packet.chapter} references missing invention ${id}.`));
    if (typeof knowledgeBoundary !== "string" || !knowledgeById.has(knowledgeBoundary)) {
      findings.push(finding("unknown-knowledge-boundary", contextPath, `Chapter ${packet.chapter} references missing knowledge boundary ${String(knowledgeBoundary)}.`));
    }

    const readyResearch = packet.required_research.map((id) => researchById.get(id)).filter((item) => item?.status === "ready");
    const risk = packet.profile_fields["historical_risk"];
    if (risk === "high" && !readyResearch.some((item) => item!.confidence !== "low")) {
      findings.push(finding("high-risk-research-required", `books/${input.context.book_id}/chapter-queue.yaml`, `Chapter ${packet.chapter} is high risk and requires ready, non-low-confidence research.`));
    }
    if (risk === "medium" && readyResearch.length === 0 && inventionRefs.length === 0) {
      findings.push(finding("medium-risk-support-required", `books/${input.context.book_id}/chapter-queue.yaml`, `Chapter ${packet.chapter} is medium risk and requires ready research or a declared invention.`));
    }
  }

  return findings;
}

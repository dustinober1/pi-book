import type { SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import type { ResearchLedger } from "../domain/v1-3-schemas.js";

export interface ResearchEvidenceFinding {
  severity: "blocker" | "warning";
  code:
    | "duplicate-research-id"
    | "duplicate-source-id"
    | "missing-source"
    | "source-support-mismatch"
    | "missing-source-reliability"
    | "missing-source-observation-date"
    | "missing-dramatic-use"
    | "missing-story-decision"
    | "legacy-source-reference";
  message: string;
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

function nonblank(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function researchEvidenceFindings(
  ledger: ResearchLedger,
  sources: SourceRegisterV13,
): ResearchEvidenceFinding[] {
  const findings: ResearchEvidenceFinding[] = [];
  for (const id of duplicates(ledger.items.map((item) => item.id))) {
    findings.push({ severity: "blocker", code: "duplicate-research-id", message: `Duplicate research item id: ${id}.` });
  }
  for (const id of duplicates(sources.sources.map((source) => source.id))) {
    findings.push({ severity: "blocker", code: "duplicate-source-id", message: `Duplicate source id: ${id}.` });
  }

  const sourceById = new Map(sources.sources.map((source) => [source.id, source]));
  for (const item of ledger.items) {
    if (item.status !== "ready") continue;
    if (!item.dramatic_uses.length) {
      findings.push({ severity: "blocker", code: "missing-dramatic-use", message: `${item.id} is ready but has no dramatic use.` });
    }
    if (!nonblank(item.story_use.decision_affected)) {
      findings.push({ severity: "blocker", code: "missing-story-decision", message: `${item.id} is ready but does not identify the story decision it affects.` });
    }
    for (const sourceId of item.source_ids) {
      const source = sourceById.get(sourceId);
      if (!source) {
        findings.push({ severity: "blocker", code: "missing-source", message: `${item.id} references missing source ${sourceId}.` });
        continue;
      }
      if (!source.reliability || source.reliability === "unknown") {
        findings.push({ severity: "blocker", code: "missing-source-reliability", message: `${sourceId} must record reliability before supporting ready research ${item.id}.` });
      }
      if (!nonblank(source.observed_on) && !nonblank(source.verified_on)) {
        findings.push({ severity: "blocker", code: "missing-source-observation-date", message: `${sourceId} must record an observation or verification date before supporting ready research ${item.id}.` });
      }
      if (!source.supports_research_ids?.includes(item.id)) {
        findings.push({ severity: "blocker", code: "source-support-mismatch", message: `${sourceId} does not declare support for ${item.id}.` });
      }
    }
  }
  return findings;
}

import type { ResearchLedgerWithAnchors, ResearchItemWithAnchors } from "../domain/research-evidence-anchors.js";
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
    | "legacy-source-reference"
    | "anchor-source-not-declared"
    | "anchor-source-missing"
    | "anchor-source-support-mismatch"
    | "insufficient-high-risk-anchors";
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

function anchoredItem(item: ResearchLedger["items"][number] | ResearchItemWithAnchors): ResearchItemWithAnchors {
  return item as ResearchItemWithAnchors;
}

export function researchEvidenceFindings(
  ledger: ResearchLedger | ResearchLedgerWithAnchors,
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
  for (const rawItem of ledger.items) {
    if (rawItem.status !== "ready") continue;
    const item = anchoredItem(rawItem);
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

    const anchors = item.evidence_anchors ?? [];
    const validAnchors = anchors.filter((anchor) => {
      const declared = item.source_ids.includes(anchor.source_id);
      const source = sourceById.get(anchor.source_id);
      const linked = source?.supports_research_ids?.includes(item.id) ?? false;
      if (!declared) {
        findings.push({ severity: "blocker", code: "anchor-source-not-declared", message: `${item.id} anchor source ${anchor.source_id} is not listed in source_ids.` });
      }
      if (!source) {
        findings.push({ severity: "blocker", code: "anchor-source-missing", message: `${item.id} anchor references missing source ${anchor.source_id}.` });
      } else if (!linked) {
        findings.push({ severity: "blocker", code: "anchor-source-support-mismatch", message: `${anchor.source_id} does not declare support for anchored research ${item.id}.` });
      }
      return declared && Boolean(source) && linked;
    });

    if (item.accuracy_risk === "high") {
      const hasDirect = validAnchors.some((anchor) => anchor.support_type === "direct");
      const corroboratingSources = new Set(
        validAnchors.filter((anchor) => anchor.support_type === "corroborating").map((anchor) => anchor.source_id),
      );
      if (!hasDirect && corroboratingSources.size < 2) {
        findings.push({
          severity: "blocker",
          code: "insufficient-high-risk-anchors",
          message: `${item.id} is high-risk ready research and requires one direct anchor or two independent corroborating anchors.`,
        });
      }
    }
  }
  return findings;
}

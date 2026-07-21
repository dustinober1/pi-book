import type { FactCheckingPolicy, QualityTierId } from "../domain/quality-profile.js";
import type { ClaimAuditFinding, ProposedClaim } from "../domain/claim-audit.js";
import type { InventionLedger } from "../domain/historical-fiction.js";
import type { ResearchLedgerWithAnchors } from "../domain/research-evidence-anchors.js";
import { normalizedContentHash } from "./model-usage.js";

export interface ValidateProposedClaimsInput {
  chapterText: string;
  claims: readonly ProposedClaim[];
  research: ResearchLedgerWithAnchors;
  inventions?: InventionLedger;
  allowedResearchIds: readonly string[];
  allowedInventionIds?: readonly string[];
}

export interface ValidateClaimAuditFindingsInput {
  claims: readonly ProposedClaim[];
  findings: readonly ClaimAuditFinding[];
  research: ResearchLedgerWithAnchors;
}

export interface ClaimAuditDecision {
  blockers: ClaimAuditFinding[];
  repairs: ClaimAuditFinding[];
  accepted: ClaimAuditFinding[];
}

export function shouldRunClaimAudit(input: {
  tier: QualityTierId;
  factChecking: FactCheckingPolicy;
  riskLevel: "low" | "medium" | "high";
  historical: boolean;
}): boolean {
  if (input.factChecking === "off" || input.tier === "economy") return false;
  if (input.factChecking === "always" || input.tier === "editorial") return true;
  if (input.tier === "balanced") return input.historical || input.riskLevel === "high";
  return input.riskLevel === "medium" || input.riskLevel === "high";
}

export function claimTextHash(chapterText: string, lineStart: number, lineEnd: number): string {
  const lines = chapterText.replace(/\r\n?/g, "\n").split("\n");
  if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd) || lineStart < 1 || lineEnd < lineStart || lineEnd > lines.length) {
    throw new Error(`Claim line range ${lineStart}-${lineEnd} is outside the chapter.`);
  }
  return normalizedContentHash(lines.slice(lineStart - 1, lineEnd).join("\n"));
}

function duplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

export function validateProposedClaims(input: ValidateProposedClaimsInput): void {
  const duplicateId = duplicate(input.claims.map((claim) => claim.id));
  if (duplicateId) throw new Error(`Duplicate proposed claim id ${duplicateId}.`);
  const researchById = new Map(input.research.items.map((item) => [item.id, item]));
  const inventionById = new Map((input.inventions?.entries ?? []).map((item) => [item.id, item]));
  const allowedResearch = new Set(input.allowedResearchIds);
  const allowedInventions = new Set(input.allowedInventionIds ?? []);

  for (const claim of input.claims) {
    let expectedHash: string;
    try {
      expectedHash = claimTextHash(input.chapterText, claim.line_start, claim.line_end);
    } catch {
      throw new Error(`${claim.id} has an invalid line range ${claim.line_start}-${claim.line_end}.`);
    }
    if (claim.text_hash !== expectedHash) throw new Error(`${claim.id} text hash does not match its exact chapter lines.`);
    for (const researchId of claim.research_ids) {
      if (!researchById.has(researchId)) throw new Error(`${claim.id} references unknown research ${researchId}.`);
      if (!allowedResearch.has(researchId)) throw new Error(`${claim.id} research ${researchId} is not allowed by the chapter context.`);
    }
    if (claim.invention_ids.length > 0 && !input.inventions) {
      throw new Error(`${claim.id} contains invention references in a nonhistorical claim audit.`);
    }
    for (const inventionId of claim.invention_ids) {
      if (!inventionById.has(inventionId)) throw new Error(`${claim.id} references unknown invention ${inventionId}.`);
      if (!allowedInventions.has(inventionId)) throw new Error(`${claim.id} invention ${inventionId} is not allowed by the chapter packet.`);
    }
  }
}

function resolveAnchor(ref: string, research: ResearchLedgerWithAnchors) {
  const match = ref.match(/^(RES-[0-9]{3})#([1-9][0-9]*)$/);
  if (!match?.[1] || !match[2]) throw new Error(`Invalid evidence anchor reference ${ref}.`);
  const item = research.items.find((value) => value.id === match[1]);
  if (!item) throw new Error(`Evidence anchor reference ${ref} names unknown research ${match[1]}.`);
  const anchor = item.evidence_anchors?.[Number(match[2]) - 1];
  if (!anchor) throw new Error(`Evidence anchor reference ${ref} does not exist.`);
  return { researchId: match[1], anchor };
}

export function validateClaimAuditFindings(input: ValidateClaimAuditFindingsInput): void {
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const duplicateId = duplicate(input.findings.map((finding) => finding.claim_id));
  if (duplicateId) throw new Error(`Duplicate claim audit finding for ${duplicateId}.`);
  if (input.findings.length !== input.claims.length) throw new Error("Claim audit must return exactly one finding for every proposed claim.");

  for (const finding of input.findings) {
    const claim = claimById.get(finding.claim_id);
    if (!claim) throw new Error(`Claim audit finding references unknown claim ${finding.claim_id}.`);
    if (finding.status === "supported") {
      if (finding.action !== "accept" || finding.anchor_refs.length === 0) {
        throw new Error(`${finding.claim_id} supported finding requires accept plus at least one evidence anchor.`);
      }
      for (const ref of finding.anchor_refs) {
        const resolved = resolveAnchor(ref, input.research);
        if (!claim.research_ids.includes(resolved.researchId)) {
          throw new Error(`${finding.claim_id} anchor ${ref} is not attached to the proposed claim research IDs.`);
        }
      }
    } else if (finding.status === "invention") {
      if (finding.action !== "accept-invention" || claim.invention_ids.length === 0 || finding.anchor_refs.length > 0) {
        throw new Error(`${finding.claim_id} invention finding must cite an allowed invention without evidence anchors.`);
      }
    } else {
      if (finding.anchor_refs.length > 0) throw new Error(`${finding.claim_id} unsupported finding cannot cite supporting anchors.`);
      const allowed = claim.risk === "high"
        ? finding.action === "block"
        : finding.action === "qualify" || finding.action === "generalize" || finding.action === "block";
      if (!allowed) throw new Error(`${finding.claim_id} unsupported ${claim.risk}-risk finding has incompatible action ${finding.action}.`);
    }
  }
}

export function claimAuditDecision(input: {
  claims: readonly ProposedClaim[];
  findings: readonly ClaimAuditFinding[];
  factChecking: FactCheckingPolicy;
}): ClaimAuditDecision {
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const decision: ClaimAuditDecision = { blockers: [], repairs: [], accepted: [] };
  for (const finding of input.findings) {
    const claim = claimById.get(finding.claim_id);
    if (!claim) throw new Error(`Claim audit decision references unknown claim ${finding.claim_id}.`);
    if (finding.status !== "unsupported") {
      decision.accepted.push(finding);
    } else if (claim.risk === "high" || finding.action === "block") {
      decision.blockers.push(finding);
    } else if (claim.risk === "medium" || input.factChecking === "always") {
      decision.repairs.push(finding);
    }
  }
  return decision;
}

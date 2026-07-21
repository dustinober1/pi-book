import test from "node:test";
import assert from "node:assert/strict";
import {
  claimAuditDecision,
  claimTextHash,
  validateClaimAuditFindings,
  validateProposedClaims,
} from "../src/application/claim-audit.js";
import type { ClaimAuditFinding, ProposedClaim } from "../src/domain/claim-audit.js";
import type { ResearchLedgerWithAnchors } from "../src/domain/research-evidence-anchors.js";

const chapterText = [
  "# Chapter 2",
  "",
  "The release console required two authorized operators.",
  "Mara entered the first credential and waited for the second.",
].join("\n");

const research: ResearchLedgerWithAnchors = {
  schema_version: "1.0.0",
  items: [{
    id: "RES-001",
    lane: "story-world",
    claim: "The release console requires two operators.",
    source_ids: ["SRC-001"],
    confidence: "high",
    verified_on: "2026-07-21",
    fictionalization: { status: "simplified", reason: "Compress implementation detail." },
    knowledge_scope: { known_by: ["Mara"], incorrectly_believed_by: [], unknown_to: [] },
    risk: [],
    dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [2], decision_affected: "Mara needs a second operator." },
    notes: "",
    accuracy_risk: "high",
    evidence_anchors: [{
      source_id: "SRC-001",
      locator: "Section 4.2",
      support_type: "direct",
      paraphrase: "Two operators confirm release.",
      excerpt_hash: "a".repeat(64),
    }],
    status: "ready",
  }],
};

function proposed(overrides: Partial<ProposedClaim> = {}): ProposedClaim {
  return {
    id: "CLM-001",
    line_start: 3,
    line_end: 3,
    text_hash: claimTextHash(chapterText, 3, 3),
    claim_type: "procedural",
    risk: "high",
    research_ids: ["RES-001"],
    invention_ids: [],
    ...overrides,
  };
}

function finding(overrides: Partial<ClaimAuditFinding> = {}): ClaimAuditFinding {
  return {
    claim_id: "CLM-001",
    status: "supported",
    anchor_refs: ["RES-001#1"],
    action: "accept",
    reason: "The direct anchor supports the procedure.",
    ...overrides,
  };
}

test("proposed claims require exact line hashes and allowed research references", () => {
  assert.doesNotThrow(() => validateProposedClaims({
    chapterText,
    claims: [proposed()],
    research,
    allowedResearchIds: ["RES-001"],
  }));
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [proposed({ text_hash: "b".repeat(64) })],
    research,
    allowedResearchIds: ["RES-001"],
  }), /text hash/i);
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [proposed({ line_end: 99 })],
    research,
    allowedResearchIds: ["RES-001"],
  }), /line range/i);
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [proposed({ research_ids: ["RES-999"] })],
    research,
    allowedResearchIds: ["RES-001"],
  }), /RES-999/i);
});

test("supported findings must cite real anchors attached to the proposed claim", () => {
  const claims = [proposed()];
  assert.doesNotThrow(() => validateClaimAuditFindings({ claims, findings: [finding()], research }));
  assert.throws(() => validateClaimAuditFindings({
    claims,
    findings: [finding({ anchor_refs: ["RES-001#2"] })],
    research,
  }), /anchor/i);
  assert.throws(() => validateClaimAuditFindings({
    claims,
    findings: [finding({ anchor_refs: ["RES-999#1"] })],
    research,
  }), /RES-999/i);
});

test("high unsupported claims block while medium and always-audited low claims require repair", () => {
  const high = claimAuditDecision({
    claims: [proposed({ risk: "high" })],
    findings: [finding({ status: "unsupported", anchor_refs: [], action: "block" })],
    factChecking: "risk-based",
  });
  assert.equal(high.blockers.length, 1);
  assert.equal(high.repairs.length, 0);

  const medium = claimAuditDecision({
    claims: [proposed({ risk: "medium" })],
    findings: [finding({ status: "unsupported", anchor_refs: [], action: "qualify" })],
    factChecking: "risk-based",
  });
  assert.equal(medium.blockers.length, 0);
  assert.equal(medium.repairs.length, 1);

  const lowRiskBased = claimAuditDecision({
    claims: [proposed({ risk: "low" })],
    findings: [finding({ status: "unsupported", anchor_refs: [], action: "generalize" })],
    factChecking: "risk-based",
  });
  assert.equal(lowRiskBased.repairs.length, 0);

  const lowAlways = claimAuditDecision({
    claims: [proposed({ risk: "low" })],
    findings: [finding({ status: "unsupported", anchor_refs: [], action: "generalize" })],
    factChecking: "always",
  });
  assert.equal(lowAlways.repairs.length, 1);
});

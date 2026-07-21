import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import { researchEvidenceFindings } from "../src/application/research-evidence.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../src/domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, type ResearchLedger } from "../src/domain/v1-3-schemas.js";

function readyItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "RES-001",
    lane: "story-world",
    claim: "The control room uses a two-person release procedure.",
    source_ids: ["SRC-001"],
    confidence: "high",
    verified_on: "2026-07-21",
    fictionalization: { status: "simplified", reason: "Compress jurisdiction-specific detail." },
    knowledge_scope: { known_by: ["Mara"], incorrectly_believed_by: [], unknown_to: ["Jonah"] },
    risk: ["procedure varies by jurisdiction"],
    dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [4], decision_affected: "Mara must recruit a second operator." },
    notes: "",
    status: "ready",
    ...overrides,
  };
}

function ledger(item: unknown): ResearchLedger {
  return { schema_version: "1.0.0", items: [item] } as ResearchLedger;
}

function source(id: string, researchIds: string[] = ["RES-001"]): SourceRegisterV13["sources"][number] {
  return {
    id,
    type: "primary-document",
    title: `${id} operations manual`,
    location: `research/${id}.md`,
    verified_on: "2026-07-21",
    supports: [],
    notes: "",
    reliability: "primary",
    observed_on: "2026-07-21",
    supports_research_ids: researchIds,
  };
}

function sources(...items: SourceRegisterV13["sources"]): SourceRegisterV13 {
  return { schema_version: "1.0.0", sources: items.flat() };
}

const direct = {
  source_id: "SRC-001",
  locator: "Section 4.2, release procedure",
  support_type: "direct",
  paraphrase: "Two authorized operators must confirm the release.",
  excerpt_hash: "a".repeat(64),
};

const corroborating = (sourceId: string, hash: string) => ({
  source_id: sourceId,
  locator: "Release workflow discussion",
  support_type: "corroborating",
  paraphrase: "The procedure requires two independent confirmations.",
  excerpt_hash: hash.repeat(64),
});

test("legacy research items and source records remain schema-readable", () => {
  assert.equal(Value.Check(ResearchLedgerSchema, ledger(readyItem())), true);
  assert.equal(Value.Check(SourceRegisterV13Schema, sources(source("SRC-001"))), true);
});

test("evidence anchors are bounded typed records", () => {
  const valid = ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [direct] }));
  assert.equal(Value.Check(ResearchLedgerSchema, valid), true);

  const blankLocator = ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [{ ...direct, locator: "" }] }));
  assert.equal(Value.Check(ResearchLedgerSchema, blankLocator), false);

  const longParaphrase = ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [{ ...direct, paraphrase: "x".repeat(501) }] }));
  assert.equal(Value.Check(ResearchLedgerSchema, longParaphrase), false);

  const rawExcerpt = ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [{ ...direct, excerpt_hash: "raw source quotation" }] }));
  assert.equal(Value.Check(ResearchLedgerSchema, rawExcerpt), false);
});

test("high-risk ready research requires one direct anchor", () => {
  const missing = researchEvidenceFindings(
    ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [] })),
    sources(source("SRC-001")),
  );
  assert.ok(missing.some((finding) => finding.code === "insufficient-high-risk-anchors" && finding.severity === "blocker"));

  const complete = researchEvidenceFindings(
    ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [direct] })),
    sources(source("SRC-001")),
  );
  assert.equal(complete.some((finding) => finding.code === "insufficient-high-risk-anchors"), false);
});

test("two independent corroborating anchors satisfy high-risk readiness", () => {
  const complete = researchEvidenceFindings(
    ledger(readyItem({
      source_ids: ["SRC-001", "SRC-002"],
      accuracy_risk: "high",
      evidence_anchors: [corroborating("SRC-001", "b"), corroborating("SRC-002", "c")],
    })),
    sources(source("SRC-001"), source("SRC-002")),
  );
  assert.equal(complete.some((finding) => finding.code === "insufficient-high-risk-anchors"), false);

  const repeatedSource = researchEvidenceFindings(
    ledger(readyItem({
      accuracy_risk: "high",
      evidence_anchors: [corroborating("SRC-001", "b"), corroborating("SRC-001", "c")],
    })),
    sources(source("SRC-001")),
  );
  assert.ok(repeatedSource.some((finding) => finding.code === "insufficient-high-risk-anchors"));
});

test("anchors must name declared, registered sources linked to the research item", () => {
  const findings = researchEvidenceFindings(
    ledger(readyItem({ accuracy_risk: "high", evidence_anchors: [{ ...direct, source_id: "SRC-002" }] })),
    sources(source("SRC-001"), source("SRC-002", [])),
  );
  assert.ok(findings.some((finding) => finding.code === "anchor-source-not-declared"));
  assert.ok(findings.some((finding) => finding.code === "anchor-source-support-mismatch"));
});

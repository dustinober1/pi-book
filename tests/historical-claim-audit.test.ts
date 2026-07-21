import test from "node:test";
import assert from "node:assert/strict";
import { claimTextHash, validateProposedClaims } from "../src/application/claim-audit.js";
import type { ProposedClaim } from "../src/domain/claim-audit.js";
import type { InventionLedger } from "../src/domain/historical-fiction.js";
import type { ResearchLedgerWithAnchors } from "../src/domain/research-evidence-anchors.js";

const chapterText = "# Chapter 4\n\nThe composite minister signed the fictional emergency order.\n";
const research: ResearchLedgerWithAnchors = { schema_version: "1.0.0", items: [] };
const inventions: InventionLedger = {
  schema_version: "1.0.0",
  book_id: "book-01",
  entries: [{
    id: "INV-001",
    claim: "A composite minister signs the emergency order.",
    risk: "medium",
    rationale: "Condense several documented offices.",
    story_necessity: "Keep the political decision legible.",
    affected_chapters: [4],
    portrayal_risks: [],
    continuity_risks: [],
    disclosure: "historical-note",
    writer_decision_id: null,
    major_counterfactual: false,
    classification: "composite",
    source_ids: [],
    research_ids: [],
  }],
};

function claim(inventionIds: string[]): ProposedClaim {
  return {
    id: "CLM-001",
    line_start: 3,
    line_end: 3,
    text_hash: claimTextHash(chapterText, 3, 3),
    claim_type: "biographical",
    risk: "medium",
    research_ids: [],
    invention_ids: inventionIds,
  };
}

test("historical claim inventions must exist and be explicitly allowed by the chapter packet", () => {
  assert.doesNotThrow(() => validateProposedClaims({
    chapterText,
    claims: [claim(["INV-001"])],
    research,
    inventions,
    allowedResearchIds: [],
    allowedInventionIds: ["INV-001"],
  }));
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [claim(["INV-999"])],
    research,
    inventions,
    allowedResearchIds: [],
    allowedInventionIds: ["INV-001"],
  }), /INV-999/i);
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [claim(["INV-001"])],
    research,
    inventions,
    allowedResearchIds: [],
    allowedInventionIds: [],
  }), /not allowed/i);
});

test("nonhistorical claim audits reject invention references", () => {
  assert.throws(() => validateProposedClaims({
    chapterText,
    claims: [claim(["INV-001"])],
    research,
    allowedResearchIds: [],
  }), /invention/i);
});

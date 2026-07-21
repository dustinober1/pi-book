import test from "node:test";
import assert from "node:assert/strict";
import {
  assertKnowledgeAvailable,
  establishedKnowledgeRecords,
  hasEstablishedKnowledge,
} from "../src/application/knowledge-ledger.js";
import type { KnowledgeLedger } from "../src/domain/knowledge-ledger.js";

function ledger(): KnowledgeLedger {
  return {
    schema_version: "1.0.0",
    records: [
      {
        id: "KNOW-MARA-ACCESS",
        knower_id: "CHAR-MARA",
        fact_id: "FACT-ACCESS",
        knowledge: "known",
        status: "accepted-manuscript-fact",
        source: "chapter-01",
        introduced_in: "chapter-01",
        evidence_ids: ["C01-P004"],
      },
      {
        id: "KNOW-MARA-TRAITOR-PLAN",
        knower_id: "CHAR-MARA",
        fact_id: "SECRET-TRAITOR",
        knowledge: "known",
        status: "proposed-plan",
        source: "outline",
        introduced_in: null,
        evidence_ids: [],
      },
      {
        id: "KNOW-READER-TRAITOR",
        knower_id: "READER",
        fact_id: "SECRET-TRAITOR",
        knowledge: "suspected",
        status: "current-state",
        source: "chapter-01",
        introduced_in: "chapter-01",
        evidence_ids: ["C01-P020"],
      },
    ],
  };
}

test("proposed knowledge is not available to a character", () => {
  const value = ledger();
  assert.equal(hasEstablishedKnowledge(value, "CHAR-MARA", "FACT-ACCESS"), true);
  assert.equal(hasEstablishedKnowledge(value, "CHAR-MARA", "SECRET-TRAITOR"), false);
  assert.throws(() => assertKnowledgeAvailable(value, "CHAR-MARA", "SECRET-TRAITOR"), /does not have established knowledge/i);
});

test("reader and character knowledge remain separate", () => {
  const value = ledger();
  assert.deepEqual(establishedKnowledgeRecords(value, "READER").map((item) => item.id), ["KNOW-READER-TRAITOR"]);
  assert.deepEqual(establishedKnowledgeRecords(value, "CHAR-MARA").map((item) => item.id), ["KNOW-MARA-ACCESS"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { effectiveKnowledge, knowledgeLedgerFindings } from "../src/application/story-state/knowledge-ledger.js";
import { effectiveObjectCustody, objectLedgerFindings } from "../src/application/story-state/object-ledger.js";
import { orderedTimeline, timelineFindings } from "../src/application/story-state/timeline-ledger.js";
import type { KnowledgeLedger } from "../src/domain/knowledge-ledger.js";
import type { ObjectLedger } from "../src/domain/object-ledger.js";
import type { TimelineLedger } from "../src/domain/timeline-ledger.js";

test("effective knowledge preserves explicit ignorance and excludes proposed plans", () => {
  const ledger: KnowledgeLedger = {
    schema_version: "1.0.0",
    records: [
      { id: "KNOW-MARA-001", version: 1, status: "CURRENT_STATE", character_ref: "CHAR-MARA-001", fact_ref: "FACT-USER-IDENTITY-001", state: "does-not-know", source_refs: ["CH-001"], introduced_in: "CH-001", supersedes: null },
      { id: "PLAN-KNOW-MARA-002", version: 2, status: "PROPOSED_PLAN", character_ref: "CHAR-MARA-001", fact_ref: "FACT-USER-IDENTITY-001", state: "knows", source_refs: ["CH-004"], introduced_in: "CH-004", supersedes: "KNOW-MARA-001" },
    ],
  };
  assert.deepEqual(knowledgeLedgerFindings(ledger), []);
  assert.equal(effectiveKnowledge(ledger).get("CHAR-MARA-001:FACT-USER-IDENTITY-001")?.state, "does-not-know");
});

test("object custody resolves the newest authoritative holder and detects ambiguous versions", () => {
  const ledger: ObjectLedger = {
    schema_version: "1.0.0",
    records: [
      { id: "OBJ-BADGE-001", version: 1, status: "ACCEPTED_MANUSCRIPT_FACT", object_ref: "ITEM-BADGE-001", holder_ref: "CHAR-MARA-001", location_ref: null, state: "intact", source_refs: ["CH-001"], introduced_in: "CH-001", supersedes: null },
      { id: "OBJ-BADGE-002", version: 2, status: "CURRENT_STATE", object_ref: "ITEM-BADGE-001", holder_ref: null, location_ref: "LOC-ARCHIVE-001", state: "left-in-reader", source_refs: ["CH-002"], introduced_in: "CH-002", supersedes: "OBJ-BADGE-001" },
    ],
  };
  assert.deepEqual(objectLedgerFindings(ledger), []);
  assert.equal(effectiveObjectCustody(ledger).get("ITEM-BADGE-001")?.location_ref, "LOC-ARCHIVE-001");
  ledger.records.push({ ...ledger.records[1]!, id: "OBJ-BADGE-ALT-002", location_ref: "LOC-LOBBY-001" });
  assert.ok(objectLedgerFindings(ledger).some((finding) => finding.code === "ambiguous-object-state"));
});

test("timeline ordering is deterministic and duplicate authoritative sequence positions block", () => {
  const ledger: TimelineLedger = {
    schema_version: "1.0.0",
    records: [
      { id: "TIME-EVENT-002", version: 1, status: "CURRENT_STATE", sequence: 20, time_ref: "TIME-DAY1-2225", description: "Mara reads the log.", location_ref: "LOC-ARCHIVE-001", participant_refs: ["CHAR-MARA-001"], source_refs: ["CH-001"] },
      { id: "TIME-EVENT-001", version: 1, status: "CURRENT_STATE", sequence: 10, time_ref: "TIME-DAY1-2215", description: "Mara enters the archive.", location_ref: "LOC-ARCHIVE-001", participant_refs: ["CHAR-MARA-001"], source_refs: ["CH-001"] },
    ],
  };
  assert.deepEqual(orderedTimeline(ledger).map((record) => record.id), ["TIME-EVENT-001", "TIME-EVENT-002"]);
  ledger.records.push({ ...ledger.records[1]!, id: "TIME-EVENT-ALT-001" });
  assert.ok(timelineFindings(ledger).some((finding) => finding.code === "duplicate-timeline-sequence"));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidStateLedger,
  establishedStateRecords,
  stateLedgerFindings,
  stateValue,
} from "../src/application/state-ledger.js";
import type { StateLedger } from "../src/domain/state-ledger.js";

function ledger(): StateLedger {
  return {
    schema_version: "1.0.0",
    records: [
      {
        id: "STATE-MARA-LOCATION",
        subject_id: "CHAR-MARA",
        field: "location",
        value: "LOC-ARCHIVE",
        status: "current-state",
        source: "chapter-01",
        introduced_in: "chapter-01",
        updated_in: "chapter-01",
        evidence_ids: ["C01-P004"],
      },
      {
        id: "STATE-MARA-FUTURE-RANK",
        subject_id: "CHAR-MARA",
        field: "rank",
        value: "director",
        status: "proposed-plan",
        source: "outline",
        introduced_in: null,
        updated_in: null,
        evidence_ids: [],
      },
      {
        id: "STATE-MARA-OLD-LOCATION",
        subject_id: "CHAR-MARA",
        field: "location",
        value: "LOC-HOME",
        status: "deprecated",
        source: "chapter-00",
        introduced_in: "chapter-00",
        updated_in: "chapter-01",
        evidence_ids: ["C00-P001"],
      },
    ],
  };
}

test("only established state records are available as current reality", () => {
  const value = ledger();
  assert.deepEqual(establishedStateRecords(value).map((item) => item.id), ["STATE-MARA-LOCATION"]);
  assert.equal(stateValue(value, "CHAR-MARA", "location"), "LOC-ARCHIVE");
  assert.equal(stateValue(value, "CHAR-MARA", "rank"), undefined);
});

test("multiple established values for one subject field block", () => {
  const value = ledger();
  value.records.push({
    id: "STATE-MARA-LOCATION-2",
    subject_id: "CHAR-MARA",
    field: "location",
    value: "LOC-ROOF",
    status: "accepted-manuscript-fact",
    source: "chapter-01",
    introduced_in: "chapter-01",
    updated_in: "chapter-01",
    evidence_ids: ["C01-P010"],
  });
  assert.match(stateLedgerFindings(value).join("\n"), /multiple established state records/i);
  assert.throws(() => assertValidStateLedger(value), /state ledger validation failed/i);
});

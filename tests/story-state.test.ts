import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  effectiveStoryState,
  storyStateFindings,
} from "../src/application/story-state/story-state.js";
import {
  StoryStateSchema,
  type StoryState,
} from "../src/domain/story-state.js";

function state(): StoryState {
  return {
    schema_version: "1.0.0",
    records: [
      {
        id: "STATE-MARA-LOCATION-001",
        version: 1,
        status: "CURRENT_STATE",
        subject_ref: "CHAR-MARA-001",
        field: "location",
        value: "LOC-ARCHIVE-001",
        source_refs: ["CH-001"],
        introduced_in: "CH-001",
        supersedes: null,
      },
      {
        id: "PLAN-MARA-LOCATION-002",
        version: 2,
        status: "PROPOSED_PLAN",
        subject_ref: "CHAR-MARA-001",
        field: "location",
        value: "LOC-VAULT-002",
        source_refs: ["CH-002"],
        introduced_in: "CH-002",
        supersedes: "STATE-MARA-LOCATION-001",
      },
      {
        id: "FACT-ARCHIVE-LOCKED-001",
        version: 1,
        status: "LOCKED_CANON",
        subject_ref: "LOC-ARCHIVE-001",
        field: "access_mode",
        value: "credential-required",
        source_refs: ["series/canon.yaml"],
        introduced_in: "book-01",
        supersedes: null,
      },
    ],
  };
}

test("drafting state excludes proposed future plans from current reality", () => {
  const value = state();
  assert.equal(Value.Check(StoryStateSchema, value), true);
  const effective = effectiveStoryState(value);
  assert.equal(effective.get("CHAR-MARA-001:location")?.value, "LOC-ARCHIVE-001");
  assert.equal(effective.get("LOC-ARCHIVE-001:access_mode")?.value, "credential-required");
  assert.equal([...effective.values()].some((record) => record.status === "PROPOSED_PLAN"), false);
});

test("state findings block ambiguous current values and broken supersession", () => {
  const value = state();
  value.records.push({
    id: "STATE-MARA-LOCATION-ALT-001",
    version: 1,
    status: "CURRENT_STATE",
    subject_ref: "CHAR-MARA-001",
    field: "location",
    value: "LOC-LOBBY-001",
    source_refs: ["CH-001"],
    introduced_in: "CH-001",
    supersedes: "STATE-NOT-FOUND-999",
  });
  const codes = storyStateFindings(value).map((finding) => finding.code);
  assert.ok(codes.includes("ambiguous-current-state"));
  assert.ok(codes.includes("missing-superseded-state"));
});

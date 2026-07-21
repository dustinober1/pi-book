import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateContext,
  ContextBudgetError,
  paragraphContextRecords,
  type ContextSection,
} from "../src/context/context-budget.js";

function section(overrides: Partial<ContextSection> = {}): ContextSection {
  return {
    id: "canon",
    title: "Canon",
    maxChars: 10_000,
    records: [],
    ...overrides,
  };
}

test("records are included completely or omitted completely", () => {
  const firstBody = JSON.stringify({ id: "CAN-001", fact: "A".repeat(120) }, null, 2);
  const secondBody = JSON.stringify({ id: "CAN-002", fact: "B".repeat(120) }, null, 2);
  const input = [section({ records: [
    { id: "CAN-001", body: firstBody, required: false, priority: 10 },
    { id: "CAN-002", body: secondBody, required: false, priority: 5 },
  ] })];
  const oneRecordBudget = `\n## Canon\n\n### CAN-001\n\n${firstBody}\n`.length;
  const result = allocateContext(input, oneRecordBudget);

  assert.match(result.text, /CAN-001/);
  assert.ok(result.text.includes(firstBody));
  assert.doesNotMatch(result.text, /CAN-002/);
  assert.deepEqual(result.report.includedRecordIds, ["CAN-001"]);
  assert.deepEqual(result.report.omittedRecordIds, ["CAN-002"]);
});

test("required records are allocated before optional records regardless of section order", () => {
  const result = allocateContext([
    section({ id: "optional", title: "Optional", records: [
      { id: "OPT-001", body: "O".repeat(180), required: false, priority: 100 },
    ] }),
    section({ id: "required", title: "Required", records: [
      { id: "REQ-001", body: "required body", required: true, priority: 1 },
    ] }),
  ], 80);

  assert.match(result.text, /REQ-001/);
  assert.doesNotMatch(result.text, /OPT-001/);
  assert.deepEqual(result.report.includedRecordIds, ["REQ-001"]);
});

test("equal-priority records retain deterministic input selection order", () => {
  const input = [section({ records: [
    { id: "CAN-001", body: "one", required: false, priority: 10 },
    { id: "CAN-002", body: "two", required: false, priority: 10 },
    { id: "CAN-003", body: "three", required: false, priority: 10 },
  ] })];
  const budget = `\n## Canon\n\n### CAN-001\n\none\n\n### CAN-002\n\ntwo\n`.length;
  const first = allocateContext(input, budget);
  const second = allocateContext(input, budget);

  assert.deepEqual(first.report.includedRecordIds, ["CAN-001", "CAN-002"]);
  assert.deepEqual(first, second);
});

test("previous-context paragraphs prefer the newest complete paragraph", () => {
  const records = paragraphContextRecords("previous", "old paragraph\n\nmiddle paragraph\n\nnewest paragraph", 50);
  assert.deepEqual(records.map((record) => record.priority), [51, 52, 53]);
  const newest = records[2]!;
  const budget = `\n## Previous\n\n### ${newest.id}\n\n${newest.body}\n`.length;
  const result = allocateContext([section({ id: "previous", title: "Previous", records })], budget);

  assert.deepEqual(result.report.includedRecordIds, ["previous:paragraph:0003"]);
  assert.match(result.text, /newest paragraph/);
  assert.doesNotMatch(result.text, /old paragraph|middle paragraph/);
});

test("required overflow names every omitted required record", () => {
  const input = [section({ maxChars: 45, records: [
    { id: "HIST-001", body: "A".repeat(50), required: true, priority: 100 },
    { id: "HC-001", body: "B".repeat(50), required: true, priority: 90 },
  ] })];

  assert.throws(
    () => allocateContext(input, 200),
    (error: unknown) => {
      assert.ok(error instanceof ContextBudgetError);
      assert.deepEqual(error.requiredRecordIds, ["HIST-001", "HC-001"]);
      assert.match(error.message, /HIST-001, HC-001/);
      return true;
    },
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { distillContext, type ContextCandidate } from "../src/context/context-distiller.js";

const candidates: ContextCandidate[] = [
  { id: "packet", title: "Approved chapter packet", priority: 1, required: true, body: "P".repeat(1200), compactBody: "packet: CH-001\npurpose: enter", recordIds: ["CH-001"] },
  { id: "canon", title: "Relevant canon", priority: 2, required: true, body: "C".repeat(1400), compactBody: "CAN-001|locked|Mara knows the signal", recordIds: ["CAN-001"] },
  { id: "threads", title: "Story threads", priority: 3, required: false, body: "T".repeat(900), compactBody: "THR-001|active|signal source", recordIds: ["THR-001"] },
];

test("distillation is deterministic and preserves priority", () => {
  const first = distillContext(candidates, { profileId: "local", maxChars: 1800 });
  const second = distillContext(candidates, { profileId: "local", maxChars: 1800 });
  assert.deepEqual(first, second);
  assert.ok(first.text.indexOf("Approved chapter packet") < first.text.indexOf("Relevant canon"));
  assert.ok(first.text.length <= 1800);
});

test("required sections compact before optional sections are omitted", () => {
  const result = distillContext(candidates, { profileId: "tiny-local", maxChars: 500 });
  const packet = result.report.sections.find((item) => item.id === "packet");
  const canon = result.report.sections.find((item) => item.id === "canon");
  const threads = result.report.sections.find((item) => item.id === "threads");
  assert.equal(packet?.status, "compacted");
  assert.equal(canon?.status, "compacted");
  assert.equal(threads?.status, "omitted");
  assert.match(result.text, /CH-001/);
  assert.match(result.text, /CAN-001/);
});

test("a required section that cannot fit fails before inference", () => {
  assert.throws(
    () => distillContext([{ id: "required", title: "Required", priority: 1, required: true, body: "x".repeat(1000), recordIds: ["REQ-1"] }], { profileId: "tiny-local", maxChars: 100 }),
    /cannot fit required context section.*required/i,
  );
});

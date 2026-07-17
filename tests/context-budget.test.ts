import test from "node:test";
import assert from "node:assert/strict";
import { distillContext } from "../src/context/context-distiller.js";

test("required selection reserves minimum space for later required sections", () => {
  const result = distillContext([
    { id: "first", title: "First", priority: 1, required: true, body: "A".repeat(600), compactBody: "FIRST-COMPACT", recordIds: ["A-1"] },
    { id: "second", title: "Second", priority: 2, required: true, body: "B".repeat(600), compactBody: "SECOND-COMPACT", recordIds: ["B-1"] },
  ], { profileId: "tiny-local", maxChars: 700 });
  assert.ok(result.text.length <= 700);
  assert.match(result.text, /FIRST-COMPACT/);
  assert.equal(result.report.sections.find((item) => item.id === "first")?.status, "compacted");
  assert.notEqual(result.report.sections.find((item) => item.id === "second")?.status, "blocked");
});

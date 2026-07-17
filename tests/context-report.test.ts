import test from "node:test";
import assert from "node:assert/strict";
import { distillContext } from "../src/context/context-distiller.js";

test("context reports expose counts and decisions without raw content", () => {
  const secret = "PRIVATE-SOURCE-TEXT-987";
  const result = distillContext([
    { id: "packet", title: "Packet", priority: 1, required: true, body: secret.repeat(20), compactBody: "CH-001|purpose|enter", recordIds: ["CH-001"] },
    { id: "optional", title: "Optional", priority: 2, required: false, body: "optional body", recordIds: [] },
  ], { profileId: "local", maxChars: 180 });
  assert.equal(result.report.schemaVersion, "1.0.0");
  assert.equal(result.report.profileId, "local");
  assert.equal(result.report.renderedChars, result.text.length);
  assert.equal(result.report.estimatedTokens, Math.ceil(result.text.length / 4));
  const serialized = JSON.stringify(result.report);
  assert.doesNotMatch(serialized, /PRIVATE-SOURCE-TEXT-987/);
  assert.deepEqual(result.report.sections.map((item) => item.id), ["packet", "optional"]);
});

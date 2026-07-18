import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDocument } from "../src/application/prose-lint/normalize.js";
import { runProseLint } from "../src/application/prose-lint/engine.js";
import { defaultProseLintRules } from "../src/application/prose-lint/index.js";
import { renderReviewLintEvidence } from "../src/application/prose-lint/report.js";

test("prose lint reports mechanics and renders findings as actionable review evidence", () => {
  const input = { documents: [normalizeDocument("chapter-01.md", "The the door opened.\nThis chapter explains the plan.", 1)], rules: defaultProseLintRules };
  const result = runProseLint(input);
  assert.ok(result.findings.some((finding) => finding.ruleId === "mechanics/doubled-word"));
  assert.match(renderReviewLintEvidence(result), /Deterministic prose-lint evidence/);
});

test("normalization ignores fenced code and preserves source line locations", () => {
  const document = normalizeDocument("notes.md", "```\nThe the\n```\nThe the door.", 1);
  assert.equal(document.scanText.includes("The the\n```"), false);
  assert.equal(document.lines[3], "The the door.");
  assert.equal(document.wordCount, 3);
});

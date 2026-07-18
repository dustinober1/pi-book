import assert from "node:assert/strict";
import test from "node:test";
import { runProseLint } from "../src/application/prose-lint/engine.js";
import { normalizeDocument } from "../src/application/prose-lint/normalize.js";
import { mechanicalRules } from "../src/application/prose-lint/rules/mechanics.js";
import type { LintRule } from "../src/application/prose-lint/types.js";

test("mechanical rules report deterministic, line-specific findings outside Markdown exclusions", () => {
  const source = [
    "# Heading heading , TKTK",
    "The the lantern went out.",
    "A pause , then silence.",
    "Was that real?!?!",
    "[[TODO: repair]]",
    "[[FIXME: resolve]]",
    "TKTK",
    "The thought remained (unfinished.",
    "```ts",
    "const duplicate duplicate = 'wait , no?!?! [[TODO: hidden]] TKTK (';",
    "```",
    "---",
  ].join("\n");
  const original = source;

  const result = runProseLint({
    documents: [normalizeDocument("01-opening.md", source, 1)],
    rules: mechanicalRules,
  });

  assert.deepEqual(result.findings.map((finding) => finding.ruleId), [
    "mechanics/doubled-word",
    "mechanics/drafting-marker",
    "mechanics/drafting-marker",
    "mechanics/drafting-marker",
    "mechanics/punctuation-spacing",
    "mechanics/repeated-punctuation",
    "mechanics/unbalanced-punctuation",
  ]);
  assert.deepEqual(result.findings.map((finding) => finding.location.line), [2, 5, 6, 7, 3, 4, 8]);
  assert.equal(result.findings[0]?.class, "mechanical");
  assert.equal(result.findings[0]?.confidence, "high");
  assert.ok(result.findings.every((finding) => finding.excerpt.length <= 160));
  assert.equal(result.counts.mechanical, 7);
  assert.equal(result.failures.length, 0);
  assert.equal(source, original);
});

test("normalization preserves source lines while blanking fenced code and deriving Markdown-aware text views", () => {
  const source = [
    "First sentence. Second sentence!",
    "",
    "Second paragraph has Words.",
    "```text",
    "hidden hidden , TKTK",
    "```",
  ].join("\n");

  const document = normalizeDocument("02-normalized.md", source, 4);

  assert.deepEqual(document.lines, source.split("\n"));
  assert.deepEqual(document.scanText.split("\n").slice(3), ["", "", ""]);
  assert.deepEqual(document.tokens, ["first", "sentence", "second", "sentence", "second", "paragraph", "has", "words"]);
  assert.deepEqual(document.sentences, [
    { text: "First sentence.", line: 1 },
    { text: "Second sentence!", line: 1 },
    { text: "Second paragraph has Words.", line: 3 },
  ]);
  assert.deepEqual(document.paragraphs.map((paragraph) => paragraph.line), [1, 3]);
  assert.equal(document.wordCount, 8);
  assert.equal(document.order, 4);
  assert.equal(source.includes("hidden hidden"), true);
});

test("engine continues after a failed rule and sorts equal-class findings by rule, document, line, and excerpt", () => {
  const ruleA: LintRule = {
    id: "mechanics/zeta",
    version: "1",
    run: () => [{
      ruleId: "mechanics/zeta",
      ruleVersion: "1",
      class: "mechanical",
      confidence: "high",
      location: { path: "b.md", line: 2 },
      excerpt: "zeta",
      message: "Zeta finding",
      evidence: {},
      reviewAction: "Review it.",
    }],
  };
  const brokenRule: LintRule = {
    id: "mechanics/broken",
    version: "1",
    run: () => { throw new Error("intentional failure"); },
  };
  const ruleB: LintRule = {
    id: "mechanics/alpha",
    version: "1",
    run: () => [{
      ruleId: "mechanics/alpha",
      ruleVersion: "1",
      class: "mechanical",
      confidence: "high",
      location: { path: "a.md", line: 1 },
      excerpt: "alpha",
      message: "Alpha finding",
      evidence: {},
      reviewAction: "Review it.",
    }],
  };

  const result = runProseLint({
    documents: [normalizeDocument("a.md", "One.", 2), normalizeDocument("b.md", "Two.", 1)],
    rules: [ruleA, brokenRule, ruleB],
  });

  assert.deepEqual(result.findings.map((finding) => finding.ruleId), ["mechanics/alpha", "mechanics/zeta"]);
  assert.deepEqual(result.failures, [{ ruleId: "mechanics/broken", message: "intentional failure" }]);
  assert.equal(result.wordCount, 2);
});

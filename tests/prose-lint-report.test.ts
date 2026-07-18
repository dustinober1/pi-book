import assert from "node:assert/strict";
import test from "node:test";
import {
  renderProseLintJson,
  renderProseLintMarkdown,
  renderReviewLintEvidence,
} from "../src/application/prose-lint/report.js";
import type { LintFinding, ProseLintResult } from "../src/application/prose-lint/types.js";

function finding(overrides: Partial<LintFinding> & Pick<LintFinding, "ruleId" | "class" | "confidence">): LintFinding {
  return {
    ruleVersion: "1.0.0",
    location: { path: "02-opening.md", line: 7 },
    excerpt: "x".repeat(320),
    message: `Message for ${overrides.ruleId}.`,
    evidence: { count: 2, detail: "stable" },
    reviewAction: "Review this evidence in manuscript context.",
    ...overrides,
  };
}

function resultFixture(): ProseLintResult {
  const findings = [
    finding({ ruleId: "mechanics/doubled-word", class: "mechanical", confidence: "high", location: { path: "01-opening.md", line: 2 } }),
    finding({ ruleId: "mechanics/drafting-marker", class: "mechanical", confidence: "high", location: { path: "02-opening.md", line: 9 } }),
    finding({ ruleId: "repetition/ngram", class: "repetition", confidence: "review", evidence: { count: 3, documentCount: 2, locations: "01-opening.md:4, 02-opening.md:8" } }),
    finding({ ruleId: "consistency/spelling", class: "consistency", confidence: "medium", evidence: { pair: "color/colour" } }),
    finding({ ruleId: "style-pattern/fragment", class: "style-pattern", confidence: "review", evidence: { baselineMetric: "fragment_ratio", delta: 4 } }),
    finding({ ruleId: "style-pattern/em-dash", class: "style-pattern", confidence: "review" }),
  ];
  return {
    findings,
    failures: [{ ruleId: "synthetic/failure", message: "fixture exploded" }],
    counts: { mechanical: 2, consistency: 1, repetition: 1, "style-pattern": 2 },
    wordCount: 1234,
  };
}

test("Markdown is complete, class-grouped, prefix-filterable, excerpt-bounded, and discloses failures", () => {
  const markdown = renderProseLintMarkdown(resultFixture(), { title: "Novel Forge complete prose audit" });

  assert.match(markdown, /^# Novel Forge complete prose audit/m);
  for (const heading of ["Mechanical", "Consistency", "Repetition", "Style pattern"]) {
    assert.match(markdown, new RegExp(`^## ${heading}$`, "m"));
  }
  assert.match(markdown, /01-opening\.md:2/);
  assert.match(markdown, /mechanics\/doubled-word/);
  assert.match(markdown, /Message for mechanics\/doubled-word/);
  assert.match(markdown, /Evidence:/);
  assert.match(markdown, /Review action:/);
  assert.match(markdown, /Rule failures/);
  assert.match(markdown, /synthetic\/failure.*fixture exploded/);
  assert.doesNotMatch(markdown, new RegExp("x".repeat(200)));

  const filtered = renderProseLintMarkdown(resultFixture(), { rulePrefixes: ["consistency/"] });
  assert.match(filtered, /consistency\/spelling/);
  assert.doesNotMatch(filtered, /mechanics\/doubled-word/);
});

test("JSON is timestamp-free, stable, valid, and newline-terminated", () => {
  const result = resultFixture();
  const first = renderProseLintJson(result);
  const second = renderProseLintJson(result);

  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(first), result);
  assert.doesNotMatch(first, /generatedAt|generated_at|timestamp|20\d\d-\d\d-\d\dT/);
});

test("review evidence prioritizes mechanical, cross-document, consistency, then baseline findings within hard caps", () => {
  const result = resultFixture();
  const summary = renderReviewLintEvidence(result, { maxFindings: 5, maxCharacters: 1050 });

  assert.match(summary, /Deterministic prose-lint evidence/);
  assert.ok(summary.length <= 1050, `${summary.length} characters`);
  const doubled = summary.indexOf("mechanics/doubled-word");
  const marker = summary.indexOf("mechanics/drafting-marker");
  const repetition = summary.indexOf("repetition/ngram");
  const consistency = summary.indexOf("consistency/spelling");
  const baseline = summary.indexOf("style-pattern/fragment");
  assert.ok(doubled >= 0 && marker > doubled);
  assert.ok(repetition > marker);
  assert.ok(consistency > repetition);
  assert.ok(baseline > consistency);
  assert.doesNotMatch(summary, /style-pattern\/em-dash/);
  assert.match(summary, /1 finding omitted/);
  assert.match(summary, /synthetic\/failure/);
});

test("review evidence reports exact omissions when required mechanical findings exceed the finding cap", () => {
  const base = resultFixture();
  const result: ProseLintResult = {
    ...base,
    findings: Array.from({ length: 8 }, (_, index) => finding({
      ruleId: `mechanics/required-${index + 1}`,
      class: "mechanical",
      confidence: "high",
      location: { path: `chapter-${index + 1}.md`, line: index + 1 },
    })),
    counts: { mechanical: 8, consistency: 0, repetition: 0, "style-pattern": 0 },
  };
  const summary = renderReviewLintEvidence(result, { maxFindings: 3, maxCharacters: 650 });

  assert.ok(summary.length <= 650);
  assert.match(summary, /chapter-1\.md:1/);
  assert.match(summary, /5 findings omitted/);
  assert.doesNotMatch(summary, new RegExp("x".repeat(160)));
});

test("bounded review evidence retains truthful full near-duplicate match counts", () => {
  const near = finding({
    ruleId: "repetition/near-duplicate",
    class: "repetition",
    confidence: "review",
    evidence: { similarity: 0.8537, fullFindingCount: 24_090, omittedFindingCount: 24_050, pairMultiplicity: 1 },
  });
  const result: ProseLintResult = {
    findings: [near],
    failures: [],
    counts: { mechanical: 0, consistency: 0, repetition: 1, "style-pattern": 0 },
    wordCount: 4_000,
  };

  const summary = renderReviewLintEvidence(result, { maxFindings: 1, maxCharacters: 500 });
  assert.match(summary, /Full match count: 24090; rule-cap omissions: 24050\./);
  assert.ok(summary.length <= 500);
});

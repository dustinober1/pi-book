import assert from "node:assert/strict";
import test from "node:test";
import {
  ABSOLUTE_BAND_MINIMUM_WORDS,
  REFERENCE_BANDS,
  bandBreach,
  bandMessage,
  normalizeDocument,
  runProseLint,
  stylePatternRules,
} from "../src/application/prose-lint/index.js";

function lint(documents: Array<{ path: string; text: string }>, baselineMetrics?: Record<string, number>) {
  return runProseLint({
    documents: documents.map((document, index) => normalizeDocument(document.path, document.text, index + 1)),
    rules: stylePatternRules,
    ...(baselineMetrics === undefined ? {} : { baselineMetrics }),
  });
}

function findingFor(documents: Array<{ path: string; text: string }>, ruleId: string, baselineMetrics?: Record<string, number>) {
  return lint(documents, baselineMetrics).findings.find((item) => item.ruleId === ruleId);
}

/** Prose with a controlled em-dash count, padded to a chosen word budget. */
function emDashChapter(words: number, emDashes: number): string {
  const sentences: string[] = [];
  for (let index = 0; index < emDashes; index += 1) {
    sentences.push(`The lamp guttered once—the corridor answered with nothing at all.`);
  }
  let count = sentences.join(" ").split(/\s+/).length;
  let filler = 0;
  while (count < words) {
    sentences.push(`Rain crossed the yard and settled into the broken stone gutter number ${filler}.`);
    count += 13;
    filler += 1;
  }
  return sentences.join(" ");
}

test("an absolute band flags a single chapter with no baseline and no sibling documents", () => {
  // The concentration fallback cannot fire here: one document has nothing to be
  // concentrated against, and no accepted baseline exists. Only the band can.
  const finding = findingFor([{ path: "06-chapter.md", text: emDashChapter(1_400, 30) }], "style-pattern/em-dash");

  assert.ok(finding, "expected an em-dash band finding");
  assert.equal(finding.confidence, "review");
  assert.equal(finding.evidence.referenceKind, "above-ceiling");
  assert.equal(finding.evidence.referenceLimit, REFERENCE_BANDS.em_dash_rate_per_1000?.ceiling);
  assert.equal(finding.evidence.baselineMetric, "em_dash_rate_per_1000");
  assert.ok(Number(finding.evidence.currentRate) > Number(finding.evidence.referenceLimit));
  assert.ok(Number(finding.evidence.scopeWords) >= ABSOLUTE_BAND_MINIMUM_WORDS);
  assert.match(finding.message, /em dashes per 1,000 words/);
  assert.match(finding.message, /reference ceiling/);
});

test("prose inside the band produces no band finding", () => {
  const finding = findingFor([{ path: "06-chapter.md", text: emDashChapter(1_400, 2) }], "style-pattern/em-dash");
  assert.equal(finding, undefined);
});

test("a scope below the minimum word count is never measured against a band", () => {
  const short = emDashChapter(400, 40);
  assert.ok(short.split(/\s+/).length < ABSOLUTE_BAND_MINIMUM_WORDS);
  assert.equal(findingFor([{ path: "06-chapter.md", text: short }], "style-pattern/em-dash"), undefined);
});

test("a floor band catches uniform sentence cadence that no ceiling would see", () => {
  // 150 identical-length sentences: nothing is "concentrated" anywhere, and the
  // variance is the whole problem.
  const uniform = Array.from({ length: 150 }, (_, index) => `The keeper walked the long wall again number ${index}.`).join(" ");
  const finding = findingFor([{ path: "07-chapter.md", text: uniform }], "style-pattern/sentence-variance-drift");

  assert.ok(finding, "expected a sentence-variance band finding");
  assert.equal(finding.evidence.referenceKind, "below-floor");
  assert.ok(Number(finding.evidence.currentRate) < Number(finding.evidence.referenceLimit));
  assert.match(finding.message, /reference floor/);
  assert.match(finding.message, /unusually uniform/);
});

test("band findings are review evidence and never claim authorship detection", () => {
  const findings = lint([{ path: "06-chapter.md", text: emDashChapter(1_400, 30) }]).findings;
  assert.ok(findings.length > 0);
  for (const finding of findings) {
    assert.equal(finding.confidence, "review");
    assert.doesNotMatch(finding.message, /AI[- ]written|AI probability|machine[- ]generated/i);
    assert.match(finding.reviewAction, /deliberate voice choice|manuscript context/i);
  }
});

test("band evaluation is deterministic and takes precedence over relative drift", () => {
  const documents = [{ path: "06-chapter.md", text: emDashChapter(1_400, 30) }];
  assert.deepEqual(lint(documents), lint(documents));

  // A generous accepted baseline does not suppress an absolute breach, and the
  // finding reports the band rather than the baseline delta.
  const withBaseline = findingFor(documents, "style-pattern/em-dash", { em_dash_rate_per_1000: 40 });
  assert.ok(withBaseline);
  assert.equal(withBaseline.evidence.referenceKind, "above-ceiling");
  assert.equal(withBaseline.evidence.delta, undefined);
});

test("bandBreach and bandMessage agree on direction and units", () => {
  const ceiling = bandBreach("em_dash_rate_per_1000", 12);
  assert.ok(ceiling);
  assert.equal(ceiling.kind, "above-ceiling");
  assert.match(bandMessage(ceiling), /12 em dashes per 1,000 words, above the published-fiction reference ceiling of 6/);

  const floor = bandBreach("sentence_length_variance", 10);
  assert.ok(floor);
  assert.equal(floor.kind, "below-floor");
  assert.match(bandMessage(floor), /below the published-fiction reference floor of 35/);

  assert.equal(bandBreach("em_dash_rate_per_1000", 3), null);
  assert.equal(bandBreach("no_such_metric", 1_000), null);
  assert.equal(bandBreach("em_dash_rate_per_1000", Number.NaN), null);
});

test("every band declares a direction, a unit, and a writer-facing concern", () => {
  const entries = Object.entries(REFERENCE_BANDS);
  assert.ok(entries.length >= 14);
  for (const [key, band] of entries) {
    assert.equal(band.metric, key, `${key} metric key mismatch`);
    assert.ok(band.ceiling !== undefined || band.floor !== undefined, `${key} declares no limit`);
    assert.ok(band.unit.trim().length > 0, `${key} has no unit`);
    assert.ok(band.concern.trim().length > 20, `${key} has no usable concern text`);
  }
});

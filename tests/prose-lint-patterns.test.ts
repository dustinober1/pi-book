import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultProseLintRules,
  normalizeDocument,
  repetitionRules,
  runProseLint,
  stylePatternRules,
} from "../src/application/prose-lint/index.js";

function lint(documents: Array<{ path: string; text: string }>, rules = repetitionRules, baselineMetrics?: Record<string, number>) {
  return runProseLint({
    documents: documents.map((document, index) => normalizeDocument(document.path, document.text, index + 1)),
    rules,
    ...(baselineMetrics === undefined ? {} : { baselineMetrics }),
  });
}

test("phrase repetition applies cross-document and local thresholds while filtering common function phrases", () => {
  const result = lint([
    {
      path: "01.md",
      text: [
        "A copper moon rising beyond the ridge warned Mara.",
        "The copper moon rising above the mill looked colder.",
        "They waited in the middle of the abandoned station.",
        "When the bell sounded, Mara locked the western door.",
        "When the bell cracked, Jonah crossed the empty yard.",
      ].join("\n\n"),
    },
    {
      path: "02.md",
      text: [
        "That copper moon rising through smoke marked the hour.",
        "They stood in the middle of the flooded platform.",
        "When the bell stopped, every window opened at once.",
        "The glass river waits below the old canal.",
        "Tonight the glass river waits under a broken bridge.",
        "At dawn the glass river waits behind the market.",
        "By noon the glass river waits beside the archive.",
        "We remained in the middle of the silent concourse.",
        "I woke in the middle of the northern passage.",
      ].join("\n\n"),
    },
  ]);

  assert.ok(result.findings.some((item) =>
    item.ruleId === "repetition/ngram"
    && item.evidence.phrase === "copper moon rising"
    && item.evidence.count === 3
    && item.evidence.chapterCount === 2
    && item.evidence.densestChapterCount === 2
    && item.evidence.documentCount === 2
    && item.evidence.densestDocumentCount === 2
  ));
  assert.ok(result.findings.some((item) =>
    item.ruleId === "repetition/ngram"
    && item.evidence.phrase === "glass river waits"
    && item.evidence.count === 4
    && item.evidence.chapterCount === 1
  ));
  assert.equal(result.findings.some((item) => item.evidence.phrase === "in the middle of"), false);
  assert.equal(result.findings.some((item) => item.evidence.phrase === "middle of the"), false);
  assert.ok(result.findings.some((item) => item.ruleId === "repetition/sentence-opening" && item.evidence.opening === "when the bell"));
  assert.ok(result.findings.some((item) => item.ruleId === "repetition/paragraph-opening" && item.evidence.opening === "when the bell"));
  assert.ok(result.findings.every((item) => !/AI[- ]written|AI probability/i.test(item.message)));
});

test("body-language repetition reports per-term cross-document and dense-local evidence with bounded locations", () => {
  const result = lint([
    { path: "01.md", text: "Her hand closed. His hand opened. Their hand signals stopped. Her eyes narrowed. His eyes closed. Their eyes met." },
    { path: "02.md", text: "A hand lifted. The hand fell. One hand trembled. Another hand steadied. Her eyes widened." },
  ]);
  const hand = result.findings.find((finding) => finding.ruleId === "repetition/body-language" && finding.evidence.term === "hand");
  const eyes = result.findings.find((finding) => finding.ruleId === "repetition/body-language" && finding.evidence.term === "eyes");

  assert.ok(hand);
  assert.equal(hand.ruleVersion, "1.0.0");
  assert.equal(hand.class, "repetition");
  assert.equal(hand.confidence, "review");
  assert.equal(hand.evidence.count, 7);
  assert.equal(hand.evidence.documentCount, 2);
  assert.equal(hand.evidence.densestDocumentCount, 4);
  assert.equal(hand.evidence.omittedLocationCount, 2);
  assert.equal(String(hand.evidence.locations).split(", ").length, 5);
  assert.ok(eyes);
  assert.equal(eyes.evidence.count, 4);
  assert.equal(eyes.evidence.documentCount, 2);
  assert.deepEqual(lint([
    { path: "01.md", text: "Her hand closed. His hand opened. Their hand signals stopped. Her eyes narrowed. His eyes closed. Their eyes met." },
    { path: "02.md", text: "A hand lifted. The hand fell. One hand trembled. Another hand steadied. Her eyes widened." },
  ]), result);
});

test("sequence repetition rules cap a highly repetitive four-thousand-word corpus with truthful totals", () => {
  const paragraphs = Array.from({ length: 60 }, (_, pattern) => Array.from({ length: 4 }, (_, use) => [
    `signal${pattern}`,
    `marker${pattern}`,
    `rises${pattern}`,
    "through the copper station while watchers count lanterns",
    `before dawn cycle${use}`,
    "returns again tonight",
  ].join(" ") + ".")).flat();
  const documents = [{ path: "long.md", text: paragraphs.join("\n\n") }];
  const rules = repetitionRules.filter((rule) => [
    "repetition/ngram",
    "repetition/sentence-opening",
    "repetition/paragraph-opening",
  ].includes(rule.id));
  const first = lint(documents, rules);
  const second = lint(documents, rules);

  assert.ok(first.wordCount >= 3_800 && first.wordCount <= 4_200, `${first.wordCount} words`);
  assert.deepEqual(second, first);
  for (const ruleId of rules.map((rule) => rule.id)) {
    const findings = first.findings.filter((finding) => finding.ruleId === ruleId);
    assert.equal(findings.length, 40, ruleId);
    const fullFindingCount = Number(findings[0]?.evidence.fullFindingCount);
    assert.ok(fullFindingCount > 40, `${ruleId} full count ${fullFindingCount}`);
    assert.ok(findings.every((finding) => finding.evidence.fullFindingCount === fullFindingCount));
    assert.ok(findings.every((finding) => finding.evidence.omittedFindingCount === fullFindingCount - 40));
    assert.ok(findings.every((finding) => ruleId === "repetition/ngram"
      ? typeof finding.evidence.phrase === "string"
      : typeof finding.evidence.opening === "string"));
  }
});

test("duplicate rules report exact pairs and only near-duplicate passages at or above 0.85 similarity", () => {
  const exact = "The brass key waited under a cracked blue tile beside the silent stove.";
  const baseTokens = Array.from({ length: 40 }, (_, index) => `token${index + 1}`);
  const nearTokens = [...baseTokens];
  nearTokens[20] = "changed";
  const belowTokens = [...baseTokens];
  belowTokens[10] = "firstchange";
  belowTokens[28] = "secondchange";
  const result = lint([
    { path: "01.md", text: `${exact}\n\n${baseTokens.join(" ")}.` },
    { path: "02.md", text: `${exact}\n\n${nearTokens.join(" ")}.\n\n${belowTokens.join(" ")}.` },
  ]);

  const exactFinding = result.findings.find((item) => item.ruleId === "repetition/exact-duplicate");
  assert.ok(exactFinding);
  assert.equal(exactFinding.evidence.firstLocation, "01.md:1");
  assert.equal(exactFinding.evidence.secondLocation, "02.md:1");

  const nearFindings = result.findings.filter((item) => item.ruleId === "repetition/near-duplicate");
  assert.equal(nearFindings.length, 1);
  assert.equal(nearFindings[0]?.evidence.firstLocation, "01.md:3");
  assert.equal(nearFindings[0]?.evidence.secondLocation, "02.md:3");
  assert.ok(Number(nearFindings[0]?.evidence.similarity) >= 0.85);
});

test("near-duplicate detection does not compare a paragraph with its own contained sentence", () => {
  const longSentence = Array.from({ length: 40 }, (_, index) => `word${index + 1}`).join(" ");
  const result = lint([{
    path: "self.md",
    text: `${longSentence}. Go now.`,
  }]);

  assert.deepEqual(result.findings.filter((item) => item.ruleId === "repetition/near-duplicate"), []);
});

test("near-duplicate totals multiply token-identical group occurrences without duplicate comparisons", () => {
  const base = Array.from({ length: 40 }, (_, index) => `token${index + 1}`);
  const changed = [...base];
  changed[20] = "changed";
  const rules = repetitionRules.filter((rule) => rule.id === "repetition/near-duplicate");
  const result = lint([{
    path: "multiplicity.md",
    text: [
      ...Array.from({ length: 3 }, () => `${base.join(" ")}.`),
      ...Array.from({ length: 4 }, () => `${changed.join(" ")}.`),
    ].join("\n\n"),
  }], rules);

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.evidence.pairMultiplicity, 12);
  assert.equal(result.findings[0]?.evidence.fullFindingCount, 12);
  assert.equal(result.findings[0]?.evidence.omittedFindingCount, 0);
});

test("exact duplicate sentences on the same Markdown line retain distinct stable spans", () => {
  const sentence = "The brass key waited under a cracked blue tile beside the silent stove.";
  const result = lint([{ path: "same-line.md", text: `${sentence} ${sentence}` }]);
  const finding = result.findings.find((item) => item.ruleId === "repetition/exact-duplicate");

  assert.ok(finding);
  assert.equal(finding.evidence.firstLocation, "same-line.md:1");
  assert.equal(finding.evidence.secondLocation, "same-line.md:1");
  assert.notEqual(finding.evidence.firstSpan, finding.evidence.secondSpan);
});

test("duplicate rules bound pair work and output while retaining deterministic full and omitted counts", () => {
  const exact = "The brass key waited beneath the cracked blue tile beside the silent iron stove.";
  const base = Array.from({ length: 40 }, (_, index) => `signal${index + 1}`);
  const documents = Array.from({ length: 220 }, (_, index) => {
    const near = [...base];
    near[20] = `variant${index + 1}`;
    return { path: `${String(index + 1).padStart(3, "0")}-chapter.md`, text: `${exact}\n\n${near.join(" ")}.` };
  });

  const started = performance.now();
  const rules = repetitionRules.filter((rule) => rule.id === "repetition/exact-duplicate" || rule.id === "repetition/near-duplicate");
  const first = lint(documents, rules);
  const elapsed = performance.now() - started;
  const second = lint(documents, rules);
  assert.deepEqual(second, first);
  assert.ok(elapsed < 8_000, `duplicate scan took ${elapsed.toFixed(0)}ms`);

  const exactFindings = first.findings.filter((finding) => finding.ruleId === "repetition/exact-duplicate");
  assert.equal(exactFindings.length, 1);
  assert.equal(exactFindings[0]?.evidence.occurrenceCount, 220);
  assert.equal(exactFindings[0]?.evidence.pairCount, 24_090);
  assert.ok(Number(exactFindings[0]?.evidence.omittedLocationCount) > 0);
  assert.equal(exactFindings[0]?.evidence.fullFindingCount, 1);
  assert.equal(exactFindings[0]?.evidence.omittedFindingCount, 0);

  const nearFindings = first.findings.filter((finding) => finding.ruleId === "repetition/near-duplicate");
  assert.equal(nearFindings.length, 40);
  assert.ok(nearFindings.every((finding) => finding.evidence.fullFindingCount === 24_090));
  assert.ok(nearFindings.every((finding) => finding.evidence.omittedFindingCount === 24_050));
  assert.ok(nearFindings.every((finding) => finding.evidence.pairMultiplicity === 1));
  assert.ok(nearFindings.every((finding) => finding.evidence.evidenceOnly === undefined));
  assert.ok(nearFindings.every((finding) => finding.evidence.comparisonLimit === undefined));
  assert.ok(nearFindings.every((finding) => finding.evidence.omittedComparisonCount === undefined));
});

function styleFixture() {
  const concentrated = [
    "However, not from fear, not from doubt. She wanted truth, but she needed proof, and she demanded time. Still. Why had the bell stopped? She saw her hand—her hand stayed steady. The hour always collects its debts.",
    "However, never for glory, never for praise. He carried ash, salt, and iron. Too late. Who had opened the gate? He felt his hand—his hand touched stone. Every promise chooses its witness.",
    "However, no plea, no bargain. They counted one, two, and three. Not now. What waited below the stairs? She heard her hand—her hand struck wood. A locked door remembers every key.",
    "However, not with anger, not with mercy. Mara named rain, smoke, and bone. No escape. Why did the lights return? She noticed her hand—her hand found glass. The last silence belongs to no one.",
    "It was not surrender but patience—not weakness but design.",
    "It was not chance but intent—not panic but control.",
    "It was not mercy but memory—not comfort but delay.",
    "It was not victory but survival—not closure but a door.",
  ].join("\n\n");
  const endings = [
    { path: "01-style.md", text: `${concentrated}\n\nShe would leave before dawn.` },
    { path: "02-style.md", text: "A watchman checked the empty road.\n\nHe would return before dawn." },
    { path: "03-style.md", text: "Rain moved over the shuttered town.\n\nThey would vanish before dawn." },
    { path: "04-style.md", text: "The engine cooled beneath the hill.\n\nWe would answer before dawn." },
  ];
  const filler = Array.from({ length: 2300 }, (_, index) => `filler${index}`).join(" ") + ".";
  return [...endings, { path: "05-background.md", text: filler }];
}

test("style rules report concentrated patterns only with a sufficient corpus and local concentration", () => {
  const fixture = styleFixture();
  const result = lint(fixture, stylePatternRules);
  const ids = new Set(result.findings.map((item) => item.ruleId));

  for (const id of [
    "style-pattern/negative-parallelism",
    "style-pattern/not-x-but-y",
    "style-pattern/three-part-cadence",
    "style-pattern/aphoristic-close",
    "style-pattern/rhetorical-question",
    "style-pattern/fragment",
    "style-pattern/em-dash",
    "style-pattern/filter-word",
    "style-pattern/body-language-repetition",
    "style-pattern/repeated-transition",
    "style-pattern/paragraph-shape",
    "style-pattern/repeated-ending-syntax",
  ]) assert.ok(ids.has(id), `missing ${id}`);

  assert.ok(result.findings.every((item) => item.confidence === "review"));
  assert.ok(result.findings.every((item) => Number(item.evidence.count) >= 4));
  assert.ok(result.findings.every((item) => Number(item.evidence.localRate) >= Number(item.evidence.corpusRate) * 2));
  assert.ok(result.findings.every((item) => !/AI[- ]written|AI probability/i.test(item.message)));
  assert.deepEqual(lint(fixture, stylePatternRules), result);

  const tooSmall = lint(styleFixture().slice(0, 4), stylePatternRules);
  assert.equal(tooSmall.findings.length, 0);
});

test("baseline-aware style rules use fixed delta and ratio thresholds, including a zero baseline", () => {
  const source = Array.from({ length: 100 }, (_, index) => index % 20 === 0
    ? "It was not fear but focus."
    : `ordinary${index} detail remained.`).join(" ");

  const elevated = lint([{ path: "short.md", text: source }], stylePatternRules, {
    not_x_but_y_rate_per_1000: 4,
  });
  const finding = elevated.findings.find((item) => item.ruleId === "style-pattern/not-x-but-y");
  assert.ok(finding);
  assert.ok(Number(finding.evidence.delta) >= 2);
  assert.ok(Number(finding.evidence.currentRate) >= Number(finding.evidence.baselineRate) * 1.5);

  const zeroBaseline = lint([{ path: "short.md", text: source }], stylePatternRules, {
    not_x_but_y_rate_per_1000: 0,
  });
  assert.ok(zeroBaseline.findings.some((item) => item.ruleId === "style-pattern/not-x-but-y"));

  const belowDelta = lint([{ path: "short.md", text: source }], stylePatternRules, {
    not_x_but_y_rate_per_1000: 15,
  });
  assert.equal(belowDelta.findings.some((item) => item.ruleId === "style-pattern/not-x-but-y"), false);
});

test("baseline style metrics ignore Markdown headings and never cite excluded heading text", () => {
  const result = lint([{ path: "heading-only.md", text: "# Alone" }], stylePatternRules, {
    fragment_ratio: 0,
  });

  assert.equal(result.findings.some((item) => item.ruleId === "style-pattern/fragment"), false);
  assert.equal(result.findings.some((item) => item.excerpt.includes("Alone")), false);
});

test("baseline fragment metrics preserve normalized hard-wrapped sentence boundaries", () => {
  const result = lint([{ path: "wrapped.md", text: "These are four words\nToo late." }], stylePatternRules, {
    fragment_ratio: 0,
  });
  const finding = result.findings.find((item) => item.ruleId === "style-pattern/fragment");

  assert.ok(finding);
  assert.equal(finding.location.line, 2);
  assert.equal(finding.excerpt, "Too late.");
});

test("baseline fragment metrics preserve unterminated normalized sentences before later prose", () => {
  const result = lint([{ path: "unterminated.md", text: "Too soon\nThese are four words." }], stylePatternRules, {
    fragment_ratio: 0,
  });
  const finding = result.findings.find((item) => item.ruleId === "style-pattern/fragment");

  assert.ok(finding);
  assert.equal(finding.location.line, 1);
  assert.equal(finding.excerpt, "Too soon");
});

test("the default registry preserves mechanical, repetition, then style rule order", () => {
  assert.ok(defaultProseLintRules.length > repetitionRules.length + stylePatternRules.length);
  assert.equal(defaultProseLintRules.findIndex((rule) => rule.id === repetitionRules[0]?.id) > 0, true);
  assert.equal(defaultProseLintRules.at(-1)?.id, stylePatternRules.at(-1)?.id);
});

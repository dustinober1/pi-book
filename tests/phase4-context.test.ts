import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function setup(parent: string): string {
  const root = initializeProject(parent, { projectName: "Phase 4 Context", projectType: "standalone", profile: "thriller" });
  const bookRoot = join(root, "books", "book-01");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access", source: "chapter-01", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  const strategy = completeStrategy();
  strategy.reader_friction.observations.push({
    id: "OBS-001", title: "Comparable", source_location: "manual", observed_on: "2026-07-15", rating: 2,
    paraphrase: "RAW PUBLIC REVIEW BODY", short_excerpt: "RAW PUBLIC REVIEW BODY", genre_relevance: "high", execution_relevance: "high",
    category: "pacing-problem", sentiment: "negative",
  });
  writeFileSync(join(bookRoot, "book-strategy.yaml"), stringifyYaml(strategy), "utf8");
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml(queueFixture()), "utf8");
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml(researchFixture()), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml(sourcesFixture()), "utf8");
  return root;
}

test("drafting context includes approved book guardrails and required ready claims", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase4-context-"));
  try {
    const root = setup(parent);
    const context = buildChapterContext(root, 2);
    assert.match(context.text, /Approved book guardrails/);
    assert.match(context.text, /BOOK GUARDRAIL: preserve costly choices/);
    assert.match(context.text, /Required ready research claims/);
    assert.match(context.text, /RES-001/);
    assert.match(context.text, /SRC-001/);
    assert.ok(context.report.included.includes("research RES-001"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("drafting context excludes public observations and unrequired claims", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase4-context-"));
  try {
    const root = setup(parent);
    const context = buildChapterContext(root, 2);
    assert.doesNotMatch(context.text, /RAW PUBLIC REVIEW BODY/);
    assert.doesNotMatch(context.text, /UNREQUIRED CLAIM MARKER/);
    assert.ok(context.report.excluded.includes("raw public reviews"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackageArtifacts } from "../src/application/packaging/export.js";
import { applyPackageArtifacts } from "../src/application/packaging/apply.js";
import { buildPackagingChecklist } from "../src/application/package-checklist.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../src/domain/historical-fiction.js";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../src/domain/v1-2-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-historical-package-"));
}

function preparePackageInputs(root: string): void {
  const bookRoot = join(root, "books/book-01");
  writeFileSync(join(bookRoot, "manuscript/chapters/01-opening.md"), "# Chapter 1\n\nThe barricade closes the road.\n", "utf8");
  const publishingPath = join(bookRoot, "publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.title = "A Republic of Smoke";
  publishing.author.pen_name = "Nessa Keane";
  publishing.language = "en-US";
  publishing.copyright = { holder: "Nessa Keane", year: "2026", notice: "Copyright © 2026 Nessa Keane" };
  publishing.descriptions.short = "A courier crosses Paris as a monarchy falls.";
  publishing.descriptions.long = "A historical novel about loyalty, movement, and consequence in Paris in 1848.";
  publishing.keywords = ["historical fiction"];
  publishing.categories = ["FICTION / Historical"];
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");
  const marketingPath = join(bookRoot, "marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  for (const group of [marketing.launch, marketing.social, marketing.advertisements, marketing.audiobook_promotion, marketing.series_page]) {
    group.items = ["A city changes before the courier reaches the next street."];
  }
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

function addDisclosedInvention(root: string, classification: "invented" | "counterfactual" = "invented"): void {
  const path = join(root, "books/book-01/invention-ledger.yaml");
  const ledger = parseYaml<InventionLedger>(readFileSync(path, "utf8"), InventionLedgerSchema, "invention-ledger.yaml");
  ledger.entries.push({
    id: "INV-001", claim: "The fictional courier crosses a private courtyard.", classification,
    risk: classification === "counterfactual" ? "high" : "low", source_ids: [], research_ids: [],
    rationale: "No surviving record describes the fictional household.",
    story_necessity: "The courtyard provides a route around a documented barricade.",
    affected_chapters: [], portrayal_risks: [], continuity_risks: [], disclosure: "historical-note",
    writer_decision_id: null, major_counterfactual: false,
  });
  writeFileSync(path, stringifyYaml(ledger), "utf8");
}

test("historical packages include a note for disclosed inventions", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "History Package", projectType: "standalone", profile: "historical-fiction" });
    preparePackageInputs(root);
    addDisclosedInvention(root);
    const built = await buildPackageArtifacts(root, { preferPandoc: false });
    const note = built.changes.find((change) => change.path.endsWith("historical-note.md"));
    assert.ok(note && typeof note.content === "string");
    assert.match(note.content, /Historical Note/);
    assert.match(note.content, /INV-001/);
    assert.match(note.content, /fictional courier crosses a private courtyard/i);
    assert.match(note.content, /declared narrative invention; no citation asserted/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical artifacts affect package hashes while other profiles receive no note", async () => {
  const parent = temp();
  try {
    const historical = initializeProject(parent, { projectName: "Historical Hash", projectType: "standalone", profile: "historical-fiction" });
    preparePackageInputs(historical);
    const first = await buildPackageArtifacts(historical, { preferPandoc: false });
    const contextPath = join(historical, "books/book-01/historical-context.yaml");
    const context = parseYaml<HistoricalContext>(readFileSync(contextPath, "utf8"), HistoricalContextSchema, "historical-context.yaml");
    context.temporal_scope = "Paris, February to June 1848";
    writeFileSync(contextPath, stringifyYaml(context), "utf8");
    const second = await buildPackageArtifacts(historical, { preferPandoc: false });
    assert.notEqual(second.sourceHash, first.sourceHash);

    const thriller = initializeProject(parent, { projectName: "Modern Hash", projectType: "standalone", profile: "thriller" });
    preparePackageInputs(thriller);
    const modern = await buildPackageArtifacts(thriller, { preferPandoc: false });
    assert.equal(modern.changes.some((change) => change.path.endsWith("historical-note.md")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing historical invention approval blocks the packaging checklist and apply flow", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Blocked History", projectType: "standalone", profile: "historical-fiction" });
    preparePackageInputs(root);
    addDisclosedInvention(root, "counterfactual");
    const checklist = buildPackagingChecklist(root);
    const disclosure = checklist.items.find((item) => item.id === "historical-disclosure");
    assert.ok(disclosure);
    assert.equal(disclosure.complete, false);
    assert.equal(disclosure.blocking, true);
    assert.match(disclosure.detail, /writer decision/i);
    await assert.rejects(() => applyPackageArtifacts(root, { preferPandoc: false }), /Historical disclosure.*writer decision/is);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

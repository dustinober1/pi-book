import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackagingChecklist } from "../src/application/package-checklist.js";
import { GenreConfigSchema, type GenreConfig } from "../src/domain/schemas.js";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../src/domain/v1-2-schemas.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5 } from "../src/domain/v1-3-audit-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-ending-contract-"));
}

function preparePackageInputs(root: string): void {
  const bookRoot = join(root, "books/book-01");
  writeFileSync(join(bookRoot, "manuscript/chapters/01-opening.md"), "# Chapter 1\n\nThey meet at the harbor.\n", "utf8");
  const publishingPath = join(bookRoot, "publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.title = "Harbor Point";
  publishing.author.pen_name = "Rae Callahan";
  publishing.language = "en-US";
  publishing.copyright = { holder: "Rae Callahan", year: "2026", notice: "Copyright © 2026 Rae Callahan" };
  publishing.descriptions.short = "A curse-bound smith falls for the tide-witch sent to break it.";
  publishing.descriptions.long = "A romantasy about trust, magic cost, and a rupture neither of them saw coming.";
  publishing.keywords = ["romantasy"];
  publishing.categories = ["FICTION / Fantasy / Romance"];
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");
  const marketingPath = join(bookRoot, "marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  for (const group of [marketing.launch, marketing.social, marketing.advertisements, marketing.audiobook_promotion, marketing.series_page]) {
    group.items = ["The tide-witch was sent to break the curse, not fall into it."];
  }
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

function setDeliveredEnding(root: string, delivered: BookStrategyPhase5["delivered_ending"]): void {
  const path = join(root, "books/book-01/book-strategy.yaml");
  const strategy = parseYaml<BookStrategyPhase5>(readFileSync(path, "utf8"), BookStrategyPhase5Schema, "book-strategy.yaml");
  strategy.delivered_ending = delivered;
  writeFileSync(path, stringifyYaml(strategy), "utf8");
}

function readGenre(root: string): GenreConfig {
  return parseYaml<GenreConfig>(readFileSync(join(root, "books/book-01/genre.yaml"), "utf8"), GenreConfigSchema, "genre.yaml");
}

test("missing delivered-ending declaration blocks the packaging checklist", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Harbor Point", projectType: "standalone", profile: "romantasy" });
    preparePackageInputs(root);
    const checklist = buildPackagingChecklist(root);
    const ending = checklist.items.find((entry) => entry.id === "ending-contract");
    assert.ok(ending);
    assert.equal(ending.complete, false);
    assert.equal(ending.blocking, true);
    assert.match(ending.detail, /no delivered ending has been recorded/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a delivered ending that matches the declared contract clears the checklist item", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Harbor Point", projectType: "standalone", profile: "romantasy" });
    preparePackageInputs(root);
    const declared = readGenre(root).settings.ending_contract as "hea" | "hfn" | "series-progress" | "tragic-by-design";
    setDeliveredEnding(root, { disposition: declared, note: "They choose each other and the debt is paid." });
    const checklist = buildPackagingChecklist(root);
    const ending = checklist.items.find((entry) => entry.id === "ending-contract");
    assert.ok(ending);
    assert.equal(ending.complete, true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a delivered ending that contradicts the declared contract blocks packaging with both values named", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Harbor Point", projectType: "standalone", profile: "romantasy" });
    preparePackageInputs(root);
    const declared = readGenre(root).settings.ending_contract as string;
    const delivered: "hea" | "tragic-by-design" = declared === "tragic-by-design" ? "hea" : "tragic-by-design";
    setDeliveredEnding(root, { disposition: delivered, note: "The rupture stayed unhealed." });
    const checklist = buildPackagingChecklist(root);
    const ending = checklist.items.find((entry) => entry.id === "ending-contract");
    assert.ok(ending);
    assert.equal(ending.complete, false);
    assert.equal(ending.blocking, true);
    assert.match(ending.detail, new RegExp(`declared ending contract is "${declared}"`));
    assert.match(ending.detail, new RegExp(`delivered ending is "${delivered}"`));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("non-romantasy profiles never gain the ending-contract checklist item", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Clean Signal", projectType: "standalone", profile: "thriller" });
    preparePackageInputs(root);
    const checklist = buildPackagingChecklist(root);
    assert.equal(checklist.items.some((entry) => entry.id === "ending-contract"), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

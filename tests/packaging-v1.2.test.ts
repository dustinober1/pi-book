import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPackageArtifacts } from "../src/application/packaging/apply.js";
import { buildPackageArtifacts } from "../src/application/packaging/export.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../src/domain/v1-2-schemas.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-package-v12-")); }

function prepare(root: string): void {
  const bookRoot = join(root, "books", "book-01");
  writeFileSync(join(bookRoot, "manuscript", "chapters", "01-opening.md"), "# Chapter 1\n\nA clean opening chapter.\n", "utf8");
  const publishingPath = join(bookRoot, "publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.verification_status = "verified";
  publishing.title = "The Clean Signal";
  publishing.series.name = "Signal Files";
  publishing.author.name = "A. Writer";
  publishing.language = "en-US";
  publishing.territories = ["US"];
  publishing.copyright = { holder: "A. Writer", year: "2026", notice: "Copyright 2026 A. Writer" };
  publishing.publication = { date: "2026-10-01", edition: "first" };
  publishing.descriptions = { short: "A short description.", long: "A longer retailer description for the book." };
  publishing.keywords = ["thriller"];
  publishing.categories = ["FICTION / Thrillers"];
  publishing.trim = { width: 6, height: 9, unit: "in" };
  publishing.accessibility = { alt_text_complete: true, notes: "No images." };
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");
  const marketingPath = join(bookRoot, "marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  for (const group of Object.values(marketing)) {
    if (group && typeof group === "object" && "approval" in group) (group as { approval: { status: "approved"; approved_at: string; note: string } }).approval = { status: "approved", approved_at: "2026-07-15", note: "approved" };
  }
  marketing.positioning.items = ["A procedural thriller about evidence under pressure."];
  marketing.audiences.items = ["Readers of procedural thrillers."];
  marketing.hooks.items = ["The evidence is clean because someone cleaned it."];
  marketing.retailer_copy.items = ["A retailer-ready description."];
  marketing.launch.items = ["Launch announcement."];
  marketing.social.items = ["Social post."];
  marketing.advertisements.items = ["Ad variant."];
  marketing.audiobook_promotion.items = ["Audiobook promotion."];
  marketing.series_page.items = ["Series page copy."];
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

test("package artifact builder creates the complete author package without writing", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package", projectType: "standalone", profile: "thriller" });
    prepare(root);
    const built = await buildPackageArtifacts(root, { preferPandoc: false });
    const paths = built.changes.map((change) => change.path);
    for (const suffix of ["manuscript.md", "manuscript.docx", "manuscript.epub", "publishing-metadata.csv", "publishing-metadata.xlsx", "retailer-copy.md", "launch-copy.md", "social-posts.md", "ad-variants.md", "audiobook-metadata.md", "series-page-copy.md", "package-manifest.yaml", "package-report.md"]) {
      assert.ok(paths.some((path) => path.endsWith(suffix)), suffix);
    }
    assert.equal(existsSync(join(root, "books/book-01/exports/manuscript.docx")), false);
    assert.match(built.sourceHash, /^[a-f0-9]{64}$/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("package application commits all outputs and blocks stale overwrite without regeneration", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package", projectType: "standalone", profile: "thriller" });
    prepare(root);
    const first = await applyPackageArtifacts(root, { preferPandoc: false, regenerate: true, bypassWorkflowChecklist: true });
    assert.equal(existsSync(join(root, "books/book-01/exports/manuscript.docx")), true);
    writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "# Chapter 1\n\nChanged manuscript.\n", "utf8");
    await assert.rejects(() => applyPackageArtifacts(root, { preferPandoc: false, regenerate: false, bypassWorkflowChecklist: true }), /stale.*regenerat/i);
    assert.ok(first.changed.includes("STATUS.md"));
    assert.equal(readProject(root).novel_forge_version, "1.3.0");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

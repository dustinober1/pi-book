import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackagingChecklist } from "../src/application/package-checklist.js";
import { buildPackageArtifacts } from "../src/application/packaging/export.js";
import { applyPackageArtifacts } from "../src/application/packaging/apply.js";
import { NOVEL_FORGE_VERSION } from "../src/application/version-core.js";
import { PublishingMetadataSchema, MarketingMetadataSchema, type PublishingMetadata, type MarketingMetadata } from "../src/domain/v1-2-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-package-v12-")); }
function prepare(root: string): void {
  writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "# Chapter 1\n\nA clean signal becomes a trap.\n", "utf8");
  const publishingPath = join(root, "books/book-01/publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.title = "The Clean Signal";
  publishing.author.pen_name = "Nessa Keane";
  publishing.language = "en-US";
  publishing.copyright = { holder: "Nessa Keane", year: "2026", notice: "Copyright © 2026 Nessa Keane" };
  publishing.descriptions.short = "A manufactured warning turns an analyst into a fugitive.";
  publishing.descriptions.long = "A geopolitical techno-thriller about a manufactured warning and the analyst who refuses to trust it.";
  publishing.keywords = ["geopolitical thriller", "techno-thriller"];
  publishing.categories = ["FICTION / Thrillers / Political"];
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");
  const marketingPath = join(root, "books/book-01/marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  marketing.launch.items = ["The warning was clean. Too clean."];
  marketing.social.items = ["An analyst discovers the signal designed to start a war."];
  marketing.advertisements.items = ["AI follows orders no human signed."];
  marketing.audiobook_promotion.items = ["Listen to the conspiracy unfold."];
  marketing.series_page.items = ["Book one of the Julie O'Donnell series."];
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

test("packaging checklist reports exact publishing and marketing repairs", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package", projectType: "standalone", profile: "thriller" });
    const checklist = buildPackagingChecklist(root);
    assert.ok(checklist.items.some((item) => item.id === "publishing-metadata" && !item.complete && /title|author|language/i.test(item.detail)));
    assert.ok(checklist.items.some((item) => item.id === "marketing-metadata" && !item.complete));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

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
    assert.equal(readProject(root).novel_forge_version, NOVEL_FORGE_VERSION);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

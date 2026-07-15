import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { inspectZipEntries } from "../src/application/adoption/archive-safety.js";
import { applyAdoption } from "../src/application/adoption/apply.js";
import { applyMapping, validateAdoptionMapping } from "../src/application/adoption/mapping.js";
import type { AdoptionPreview } from "../src/application/adoption/types.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-adoption-v12-")); }
function preview(): AdoptionPreview {
  return {
    previewId: "preview-1",
    source: { originalName: "book.docx", extension: ".docx", byteSize: 100, sourceHash: "a".repeat(64) },
    engine: { name: "node-docx", version: "1" },
    sections: [
      { id: "s1", sourceOrder: 0, kind: "front-matter", number: null, title: "Copyright", markdown: "Copyright text", wordCount: 2, sourceRefs: ["document.xml"], included: true },
      { id: "s2", sourceOrder: 1, kind: "chapter", number: 1, title: "Opening", markdown: "# Chapter 1\n\nA clean signal.\n\nA second block.", wordCount: 8, sourceRefs: ["document.xml"], included: true },
    ],
    assets: [{ id: "asset-1", originalName: "map.png", mediaType: "image/png", bytes: Uint8Array.from([137,80,78,71]), hash: "b".repeat(64), width: null, height: null, caption: "Map", altText: "A route map", placementAfterSectionId: "s2" }],
    metadataCandidates: { title: "The Clean Signal", author: "Nessa Keane" },
    warnings: [],
    sourceWordCount: 10,
    proposedWordCount: 10,
  };
}

test("archive inspection rejects traversal and remote XML references", () => {
  const traversal = zipSync({ "../../PROJECT.yaml": strToU8("owned") });
  assert.throws(() => inspectZipEntries(traversal), /unsafe archive path/i);
  const remote = zipSync({ "content.opf": strToU8('<package><item href="https://example.com/payload"/></package>') });
  assert.throws(() => inspectZipEntries(remote), /remote resource/i);
});

test("mapping supports author edits and reports duplicate chapter numbers", () => {
  const mapped = applyMapping(preview(), {
    operations: [
      { type: "rename", sectionId: "s2", title: "The Official Version" },
      { type: "split", sectionId: "s2", blockIndex: 1, title: "Fence Wire" },
      { type: "classify", sectionId: "s1", kind: "front-matter" },
    ],
    metadata: { title: { action: "accept" }, author: { action: "edit", value: "Nessa Keane" } },
  });
  assert.equal(mapped.sections[1]?.title, "The Official Version");
  assert.equal(mapped.sections[2]?.title, "Fence Wire");
  assert.deepEqual(mapped.metadata, { title: "The Clean Signal", author: "Nessa Keane" });
  mapped.sections[2]!.number = 1;
  assert.ok(validateAdoptionMapping(mapped).some((finding) => finding.severity === "blocker" && /duplicate imported chapter number/i.test(finding.message)));
});

test("adoption commits chapters, assets, reports, metadata, status, and handoff together", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Adoption", projectType: "standalone", profile: "thriller" });
    const sourcePreview = preview();
    const mapped = applyMapping(sourcePreview, { operations: [], metadata: { title: { action: "accept" }, author: { action: "accept" } } });
    const result = applyAdoption(root, sourcePreview, mapped);
    assert.equal(result.chapters, 1);
    assert.equal(existsSync(join(root, "books/book-01/manuscript/chapters/01-opening.md")), true);
    assert.equal(existsSync(join(root, "books/book-01/assets/adopted/bbbbbbbbbbbb-map.png")), true);
    assert.equal(existsSync(join(root, "books/book-01/adoption-map.yaml")), true);
    assert.match(readFileSync(join(root, "books/book-01/publishing.yaml"), "utf8"), /The Clean Signal/);
    assert.match(readFileSync(join(root, "STATUS.md"), "utf8"), /Novel Forge/);
    assert.match(readFileSync(join(root, "HANDOFF.md"), "utf8"), /Adopted 1 manuscript sections/);
    writeFileSync(join(root, "books/book-01/manuscript/chapters/02-existing.md"), "# Existing\n", "utf8");
    assert.throws(() => applyAdoption(root, sourcePreview, mapped), /already contains manuscript chapters/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

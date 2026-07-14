import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adoptManuscript } from "../src/application/adoption.js";
import { initializeProject, readBook } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-adoption-")); }

test("adopts a directory of numbered chapter files without changing the source", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Adopt Directory", projectType: "standalone", profile: "thriller" });
    const source = join(parent, "source-manuscript");
    mkdirSync(source);
    writeFileSync(join(source, "01 Arrival.md"), "# Chapter 1\n\nThe signal arrived before dawn.\n", "utf8");
    writeFileSync(join(source, "02 Consequence.txt"), "Chapter 2\n\nBy noon, the official story had hardened.\n", "utf8");
    const result = adoptManuscript(root, source);
    assert.equal(result.chapters, 2);
    assert.ok(result.words > 0);
    assert.equal(existsSync(join(source, "01 Arrival.md")), true);
    const destination = join(root, "books", "book-01", "manuscript", "chapters");
    assert.deepEqual(readdirSync(destination), ["01-imported-arrival.md", "02-imported-consequence.md"]);
    assert.equal(readBook(root).current_chapter, 2);
    assert.equal(readBook(root).actual_words, result.words);
    assert.match(readFileSync(join(root, "books", "book-01", "adoption-report.md"), "utf8"), /source-manuscript/);
    assert.throws(() => adoptManuscript(root, source), /already contains/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("splits a single file on Markdown and plain chapter headings", () => {
  const parent = temp();
  try {
    const markdownRoot = initializeProject(parent, { projectName: "Markdown Split", projectType: "standalone", profile: "thriller" });
    const markdown = join(parent, "markdown-book.md");
    writeFileSync(markdown, "# Chapter 1 - First Move\n\nOne.\n\n# Chapter 2 - Second Move\n\nTwo.\n", "utf8");
    assert.equal(adoptManuscript(markdownRoot, markdown).chapters, 2);

    const plainRoot = initializeProject(parent, { projectName: "Plain Split", projectType: "standalone", profile: "thriller" });
    const plain = join(parent, "plain-book.txt");
    writeFileSync(plain, "Chapter 1\n\nOne.\n\nChapter 2\n\nTwo.\n", "utf8");
    assert.equal(adoptManuscript(plainRoot, plain).chapters, 2);

    const singleRoot = initializeProject(parent, { projectName: "Single File", projectType: "standalone", profile: "thriller" });
    const single = join(parent, "single.txt");
    writeFileSync(single, "A complete short manuscript without chapter headings.\n", "utf8");
    assert.equal(adoptManuscript(singleRoot, single).chapters, 1);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject, readProject } from "../src/project/store.js";
import { addBook } from "../src/project/add-book.js";

test("a standalone project can add Book 2 without restructuring", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-add-book-"));
  try {
    const root = initializeProject(parent, { projectName: "Expandable", projectType: "standalone", profile: "romantasy" });
    const bookId = addBook(root, 120000);
    const project = readProject(root);
    assert.equal(bookId, "book-02");
    assert.equal(project.active_book, "book-02");
    assert.equal(project.project_type, "open-ended-series");
    assert.ok(existsSync(join(root, "books", "book-02", "genre.yaml")));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

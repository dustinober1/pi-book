import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject, writeProjectEvent } from "../src/project/store.js";
import { addBook } from "../src/project/add-book.js";

test("adding Book 2 requires a locked current book unless explicitly forced", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-add-book-"));
  try {
    const root = initializeProject(parent, { projectName: "Expandable", projectType: "standalone", profile: "romantasy" });
    assert.throws(() => addBook(root, 120000), /lock|handoff/i);

    const currentBook = readBook(root);
    currentBook.status = "locked";
    currentBook.canon_locked = true;
    writeProjectEvent(root, [{ path: "books/book-01/BOOK.yaml", content: stringifyYaml(currentBook) }], "test: lock book one");

    const bookId = addBook(root, 120000);
    const project = readProject(root);
    assert.equal(bookId, "book-02");
    assert.equal(project.active_book, "book-02");
    assert.equal(project.project_type, "open-ended-series");
    assert.ok(existsSync(join(root, "books", "book-02", "genre.yaml")));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("forced series expansion is explicit", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-add-book-force-"));
  try {
    const root = initializeProject(parent, { projectName: "Forced", projectType: "standalone", profile: "thriller" });
    assert.equal(addBook(root, 95000, { force: true }), "book-02");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

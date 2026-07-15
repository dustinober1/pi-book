import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNextBookWizardHandler } from "../src/application/next-book-wizard.js";
import { BookSchema, type BookState } from "../src/domain/schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-next-book-wizard-")); }

test("next-book wizard previews inheritance proposal", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" });
    const path = join(root, "books/book-01/BOOK.yaml");
    const book = parseYaml<BookState>(readFileSync(path, "utf8"), BookSchema, "BOOK.yaml");
    book.canon_locked = true;
    book.status = "locked";
    writeFileSync(path, stringifyYaml(book), "utf8");
    const handler = createNextBookWizardHandler(root);
    const preview = await handler.preview!("inheritance", {}) as any;
    assert.equal(preview.bookId, "book-02");
    assert.equal(preview.previousBook, "book-01");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

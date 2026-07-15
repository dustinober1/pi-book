import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWizardRegistry } from "../src/application/wizard.js";
import { BookSchema, CanonSchema, StoryThreadsSchema, type BookState, type CanonState, type StoryThreadsState } from "../src/domain/schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-next-snapshot-")); }

test("next-book browser snapshot includes locked canon and open threads", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" });
    const bookPath = join(root, "books/book-01/BOOK.yaml");
    const book = parseYaml<BookState>(readFileSync(bookPath, "utf8"), BookSchema, "BOOK.yaml");
    book.canon_locked = true;
    book.status = "locked";
    writeFileSync(bookPath, stringifyYaml(book), "utf8");
    const canon: CanonState = { schema_version: "1.0.0", facts: [{ id: "FACT-001", category: "technology", subject: "Argus", fact: "Argus does not become sentient.", source: "book-01", status: "locked", introduced_in: "book-01" }], relationships: [] };
    const threads: StoryThreadsState = { schema_version: "1.0.0", threads: [{ id: "THREAD-001", type: "conspiracy", setup: "Who authorized it?", reader_knows: "The chain is incomplete.", characters_know: {}, status: "open", intended_payoff: null, last_advanced_in: "book-01" }] };
    writeFileSync(join(root, "series/canon.yaml"), stringifyYaml(canon), "utf8");
    writeFileSync(join(root, "series/story-threads.yaml"), stringifyYaml(threads), "utf8");
    const snapshot = await createWizardRegistry(root).snapshot("next-book") as any;
    assert.equal(snapshot.workflow.proposal.bookId, "book-02");
    assert.equal(snapshot.workflow.proposal.canon[0].id, "FACT-001");
    assert.equal(snapshot.workflow.proposal.openThreads[0].id, "THREAD-001");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

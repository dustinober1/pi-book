import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNextBookInheritanceProposal, createNextBookFromDecision } from "../src/application/next-book.js";
import { BookSchema, CanonSchema, StoryThreadsSchema, type BookState, type CanonState, type StoryThreadsState } from "../src/domain/schemas.js";
import { InheritedContextSchema, type InheritedContext } from "../src/domain/v1-2-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-next-book-")); }
function lockBook(root: string): void {
  const bookPath = join(root, "books/book-01/BOOK.yaml");
  const book = parseYaml<BookState>(readFileSync(bookPath, "utf8"), BookSchema, "BOOK.yaml");
  book.title = "The Clean Signal";
  book.canon_locked = true;
  book.status = "locked";
  writeFileSync(bookPath, stringifyYaml(book), "utf8");
  const canon: CanonState = { schema_version: "1.0.0", facts: [{ id: "FACT-001", category: "institution", subject: "Argus", fact: "Argus does not become sentient.", source: "book-01", status: "locked", introduced_in: "book-01" }], relationships: [] };
  writeFileSync(join(root, "series/canon.yaml"), stringifyYaml(canon), "utf8");
  const threads: StoryThreadsState = { schema_version: "1.0.0", threads: [{ id: "THREAD-001", type: "conspiracy", setup: "Who authorized the clean signal?", reader_knows: "The authority chain is incomplete.", characters_know: {}, status: "open", intended_payoff: null, last_advanced_in: "book-01" }] };
  writeFileSync(join(root, "series/story-threads.yaml"), stringifyYaml(threads), "utf8");
}

test("next-book proposal previews inherited canon and unresolved threads", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" });
    lockBook(root);
    const proposal = buildNextBookInheritanceProposal(root);
    assert.equal(proposal.bookId, "book-02");
    assert.ok(proposal.canon.some((fact) => fact.id === "FACT-001"));
    assert.ok(proposal.openThreads.some((thread) => thread.id === "THREAD-001"));
    assert.equal(proposal.previousTitle, "The Clean Signal");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("next-book creation records only author-approved inherited context", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" });
    lockBook(root);
    const result = createNextBookFromDecision(root, {
      title: "The Older Signature",
      role: "escalate the authority-chain conspiracy",
      relationship: "direct-continuation",
      profile: "thriller",
      targetWords: 110000,
      protagonist: "Julie O'Donnell",
      continuingThreadIds: ["THREAD-001"],
      deferredThreadIds: [],
      inheritedCanonIds: ["FACT-001"],
      immutableFacts: ["Argus does not become sentient."],
      optionalContext: [],
      excludedContext: ["Do not resolve the conspiracy during setup."],
    });
    assert.equal(result.bookId, "book-02");
    const inherited = parseYaml<InheritedContext>(readFileSync(join(root, "books/book-02/inherited-context.yaml"), "utf8"), InheritedContextSchema, "inherited-context.yaml");
    assert.deepEqual(inherited.inherited_canon_ids, ["FACT-001"]);
    assert.deepEqual(inherited.continuing_thread_ids, ["THREAD-001"]);
    assert.equal(inherited.protagonist, "Julie O'Donnell");
    assert.equal(readProject(root).active_book, "book-02");
    assert.equal(existsSync(join(root, "books/book-02/inheritance-report.md")), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("next-book creation may switch a series installment to historical fiction", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" });
    lockBook(root);
    const result = createNextBookFromDecision(root, {
      title: "The Earlier Signal",
      role: "reveal the institution's nineteenth-century origin",
      relationship: "prequel",
      profile: "historical-fiction",
      targetWords: 100000,
      protagonist: "Ada Finch",
      continuingThreadIds: [],
      deferredThreadIds: ["THREAD-001"],
      inheritedCanonIds: ["FACT-001"],
      immutableFacts: ["Argus does not become sentient."],
      optionalContext: [],
      excludedContext: [],
    });
    assert.equal(existsSync(join(root, `books/${result.bookId}/historical-context.yaml`)), true);
    assert.equal(existsSync(join(root, `books/${result.bookId}/invention-ledger.yaml`)), true);
    assert.equal(readProject(root).default_profile, "historical-fiction");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

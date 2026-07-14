import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackagingChecklist, nextBookProposal } from "../src/application/package-checklist.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-package-guidance-")); }

test("packaging checklist reports manuscript, approval, canon, tickets, reader claims, and package state", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package Guide", projectType: "standalone", profile: "thriller" });
    const first = buildPackagingChecklist(root);
    assert.equal(first.ready, false);
    assert.ok(first.items.some((item) => item.id === "manuscript" && !item.complete));
    assert.ok(first.items.some((item) => item.id === "manuscript-approval" && !item.complete));
    assert.ok(first.items.some((item) => item.id === "canon-lock" && !item.complete));
    assert.ok(first.items.some((item) => item.id === "blocking-tickets"));
    assert.ok(first.items.some((item) => item.id === "reader-claims"));
    assert.ok(first.items.some((item) => item.id === "package-artifact"));

    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Chapter 1\n\nComplete text.\n", "utf8");
    const project = readProject(root);
    project.gates["manuscript-approval"] = "approved";
    project.current_stage = "packaging";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.canon_locked = true;
    book.status = "locked";
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const second = buildPackagingChecklist(root);
    assert.ok(second.items.find((item) => item.id === "manuscript")?.complete);
    assert.ok(second.items.find((item) => item.id === "manuscript-approval")?.complete);
    assert.ok(second.items.find((item) => item.id === "canon-lock")?.complete);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("next-book proposal is contextual and requires a locked or packaged current book", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Next Book", projectType: "standalone", profile: "romantasy", targetWords: 110000 });
    assert.throws(() => nextBookProposal(root), /lock|package/i);
    const project = readProject(root);
    project.current_stage = "complete";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.canon_locked = true;
    book.status = "packaged";
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const proposal = nextBookProposal(root);
    assert.equal(proposal.bookId, "book-02");
    assert.equal(proposal.profile, "romantasy");
    assert.equal(proposal.targetWords, 110000);
    assert.equal(proposal.previousBook, "book-01");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
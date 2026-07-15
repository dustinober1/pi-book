import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addBook } from "../src/project/add-book.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-v13-compat-")); }

const seriesArtifacts = [
  "series/taste-profile.yaml",
  "series/voice-guardrails.yaml",
  "series/voice-experiments/index.yaml",
];

const bookArtifacts = [
  "research-ledger.yaml",
  "book-strategy.yaml",
  "voice-audits.yaml",
];

test("new projects seed all Novel Forge 1.3 evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Taste Test", projectType: "standalone", profile: "thriller" });
    for (const path of seriesArtifacts) assert.equal(existsSync(join(root, path)), true, path);
    for (const path of bookArtifacts) assert.equal(existsSync(join(root, "books", "book-01", path)), true, path);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("newly added books receive the book-level 1.3 evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series Taste", projectType: "planned-series", profile: "romantasy" });
    assert.equal(addBook(root, 105000, { force: true }), "book-02");
    for (const path of bookArtifacts) assert.equal(existsSync(join(root, "books", "book-02", path)), true, path);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject, readBook, readProject, requireProjectRoot } from "../src/project/store.js";
import { listFilesRecursive } from "../src/infrastructure/files.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-project-")); }

test("initialization creates a compact series-capable thriller project", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Sharp Signal", projectType: "standalone", profile: "thriller", targetWords: 95000 });
    const project = readProject(root);
    const book = readBook(root);
    assert.equal(project.active_book, "book-01");
    assert.equal(book.target_words, 95000);
    assert.equal(book.profile, "thriller");
    const controls = listFilesRecursive(root, (path) => !path.includes("/.git/") && !path.includes("manuscript/chapters"));
    assert.ok(controls.length <= 35, `expected compact controls including intake provenance and three atomic story ledgers, found ${controls.length}`);
    for (const path of [
      "remarkability.yaml", "reader-experiments.yaml", "publishing.yaml", "marketing.yaml", "reader-kits/index.yaml",
      "research-ledger.yaml", "book-strategy.yaml", "voice-audits.yaml",
    ]) assert.equal(existsSync(join(root, "books", "book-01", path)), true, path);
    for (const path of ["entity-registry.yaml", "state-ledger.yaml", "knowledge-ledger.yaml"]) {
      assert.equal(existsSync(join(root, "series", path)), true, path);
    }
    assert.match(readFileSync(join(root, "series", "voice-profile.md"), "utf8"), /Not-this-author evidence/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a command run from the same directory novel-start was run in resolves the project it just created", () => {
  // novel-start creates its project one directory below the cwd it ran from
  // (books/<slug>), and the documented quick start runs the very next command
  // — /novel — from that same, unchanged shell directory. requireProjectRoot
  // must resolve the project without the caller having to cd into it first.
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Sharp Signal", projectType: "standalone", profile: "thriller" });
    assert.equal(requireProjectRoot(parent), root);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("resolving from inside the project itself still takes precedence over the sibling fallback", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Sharp Signal", projectType: "standalone", profile: "thriller" });
    assert.equal(requireProjectRoot(root), root);
    assert.equal(requireProjectRoot(join(root, "books", "book-01")), root);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("two sibling projects under the same cwd are ambiguous and name both candidates", () => {
  const parent = temp();
  try {
    const first = initializeProject(parent, { projectName: "Novel A", projectType: "standalone", profile: "thriller" });
    const second = initializeProject(parent, { projectName: "Novel B", projectType: "standalone", profile: "thriller" });
    assert.throws(() => requireProjectRoot(parent), (error: Error) => {
      assert.match(error.message, /Multiple Novel Forge projects exist directly under/);
      assert.ok(error.message.includes(first));
      assert.ok(error.message.includes(second));
      return true;
    });
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a cwd with no project anywhere near it still fails with the original, unambiguous message", () => {
  const parent = temp();
  try {
    mkdirSync(join(parent, "unrelated-notes"), { recursive: true });
    assert.throws(() => requireProjectRoot(parent), /No Novel Forge project found from .+\. Run \/novel-start first\./);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

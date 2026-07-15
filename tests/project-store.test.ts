import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
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
    assert.ok(controls.length <= 23, `expected compact v1.2 controls, found ${controls.length}`);
    for (const path of ["remarkability.yaml", "reader-experiments.yaml", "publishing.yaml", "marketing.yaml", "reader-kits/index.yaml"]) {
      assert.equal(existsSync(join(root, "books", "book-01", path)), true, path);
    }
    assert.match(readFileSync(join(root, "series", "voice-profile.md"), "utf8"), /Not-this-author evidence/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

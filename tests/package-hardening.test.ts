import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileActiveBook } from "../src/application/package.js";
import { initializeProject } from "../src/project/store.js";

test("packaging requires manuscript chapters and rejects duplicate chapter numbers", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-package-"));
  try {
    const root = initializeProject(parent, { projectName: "Package", projectType: "standalone", profile: "thriller" });
    assert.throws(() => compileActiveBook(root), /no manuscript chapters/i);
    const chapters = join(root, "books", "book-01", "manuscript", "chapters"); mkdirSync(chapters, { recursive: true });
    writeFileSync(join(chapters, "01-a.md"), "# A\n\nOne", "utf8");
    writeFileSync(join(chapters, "01-b.md"), "# B\n\nTwo", "utf8");
    assert.throws(() => compileActiveBook(root), /duplicate chapter 1/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

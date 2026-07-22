import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildChapterDeltaSummary, renderChapterDeltaSummary } from "../src/application/chapter-delta-summary.js";
import { readStoryRecordIndex, rebuildStoryRecordIndex } from "../src/application/rebuild-story-index.js";
import { chapterDeltaSummaryPath } from "../src/domain/chapter-delta-summary.js";
import { initializeProject } from "../src/project/store.js";

const manuscriptPath = "books/book-01/manuscript/chapters/01-opening.md";
const originalManuscript = "Mara crossed the archive.\n\nThe terminal lights came alive.";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-delta-index-integrity-"));
  const root = initializeProject(parent, { projectName: "Delta Integrity", projectType: "standalone", profile: "thriller" });
  mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
  writeFileSync(join(root, manuscriptPath), originalManuscript, "utf8");
  const summary = buildChapterDeltaSummary({
    runId: "RUN-DELTA-INTEGRITY",
    bookId: "book-01",
    chapter: 1,
    contractHash: "a".repeat(64),
    manuscriptPath,
    manuscriptText: originalManuscript,
    beforeStateLedger: { schema_version: "1.0.0", records: [] },
    afterStateLedger: { schema_version: "1.0.0", records: [] },
    entityRegistry: { schema_version: "1.0.0", entities: [] },
    mutations: [],
    createdAt: "2026-07-22T12:00:00.000Z",
  });
  const deltaPath = chapterDeltaSummaryPath("book-01", 1);
  mkdirSync(join(root, "books", "book-01", "deltas"), { recursive: true });
  writeFileSync(join(root, deltaPath), renderChapterDeltaSummary(summary), "utf8");
  return { parent, root };
}

test("a manuscript change makes an indexed chapter delta stale", () => {
  const { parent, root } = setup();
  try {
    rebuildStoryRecordIndex(root);
    writeFileSync(join(root, manuscriptPath), `${originalManuscript}\n\nA new unsupported ending.`, "utf8");
    assert.throws(() => readStoryRecordIndex(root), /story record index is stale/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("rebuilding rejects a chapter delta whose manuscript hash no longer matches", () => {
  const { parent, root } = setup();
  try {
    writeFileSync(join(root, manuscriptPath), "A different manuscript now occupies this path.", "utf8");
    assert.throws(() => rebuildStoryRecordIndex(root), /chapter delta.*manuscript hash/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

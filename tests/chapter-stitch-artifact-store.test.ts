import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChapterStitchArtifact } from "../src/domain/chapter-stitch-artifact.js";
import { chapterStitchArtifactPath, readChapterStitchArtifact, writeChapterStitchArtifact } from "../src/infrastructure/chapter-stitch-artifact-store.js";

function artifact(): ChapterStitchArtifact {
  return {
    schema_version: "1.0.0", run_id: "RUN-001", chapter: 1,
    contract_hash: "a".repeat(64), story_index_hash: "b".repeat(64),
    scene_ids: ["CH-001-SC-01-V1"],
    scenes: [{ scene_id: "CH-001-SC-01-V1", contract_hash: "c".repeat(64), draft_attempt: 1, draft_output_hash: "d".repeat(64), acceptance_artifact_hash: "e".repeat(64), word_count: 4 }],
    chapter_text: "Mara reached the terminal.", word_count: 4, output_hash: "f".repeat(64),
    accepted_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal." }],
    next_node: "chapter-validate", created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("chapter stitch artifacts persist atomic chapter and scene contract provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-stitch-artifact-"));
  try {
    const value = artifact();
    const path = writeChapterStitchArtifact(root, value);
    assert.equal(path, chapterStitchArtifactPath(root, value.run_id, value.chapter));
    assert.deepEqual(readChapterStitchArtifact(root, value.run_id, value.chapter), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "chapters", "chapter-001")), ["stitched.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("chapter stitch storage rejects unsafe identifiers and chapters", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-stitch-artifact-"));
  try {
    assert.throws(() => readChapterStitchArtifact(root, "../escape", 1), /invalid run id/i);
    assert.throws(() => readChapterStitchArtifact(root, "RUN-001", 0), /chapter/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

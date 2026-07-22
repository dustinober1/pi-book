import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChapterValidationArtifact } from "../src/domain/chapter-validation-artifact.js";
import {
  chapterValidationArtifactPath,
  readChapterValidationArtifact,
  writeChapterValidationArtifact,
} from "../src/infrastructure/chapter-validation-artifact-store.js";

function artifact(): ChapterValidationArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    stitch_artifact_hash: "a".repeat(64),
    stitch_output_hash: "b".repeat(64),
    contract_hash: "c".repeat(64),
    story_index_hash: "d".repeat(64),
    scene_ids: ["CH-001-SC-01-V1"],
    findings: [],
    blocker_count: 0,
    warning_count: 0,
    passed: true,
    next_action: "chapter-commit",
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

test("chapter validation artifacts persist atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-validation-artifact-"));
  try {
    const value = artifact();
    const path = writeChapterValidationArtifact(root, value);
    assert.equal(path, chapterValidationArtifactPath(root, value.run_id, value.chapter));
    assert.deepEqual(readChapterValidationArtifact(root, value.run_id, value.chapter), value);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", value.run_id, "chapters", "chapter-001")), ["validation.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("chapter validation storage rejects unsafe identifiers and chapters", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-validation-artifact-"));
  try {
    assert.throws(() => readChapterValidationArtifact(root, "../escape", 1), /invalid run id/i);
    assert.throws(() => readChapterValidationArtifact(root, "RUN-001", 0), /chapter/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

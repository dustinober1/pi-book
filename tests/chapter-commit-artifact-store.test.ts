import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChapterCommitArtifact } from "../src/domain/chapter-commit-artifact.js";
import {
  chapterCommitArtifactPath,
  readChapterCommitArtifact,
  writeChapterCommitArtifact,
} from "../src/infrastructure/chapter-commit-artifact-store.js";

function artifact(status: "prepared" | "committed" = "prepared"): ChapterCommitArtifact {
  return {
    schema_version: "1.0.0", run_id: "RUN-001", chapter: 1, status,
    project_hash_before: "a".repeat(64), project_hash_after: status === "committed" ? "b".repeat(64) : null,
    story_index_hash_before: "c".repeat(64), story_index_hash_after: status === "committed" ? "d".repeat(64) : null,
    contract_hash: "e".repeat(64), stitch_artifact_hash: "f".repeat(64), validation_artifact_hash: "1".repeat(64),
    stitch_output_hash: "2".repeat(64), manuscript_path: "books/book-01/manuscript/chapters/01-opening.md",
    manuscript_hash: "3".repeat(64), state_ledger_path: "series/state-ledger.yaml", state_ledger_hash: "4".repeat(64),
    applied_mutations: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal" }],
    changed_paths: status === "committed" ? ["books/book-01/manuscript/chapters/01-opening.md", "series/state-ledger.yaml"] : [],
    git_message: status === "committed" ? "Novel Forge: draft-chapter chapter-1" : null,
    prepared_at: "2026-07-22T00:00:00.000Z", committed_at: status === "committed" ? "2026-07-22T00:00:01.000Z" : null,
  };
}

test("chapter commit journals can be atomically upgraded from prepared to committed", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-commit-artifact-"));
  try {
    writeChapterCommitArtifact(root, artifact());
    writeChapterCommitArtifact(root, artifact("committed"));
    assert.deepEqual(readChapterCommitArtifact(root, "RUN-001", 1), artifact("committed"));
    assert.equal(chapterCommitArtifactPath(root, "RUN-001", 1), join(root, ".pi-book", "runs", "RUN-001", "chapters", "chapter-001", "commit.json"));
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", "RUN-001", "chapters", "chapter-001")), ["commit.json"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("chapter commit journal storage rejects unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-chapter-commit-artifact-"));
  try {
    assert.throws(() => readChapterCommitArtifact(root, "../escape", 1), /invalid run id/i);
    assert.throws(() => readChapterCommitArtifact(root, "RUN-001", 0), /positive chapter/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

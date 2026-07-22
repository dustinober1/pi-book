import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStoryRecordIndex, rebuildStoryRecordIndex } from "../src/application/rebuild-story-index.js";
import { approvedPlanChangeRecordPath } from "../src/domain/plan-change-request.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

test("approved plan changes are indexed as accepted decisions with future dependencies", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-plan-change-index-"));
  const root = initializeProject(parent, { projectName: "Plan Change Index", projectType: "standalone", profile: "thriller" });
  try {
    const path = approvedPlanChangeRecordPath("book-01", "PC-001");
    mkdirSync(join(root, "books/book-01/plan-changes"), { recursive: true });
    writeFileSync(join(root, path), stringifyYaml({
      schema_version: "1.0.0",
      request_id: "PC-001",
      book_id: "book-01",
      status: "approved",
      scope: "local",
      proposed_change: "Move Chapter 2 to the river route.",
      reason: "Accepted Chapter 1 prose blocks the archive route.",
      manuscript_evidence: [{ chapter: 1, manuscript_path: "books/book-01/manuscript/chapters/01-opening.md", manuscript_hash: "a".repeat(64), quote: "archive route" }],
      affected_chapters: [2],
      affected_contract_ids: ["CH-002"],
      affected_arc_ids: [],
      affected_thread_ids: ["THREAD-ACCESS"],
      affected_payoff_ids: ["PAYOFF-RIVER"],
      control_file_hashes: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", hash: "b".repeat(64) }],
      source_request_hash: "c".repeat(64),
      source_project_hash: "d".repeat(64),
      writer_approval: { approved_by: "writer", approved_at: "2026-07-22T15:05:00.000Z", evidence_hash: "e".repeat(64), note: "Approved." },
      applied_at: "2026-07-22T15:05:00.000Z",
    }), "utf8");

    rebuildStoryRecordIndex(root);
    const record = readStoryRecordIndex(root).records.find((item) => item.id === "PC-001");
    assert.equal(record?.kind, "plan-change");
    assert.equal(record?.status, "accepted-manuscript-fact");
    assert.deepEqual(record?.chapter_scope, [2]);
    assert.deepEqual(record?.dependencies, ["CH-002", "PAYOFF-RIVER", "THREAD-ACCESS"]);

    const before = readFileSync(join(root, path), "utf8");
    writeFileSync(join(root, path), before.replace("river route", "mountain route"), "utf8");
    assert.throws(() => readStoryRecordIndex(root), /story record index is stale/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

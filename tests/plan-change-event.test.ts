import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { ApprovedPlanChangeRecordSchema, type ApprovedPlanChangeRecord } from "../src/domain/plan-change-request.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const manuscript = "Mara rejects the archive route.";

function contract(chapter: number): string {
  return stringifyYaml({
    schema_version: "2.0.0", contract_id: `CH-${String(chapter).padStart(3, "0")}`, version: 1, chapter, title: "Future",
    source_kind: "legacy-packet", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA", purpose: "Future work",
    required_beats: ["Future beat"], active_thread_ids: [], required_record_ids: [], start_state_ids: [], required_end_state: [],
    forbidden_changes: [], knowledge_boundary_ids: [], target_words: { minimum: 900, maximum: 1200 }, ending_hook: "future",
    small_model_ready: false, missing_small_model_fields: ["start_state_ids", "required_end_state", "forbidden_changes", "knowledge_boundary_ids"],
  });
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-plan-change-event-"));
  const root = initializeProject(parent, { projectName: "Plan Change Event", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const book = readBook(root);
  book.current_chapter = 1;
  book.status = "drafting";
  writeFileSync(join(root, "books/book-01/BOOK.yaml"), stringifyYaml(book), "utf8");
  writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), manuscript, "utf8");
  return { parent, root };
}

function record(projectHash: string): ApprovedPlanChangeRecord {
  return {
    schema_version: "1.0.0",
    request_id: "PC-001",
    book_id: "book-01",
    status: "approved",
    scope: "local",
    proposed_change: "Change Chapter 2's future route.",
    reason: "Accepted Chapter 1 prose rejects the archive route.",
    manuscript_evidence: [{ chapter: 1, manuscript_path: "books/book-01/manuscript/chapters/01-opening.md", manuscript_hash: hash(manuscript), quote: "rejects the archive route" }],
    affected_chapters: [2],
    affected_contract_ids: ["CH-002"],
    affected_arc_ids: [],
    affected_thread_ids: [],
    affected_payoff_ids: [],
    control_file_hashes: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", hash: hash(contract(2)) }],
    source_request_hash: "b".repeat(64),
    source_project_hash: projectHash,
    writer_approval: { approved_by: "writer", approved_at: "2026-07-22T15:05:00.000Z", evidence_hash: "c".repeat(64), note: "Approved." },
    applied_at: "2026-07-22T15:05:00.000Z",
  };
}

test("plan-change event requires writer approval and applies only approved future controls", () => {
  const { parent, root } = setup();
  try {
    const expectedHash = projectStateHash(root);
    const approved = record(expectedHash);
    assert.equal(ApprovedPlanChangeRecordSchema !== undefined, true);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "plan-change", expectedStage: "drafting", expectedProjectHash: expectedHash,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(approved) },
        { path: "books/book-01/contracts/chapters/CH-002.yaml", content: contract(2) },
      ],
    }), /writer approval evidence|required plan-change approval/i);

    const result = applyNovelEvent(root, {
      eventType: "plan-change", expectedStage: "drafting", expectedProjectHash: expectedHash,
      planChangeApproval: approved.writer_approval,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(approved) },
        { path: "books/book-01/contracts/chapters/CH-002.yaml", content: contract(2) },
      ],
    });
    assert.equal(result.stage, "drafting");
    assert.ok(existsSync(join(root, "books/book-01/plan-changes/PC-001.yaml")));
    assert.ok(existsSync(join(root, "books/book-01/contracts/chapters/CH-002.yaml")));
    assert.equal(readFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "utf8"), manuscript);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("plan-change event blocks manuscript writes and current or past chapter contract changes", () => {
  const { parent, root } = setup();
  try {
    const expectedHash = projectStateHash(root);
    const approved = record(expectedHash);
    const base = {
      eventType: "plan-change" as const,
      expectedStage: "drafting" as const,
      expectedProjectHash: expectedHash,
      planChangeApproval: approved.writer_approval,
    };
    assert.throws(() => applyNovelEvent(root, {
      ...base,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(approved) },
        { path: "books/book-01/manuscript/chapters/01-opening.md", content: "rewritten" },
      ],
    }), /not allowed|accepted manuscript/i);

    const currentRecord = { ...approved, affected_chapters: [1], affected_contract_ids: ["CH-001"], control_file_hashes: [{ path: "books/book-01/contracts/chapters/CH-001.yaml", hash: hash(contract(1)) }] };
    assert.throws(() => applyNovelEvent(root, {
      ...base,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(currentRecord) },
        { path: "books/book-01/contracts/chapters/CH-001.yaml", content: contract(1) },
      ],
    }), /future chapter|already drafted|Chapter 1/i);
    assert.equal(existsSync(join(root, "books/book-01/contracts/chapters/CH-001.yaml")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("plan-change record, approval evidence, and file hashes must agree", () => {
  const { parent, root } = setup();
  try {
    const expectedHash = projectStateHash(root);
    const approved = record(expectedHash);
    const mismatched = { ...approved, writer_approval: { ...approved.writer_approval, evidence_hash: "d".repeat(64) } };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "plan-change", expectedStage: "drafting", expectedProjectHash: expectedHash,
      planChangeApproval: approved.writer_approval,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(mismatched) },
        { path: "books/book-01/contracts/chapters/CH-002.yaml", content: contract(2) },
      ],
    }), /approval evidence.*does not match|evidence hash/i);

    const badHash = { ...approved, control_file_hashes: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", hash: "e".repeat(64) }] };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "plan-change", expectedStage: "drafting", expectedProjectHash: expectedHash,
      planChangeApproval: approved.writer_approval,
      files: [
        { path: "books/book-01/plan-changes/PC-001.yaml", content: stringifyYaml(badHash) },
        { path: "books/book-01/contracts/chapters/CH-002.yaml", content: contract(2) },
      ],
    }), /control file hash.*does not match/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

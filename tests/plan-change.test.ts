import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  approvePlanChangeRequest,
  listPendingPlanChangeRequests,
  planChangeRequestPath,
  proposePlanChangeRequest,
  readPlanChangeRequest,
  rejectPlanChangeRequest,
} from "../src/application/plan-change.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { ApprovedPlanChangeRecordSchema, approvedPlanChangeRecordPath, type ApprovedPlanChangeRecord } from "../src/domain/plan-change-request.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const chapterText = "Mara proves the archive route is unusable and chooses the river approach.";

function futureContract(): string {
  return stringifyYaml({
    schema_version: "2.0.0",
    contract_id: "CH-002",
    version: 1,
    chapter: 2,
    title: "River Approach",
    source_kind: "legacy-packet",
    source_packet_hash: "a".repeat(64),
    pov: "CHAR-MARA",
    purpose: "Use the river approach established by accepted prose.",
    required_beats: ["Reach the river"],
    active_thread_ids: [],
    required_record_ids: [],
    start_state_ids: [],
    required_end_state: [],
    forbidden_changes: [],
    knowledge_boundary_ids: [],
    target_words: { minimum: 900, maximum: 1200 },
    ending_hook: "The route is watched.",
    small_model_ready: false,
    missing_small_model_fields: ["start_state_ids", "required_end_state", "forbidden_changes", "knowledge_boundary_ids"],
  });
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-plan-change-"));
  const root = initializeProject(parent, { projectName: "Plan Change", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const book = readBook(root);
  book.current_chapter = 1;
  book.actual_words = chapterText.split(/\s+/).length;
  book.status = "drafting";
  writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
  const manuscriptPath = "books/book-01/manuscript/chapters/01-opening.md";
  writeFileSync(join(root, manuscriptPath), chapterText, "utf8");
  return { parent, root, manuscriptPath };
}

function proposal(root: string, manuscriptPath: string) {
  return {
    request_id: "PC-001",
    book_id: "book-01",
    scope: "local" as const,
    proposed_change: "Replace the future archive approach with the river approach.",
    reason: "Accepted Chapter 1 prose makes the archive route unusable.",
    manuscript_evidence: [{
      chapter: 1,
      manuscript_path: manuscriptPath,
      manuscript_hash: hash(chapterText),
      quote: "archive route is unusable",
    }],
    affected_chapters: [2],
    affected_contract_ids: ["CH-002"],
    affected_arc_ids: [],
    affected_thread_ids: [],
    affected_payoff_ids: [],
    control_files_to_update: ["books/book-01/contracts/chapters/CH-002.yaml"],
    proposed_files: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", content: futureContract() }],
    source_project_hash: projectStateHash(root),
  };
}

test("plan-change proposals are noncanonical, evidence-grounded, and do not change project ownership", () => {
  const { parent, root, manuscriptPath } = setup();
  try {
    const before = projectStateHash(root);
    const result = proposePlanChangeRequest(root, proposal(root, manuscriptPath), "2026-07-22T15:00:00.000Z");
    assert.equal(result.request.status, "proposed");
    assert.equal(result.path, planChangeRequestPath(root, "PC-001"));
    assert.ok(existsSync(result.path));
    assert.equal(projectStateHash(root), before);
    assert.equal(existsSync(join(root, approvedPlanChangeRecordPath("book-01", "PC-001"))), false);
    assert.deepEqual(listPendingPlanChangeRequests(root).map((item) => item.request_id), ["PC-001"]);
    assert.deepEqual(readPlanChangeRequest(root, "PC-001"), result.request);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("writer approval applies future controls and one canonical approval record without rewriting accepted prose", () => {
  const { parent, root, manuscriptPath } = setup();
  try {
    const beforeHash = projectStateHash(root);
    proposePlanChangeRequest(root, proposal(root, manuscriptPath), "2026-07-22T15:00:00.000Z");
    const result = approvePlanChangeRequest(root, "PC-001", {
      confirmed: true,
      approved_by: "writer",
      note: "The accepted route consequence governs future chapters.",
      approved_at: "2026-07-22T15:05:00.000Z",
    });
    assert.equal(result.request.status, "applied");
    assert.equal(result.event.stage, "drafting");
    assert.notEqual(projectStateHash(root), beforeHash);
    assert.equal(readFileSync(join(root, manuscriptPath), "utf8"), chapterText);
    assert.ok(existsSync(join(root, "books/book-01/contracts/chapters/CH-002.yaml")));

    const recordPath = approvedPlanChangeRecordPath("book-01", "PC-001");
    const record = parseYaml<ApprovedPlanChangeRecord>(readFileSync(join(root, recordPath), "utf8"), ApprovedPlanChangeRecordSchema, recordPath);
    assert.equal(record.status, "approved");
    assert.equal(record.writer_approval.approved_by, "writer");
    assert.equal(record.source_request_hash, result.request.request_hash);
    assert.deepEqual(record.control_file_hashes.map((item) => item.path), ["books/book-01/contracts/chapters/CH-002.yaml"]);
    assert.equal(listPendingPlanChangeRequests(root).length, 0);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("plan-change proposal and approval reject missing evidence, stale ownership, and absent writer confirmation", () => {
  const missing = setup();
  try {
    const invalid = proposal(missing.root, missing.manuscriptPath);
    invalid.manuscript_evidence[0]!.quote = "This quote is absent";
    assert.throws(() => proposePlanChangeRequest(missing.root, invalid), /evidence quote.*not found/i);
  } finally { rmSync(missing.parent, { recursive: true, force: true }); }

  const stale = setup();
  try {
    proposePlanChangeRequest(stale.root, proposal(stale.root, stale.manuscriptPath));
    writeFileSync(join(stale.root, "series", "voice-profile.md"), "# Changed after proposal\n", "utf8");
    assert.throws(() => approvePlanChangeRequest(stale.root, "PC-001", { confirmed: true, approved_by: "writer", note: "stale", approved_at: "2026-07-22T15:05:00.000Z" }), /stale|project hash/i);
  } finally { rmSync(stale.parent, { recursive: true, force: true }); }

  const unconfirmed = setup();
  try {
    proposePlanChangeRequest(unconfirmed.root, proposal(unconfirmed.root, unconfirmed.manuscriptPath));
    assert.throws(() => approvePlanChangeRequest(unconfirmed.root, "PC-001", { confirmed: false, approved_by: "writer", note: "no", approved_at: "2026-07-22T15:05:00.000Z" }), /explicit writer confirmation/i);
    const rejected = rejectPlanChangeRequest(unconfirmed.root, "PC-001", "Writer kept the original route.", "2026-07-22T15:06:00.000Z");
    assert.equal(rejected.status, "rejected");
    assert.equal(projectStateHash(unconfirmed.root), proposal(unconfirmed.root, unconfirmed.manuscriptPath).source_project_hash);
  } finally { rmSync(unconfirmed.parent, { recursive: true, force: true }); }
});

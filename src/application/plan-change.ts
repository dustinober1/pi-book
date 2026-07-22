import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  ApprovedPlanChangeRecordSchema,
  PlanChangeRequestSchema,
  approvedPlanChangeRecordPath,
  type ApprovedPlanChangeRecord,
  type PlanChangeManuscriptEvidence,
  type PlanChangeRequest,
  type PlanChangeScope,
  type WriterApprovalEvidence,
} from "../domain/plan-change-request.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import {
  listStoredPlanChangeRequests,
  planChangeRequestStorePath,
  readStoredPlanChangeRequest,
  writePlanChangeRequest,
} from "../infrastructure/plan-change-store.js";
import { readBook, readProject } from "../project/store.js";
import { applyNovelEvent, projectStateHash, type NovelEventResult } from "./events.js";
import { isPlanChangeControlPathAllowed, planChangeRecordPathPattern } from "./plan-change-policy.js";

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function normalized(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function uniqueSorted<T extends string | number>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right)));
}

function requireEvidence(root: string, bookId: string, currentChapter: number, evidence: readonly PlanChangeManuscriptEvidence[]): void {
  for (const item of evidence) {
    if (item.chapter > currentChapter) throw new Error(`Plan-change evidence Chapter ${item.chapter} is not accepted manuscript yet.`);
    if (!item.manuscript_path.startsWith(`books/${bookId}/manuscript/chapters/`)) {
      throw new Error(`Plan-change evidence points outside the active manuscript: ${item.manuscript_path}.`);
    }
    const path = join(root, item.manuscript_path);
    if (!existsSync(path)) throw new Error(`Plan-change evidence manuscript is missing: ${item.manuscript_path}.`);
    const text = readFileSync(path, "utf8");
    if (hashText(text) !== item.manuscript_hash) throw new Error(`Plan-change evidence manuscript hash changed for ${item.manuscript_path}.`);
    const occurrences = text.split(item.quote).length - 1;
    if (occurrences === 0) throw new Error(`Plan-change evidence quote was not found in ${item.manuscript_path}.`);
    if (occurrences > 1) throw new Error(`Plan-change evidence quote is ambiguous in ${item.manuscript_path}.`);
  }
}

export interface ProposePlanChangeInput {
  request_id: string;
  book_id: string;
  scope: PlanChangeScope;
  proposed_change: string;
  reason: string;
  manuscript_evidence: PlanChangeManuscriptEvidence[];
  affected_chapters: number[];
  affected_contract_ids: string[];
  affected_arc_ids: string[];
  affected_thread_ids: string[];
  affected_payoff_ids: string[];
  control_files_to_update?: string[];
  proposed_files: Array<{ path: string; content: string }>;
  source_project_hash: string;
}

function requestCore(input: ProposePlanChangeInput, proposedFiles: PlanChangeRequest["proposed_files"]): unknown {
  return {
    request_id: input.request_id,
    book_id: input.book_id,
    scope: input.scope,
    proposed_change: input.proposed_change,
    reason: input.reason,
    manuscript_evidence: input.manuscript_evidence,
    affected_chapters: uniqueSorted(input.affected_chapters),
    affected_contract_ids: uniqueSorted(input.affected_contract_ids),
    affected_arc_ids: uniqueSorted(input.affected_arc_ids),
    affected_thread_ids: uniqueSorted(input.affected_thread_ids),
    affected_payoff_ids: uniqueSorted(input.affected_payoff_ids),
    control_files_to_update: proposedFiles.map((item) => item.path),
    proposed_files: proposedFiles,
    source_project_hash: input.source_project_hash,
  };
}

function validateProposal(root: string, input: ProposePlanChangeInput): PlanChangeRequest["proposed_files"] {
  const project = readProject(root);
  const book = readBook(root);
  if (book.book_id !== input.book_id || project.active_book !== input.book_id) throw new Error(`Plan change must target the active book ${book.book_id}.`);
  if (input.source_project_hash !== projectStateHash(root)) throw new Error("Plan-change proposal source project hash is stale.");
  if (!/^PC-[0-9]{3}$/.test(input.request_id)) throw new Error("Plan-change request ID must use PC-NNN format.");
  if (!input.proposed_change.trim() || !input.reason.trim()) throw new Error("Plan-change proposal and reason are required.");
  if (!input.manuscript_evidence.length) throw new Error("Plan-change proposal requires accepted manuscript evidence.");
  if (!input.proposed_files.length) throw new Error("Plan-change proposal requires at least one future control file.");
  requireEvidence(root, book.book_id, book.current_chapter, input.manuscript_evidence);

  const seen = new Set<string>();
  const files = input.proposed_files.map((file) => {
    const path = normalized(file.path);
    if (seen.has(path)) throw new Error(`Plan-change proposal duplicates ${path}.`);
    seen.add(path);
    if (!isPlanChangeControlPathAllowed(path, book.book_id) || planChangeRecordPathPattern(book.book_id).test(path)) {
      throw new Error(`${path} is not an allowed proposed future control file.`);
    }
    if (path.includes("/manuscript/") || path.includes("/deltas/")) throw new Error("Plan change cannot propose accepted manuscript or chapter-delta writes.");
    const contract = path.match(/\/contracts\/chapters\/CH-([0-9]{3})\.yaml$/);
    if (contract && Number.parseInt(contract[1]!, 10) <= book.current_chapter) {
      throw new Error(`Plan change may propose only a future chapter contract; Chapter ${Number.parseInt(contract[1]!, 10)} is already drafted or current.`);
    }
    return { path, content: file.content, content_hash: hashText(file.content) };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const declared = uniqueSorted(input.control_files_to_update ?? files.map((item) => item.path));
  if (canonical(declared) !== canonical(files.map((item) => item.path))) throw new Error("Plan-change control_files_to_update must exactly match proposed_files.");
  for (const chapter of input.affected_chapters) {
    if (!Number.isInteger(chapter) || chapter <= book.current_chapter) throw new Error(`Plan change may affect only future chapters; Chapter ${chapter} is already drafted or current.`);
  }
  return files;
}

export interface ProposePlanChangeResult {
  request: PlanChangeRequest;
  path: string;
}

export function proposePlanChangeRequest(root: string, input: ProposePlanChangeInput, now?: string): ProposePlanChangeResult {
  if (readStoredPlanChangeRequest(root, input.request_id)) throw new Error(`Plan-change request ${input.request_id} already exists.`);
  const proposedFiles = validateProposal(root, input);
  const createdAt = timestamp(now);
  const core = requestCore(input, proposedFiles);
  const request: PlanChangeRequest = {
    schema_version: "1.0.0",
    ...(core as Omit<PlanChangeRequest, "schema_version" | "status" | "request_hash" | "writer_approval" | "rejection_reason" | "created_at" | "updated_at" | "applied_at">),
    status: "proposed",
    request_hash: hashText(canonical(core)),
    writer_approval: null,
    rejection_reason: null,
    created_at: createdAt,
    updated_at: createdAt,
    applied_at: null,
  };
  if (!Value.Check(PlanChangeRequestSchema, request)) throw new Error("Plan-change proposal failed schema validation.");
  return { request, path: writePlanChangeRequest(root, request) };
}

export function planChangeRequestPath(root: string, requestId: string): string {
  return planChangeRequestStorePath(root, requestId);
}

export function readPlanChangeRequest(root: string, requestId: string): PlanChangeRequest | null {
  return readStoredPlanChangeRequest(root, requestId);
}

export function listPendingPlanChangeRequests(root: string): PlanChangeRequest[] {
  return listStoredPlanChangeRequests(root).filter((item) => item.status === "proposed");
}

function approvalEvidence(request: PlanChangeRequest, input: ApprovePlanChangeInput): WriterApprovalEvidence {
  return {
    approved_by: "writer",
    approved_at: input.approved_at,
    evidence_hash: hashText(canonical({ request_hash: request.request_hash, approved_at: input.approved_at, note: input.note })),
    note: input.note,
  };
}

function approvedRecord(request: PlanChangeRequest, approval: WriterApprovalEvidence): ApprovedPlanChangeRecord {
  const record: ApprovedPlanChangeRecord = {
    schema_version: "1.0.0",
    request_id: request.request_id,
    book_id: request.book_id,
    status: "approved",
    scope: request.scope,
    proposed_change: request.proposed_change,
    reason: request.reason,
    manuscript_evidence: request.manuscript_evidence,
    affected_chapters: request.affected_chapters,
    affected_contract_ids: request.affected_contract_ids,
    affected_arc_ids: request.affected_arc_ids,
    affected_thread_ids: request.affected_thread_ids,
    affected_payoff_ids: request.affected_payoff_ids,
    control_file_hashes: request.proposed_files.map((item) => ({ path: item.path, hash: item.content_hash })),
    source_request_hash: request.request_hash,
    source_project_hash: request.source_project_hash,
    writer_approval: approval,
    applied_at: approval.approved_at,
  };
  if (!Value.Check(ApprovedPlanChangeRecordSchema, record)) throw new Error("Approved plan-change record failed schema validation.");
  return record;
}

export interface ApprovePlanChangeInput {
  confirmed: boolean;
  approved_by: "writer";
  note: string;
  approved_at: string;
}

export interface ApprovePlanChangeResult {
  request: PlanChangeRequest;
  event: NovelEventResult;
  recovered: boolean;
}

export function approvePlanChangeRequest(root: string, requestId: string, input: ApprovePlanChangeInput): ApprovePlanChangeResult {
  if (!input.confirmed || input.approved_by !== "writer") throw new Error("Plan change requires explicit writer confirmation.");
  const request = readStoredPlanChangeRequest(root, requestId);
  if (!request) throw new Error(`Plan-change request ${requestId} was not found.`);
  if (request.status === "rejected") throw new Error(`Plan-change request ${requestId} was rejected.`);
  const project = readProject(root);
  const book = readBook(root);
  const recordPath = approvedPlanChangeRecordPath(request.book_id, request.request_id);
  const existingText = existsSync(join(root, recordPath)) ? readFileSync(join(root, recordPath), "utf8") : null;
  if (existingText) {
    const existing = parseYaml<ApprovedPlanChangeRecord>(existingText, ApprovedPlanChangeRecordSchema, recordPath);
    if (existing.source_request_hash !== request.request_hash) throw new Error("Existing approved plan-change record does not match the request.");
    const applied: PlanChangeRequest = {
      ...request,
      status: "applied",
      writer_approval: existing.writer_approval,
      updated_at: existing.applied_at,
      applied_at: existing.applied_at,
    };
    writePlanChangeRequest(root, applied);
    return {
      request: applied,
      event: { changed: [recordPath, ...existing.control_file_hashes.map((item) => item.path)], stage: project.current_stage, projectHash: projectStateHash(root), gitMessage: "Recovered previously applied plan change." },
      recovered: true,
    };
  }
  if (request.status !== "proposed") throw new Error(`Plan-change request ${requestId} is ${request.status}, not proposed.`);
  if (request.source_project_hash !== projectStateHash(root)) throw new Error("Plan-change request is stale because the project hash changed.");
  requireEvidence(root, book.book_id, book.current_chapter, request.manuscript_evidence);
  for (const file of request.proposed_files) if (hashText(file.content) !== file.content_hash) throw new Error(`Plan-change proposed file hash changed for ${file.path}.`);

  const approval = approvalEvidence(request, input);
  const record = approvedRecord(request, approval);
  const files: FileChange[] = [
    { path: recordPath, content: stringifyYaml(record) },
    ...request.proposed_files.map((file) => ({ path: file.path, content: file.content })),
  ];
  const event = applyNovelEvent(root, {
    eventType: "plan-change",
    expectedStage: project.current_stage,
    expectedProjectHash: request.source_project_hash,
    planChangeApproval: approval,
    files,
  });
  const applied: PlanChangeRequest = {
    ...request,
    status: "applied",
    writer_approval: approval,
    updated_at: approval.approved_at,
    applied_at: approval.approved_at,
  };
  writePlanChangeRequest(root, applied);
  return { request: applied, event, recovered: false };
}

export function rejectPlanChangeRequest(root: string, requestId: string, reason: string, now?: string): PlanChangeRequest {
  const request = readStoredPlanChangeRequest(root, requestId);
  if (!request) throw new Error(`Plan-change request ${requestId} was not found.`);
  if (request.status !== "proposed") throw new Error(`Plan-change request ${requestId} is ${request.status}, not proposed.`);
  if (!reason.trim()) throw new Error("Plan-change rejection requires a reason.");
  const updated: PlanChangeRequest = {
    ...request,
    status: "rejected",
    rejection_reason: reason.trim(),
    updated_at: timestamp(now),
  };
  writePlanChangeRequest(root, updated);
  return updated;
}

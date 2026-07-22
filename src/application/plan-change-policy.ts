import { createHash } from "node:crypto";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema, type ChapterContract } from "../domain/chapter-contract.js";
import { EntityRegistrySchema, type EntityRegistry } from "../domain/entity-registry.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../domain/knowledge-ledger.js";
import {
  ApprovedPlanChangeRecordSchema,
  type ApprovedPlanChangeRecord,
  type WriterApprovalEvidence,
} from "../domain/plan-change-request.js";
import { ChapterQueueSchema, StoryThreadsSchema, type BookState, type ChapterQueueState, type StoryThreadsState } from "../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import { isEstablishedStoryRecordStatus } from "../domain/story-record-status.js";
import { normalizeStoryThreads } from "../domain/story-thread-v2.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { readText } from "../infrastructure/files.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { parseYaml } from "../infrastructure/yaml.js";

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

function normalized(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function planChangeRecordPathPattern(bookId: string): RegExp {
  const escaped = bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^books/${escaped}/plan-changes/PC-[0-9]{3}\\.yaml$`);
}

export function isPlanChangeControlPathAllowed(path: string, bookId: string): boolean {
  const value = normalized(path);
  const book = `books/${bookId}`;
  if (planChangeRecordPathPattern(bookId).test(value)) return true;
  if (new RegExp(`^${book}/contracts/chapters/CH-[0-9]{3}\\.yaml$`).test(value)) return true;
  if ([
    `${book}/chapter-queue.yaml`,
    `${book}/plot-grid.yaml`,
    `${book}/book-strategy.yaml`,
    "series/story-threads.yaml",
    "series/series-arc.yaml",
    "series/entity-registry.yaml",
    "series/state-ledger.yaml",
    "series/knowledge-ledger.yaml",
  ].includes(value)) return true;
  return false;
}

function requireEvidence(root: string, book: BookState, record: ApprovedPlanChangeRecord): void {
  for (const evidence of record.manuscript_evidence) {
    if (evidence.chapter > book.current_chapter) throw new Error(`Plan-change evidence Chapter ${evidence.chapter} is not accepted manuscript yet.`);
    if (!evidence.manuscript_path.startsWith(`books/${book.book_id}/manuscript/chapters/`)) {
      throw new Error(`Plan-change evidence points outside the active accepted manuscript: ${evidence.manuscript_path}.`);
    }
    const text = readText(join(root, evidence.manuscript_path));
    if (text === null || hashText(text) !== evidence.manuscript_hash) throw new Error(`Plan-change evidence manuscript hash changed for ${evidence.manuscript_path}.`);
    const occurrences = text.split(evidence.quote).length - 1;
    if (occurrences === 0) throw new Error(`Plan-change evidence quote was not found in ${evidence.manuscript_path}.`);
    if (occurrences > 1) throw new Error(`Plan-change evidence quote is ambiguous in ${evidence.manuscript_path}.`);
  }
}

function fileMap(files: readonly FileChange[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const file of files) {
    const path = normalized(file.path);
    if (result.has(path)) throw new Error(`Duplicate plan-change event path: ${path}.`);
    result.set(path, file.content);
  }
  return result;
}

function validateFutureContract(path: string, content: string, book: BookState, record: ApprovedPlanChangeRecord): void {
  const contract = parseYaml<ChapterContract>(content, ChapterContractSchema, path);
  if (contract.chapter <= book.current_chapter) throw new Error(`Plan change may update only a future chapter contract; Chapter ${contract.chapter} is already drafted or current.`);
  if (!record.affected_chapters.includes(contract.chapter)) throw new Error(`Plan-change record does not declare affected Chapter ${contract.chapter}.`);
  if (!record.affected_contract_ids.includes(contract.contract_id)) throw new Error(`Plan-change record does not declare affected contract ${contract.contract_id}.`);
}

function validatePastQueue(root: string, path: string, content: string, book: BookState): void {
  const proposed = parseYaml<ChapterQueueState>(content, ChapterQueueSchema, path);
  const currentText = readText(join(root, path));
  const current = currentText ? parseYaml<ChapterQueueState>(currentText, ChapterQueueSchema, path) : { schema_version: "1.0.0" as const, active_window: "", packets: [] };
  const currentPast = current.packets.filter((item) => item.chapter <= book.current_chapter);
  const proposedPast = proposed.packets.filter((item) => item.chapter <= book.current_chapter);
  if (canonical(currentPast) !== canonical(proposedPast)) throw new Error("Plan change cannot alter already-drafted chapter queue records.");
}

function validatePastPlot(root: string, path: string, content: string, book: BookState): void {
  const proposed = parseYaml<PlotGridPhase4>(content, PlotGridPhase4Schema, path);
  const currentText = readText(join(root, path));
  if (!currentText) return;
  const current = parseYaml<PlotGridPhase4>(currentText, PlotGridPhase4Schema, path);
  const currentPast = current.chapters.filter((item) => item.chapter <= book.current_chapter);
  const proposedPast = proposed.chapters.filter((item) => item.chapter <= book.current_chapter);
  if (canonical(currentPast) !== canonical(proposedPast)) throw new Error("Plan change cannot alter already-drafted plot-grid chapters.");
  const closedActs = current.acts.filter((item) => item.end_chapter <= book.current_chapter);
  const proposedClosedActs = proposed.acts.filter((item) => item.end_chapter <= book.current_chapter);
  if (canonical(closedActs) !== canonical(proposedClosedActs)) throw new Error("Plan change cannot alter completed act records.");
}

function validateFutureRecords<T extends { status: string }>(
  label: string,
  before: readonly T[],
  after: readonly T[],
  idOf: (item: T) => string,
): void {
  const beforeById = new Map(before.map((item) => [idOf(item), item]));
  for (const item of after) {
    const prior = beforeById.get(idOf(item));
    if (!prior) {
      if (!["proposed-plan", "required-future-event", "unresolved"].includes(item.status)) {
        throw new Error(`New ${label} ${idOf(item)} must remain a future or unresolved record.`);
      }
      continue;
    }
    if (isEstablishedStoryRecordStatus(prior.status as never) && canonical(prior) !== canonical(item)) {
      throw new Error(`Plan change cannot alter established ${label} ${idOf(item)}.`);
    }
  }
  for (const prior of before) {
    if (!after.some((item) => idOf(item) === idOf(prior)) && isEstablishedStoryRecordStatus(prior.status as never)) {
      throw new Error(`Plan change cannot delete established ${label} ${idOf(prior)}.`);
    }
  }
}

function validateRegistryChanges(root: string, path: string, content: string): void {
  const currentText = readText(join(root, path));
  if (!currentText) return;
  if (path === "series/entity-registry.yaml") {
    const before = parseYaml<EntityRegistry>(currentText, EntityRegistrySchema, path);
    const after = parseYaml<EntityRegistry>(content, EntityRegistrySchema, path);
    validateFutureRecords("entity", before.entities, after.entities, (item) => item.id);
  } else if (path === "series/state-ledger.yaml") {
    const before = parseYaml<StateLedger>(currentText, StateLedgerSchema, path);
    const after = parseYaml<StateLedger>(content, StateLedgerSchema, path);
    validateFutureRecords("state record", before.records, after.records, (item) => item.id);
  } else if (path === "series/knowledge-ledger.yaml") {
    const before = parseYaml<KnowledgeLedger>(currentText, KnowledgeLedgerSchema, path);
    const after = parseYaml<KnowledgeLedger>(content, KnowledgeLedgerSchema, path);
    validateFutureRecords("knowledge record", before.records, after.records, (item) => item.id);
  }
}

function validateThreadHistory(root: string, content: string): void {
  const path = "series/story-threads.yaml";
  const currentText = readText(join(root, path));
  if (!currentText) return;
  const before = normalizeStoryThreads(parseYaml<StoryThreadsState>(currentText, StoryThreadsSchema, path));
  const after = normalizeStoryThreads(parseYaml<StoryThreadsState>(content, StoryThreadsSchema, path));
  const beforeById = new Map(before.threads.map((item) => [item.id, item]));
  for (const item of after.threads) {
    const prior = beforeById.get(item.id);
    if (!prior) {
      if (item.status !== "planned") throw new Error(`New story thread ${item.id} must remain planned until accepted prose opens it.`);
      continue;
    }
    const protectedBefore = {
      id: prior.id,
      type: prior.type,
      setup: prior.setup,
      reader_knows: prior.reader_knows,
      characters_know: prior.characters_know,
      status: prior.status,
      intended_payoff: prior.intended_payoff,
      last_advanced_in: prior.last_advanced_in,
      opened_in: prior.opened_in,
      last_touched_in: prior.last_touched_in,
    };
    const protectedAfter = {
      id: item.id,
      type: item.type,
      setup: item.setup,
      reader_knows: item.reader_knows,
      characters_know: item.characters_know,
      status: item.status,
      intended_payoff: item.intended_payoff,
      last_advanced_in: item.last_advanced_in,
      opened_in: item.opened_in,
      last_touched_in: item.last_touched_in,
    };
    if (canonical(protectedBefore) !== canonical(protectedAfter)) throw new Error(`Plan change cannot alter accepted history for story thread ${item.id}.`);
  }
}

export interface ValidatePlanChangeEventInput {
  root: string;
  files: readonly FileChange[];
  book: BookState;
  expectedProjectHash: string;
  approval?: WriterApprovalEvidence;
}

export function validatePlanChangeEvent(input: ValidatePlanChangeEventInput): ApprovedPlanChangeRecord {
  if (!input.approval) throw new Error("Plan-change event requires writer approval evidence.");
  const files = fileMap(input.files);
  for (const path of files.keys()) {
    if (!isPlanChangeControlPathAllowed(path, input.book.book_id)) throw new Error(`${path} is not allowed for plan-change.`);
    if (path.includes("/manuscript/") || path.includes("/deltas/")) throw new Error("Plan change cannot rewrite accepted manuscript or accepted chapter deltas.");
  }
  const recordEntries = [...files.entries()].filter(([path]) => planChangeRecordPathPattern(input.book.book_id).test(path));
  if (recordEntries.length !== 1) throw new Error("Plan-change event requires exactly one canonical approved plan-change record.");
  const [recordPath, recordText] = recordEntries[0]!;
  const record = parseYaml<ApprovedPlanChangeRecord>(recordText, ApprovedPlanChangeRecordSchema, recordPath);
  if (record.book_id !== input.book.book_id || recordPath !== `books/${record.book_id}/plan-changes/${record.request_id}.yaml`) {
    throw new Error("Plan-change record identity does not match its canonical path.");
  }
  if (record.source_project_hash !== input.expectedProjectHash) throw new Error("Plan-change record source project hash is stale.");
  if (canonical(record.writer_approval) !== canonical(input.approval)) throw new Error("Plan-change approval evidence does not match the canonical record.");
  requireEvidence(input.root, input.book, record);

  const declared = new Map(record.control_file_hashes.map((item) => [normalized(item.path), item.hash]));
  const actualControlPaths = [...files.keys()].filter((path) => path !== recordPath).sort();
  if (canonical([...declared.keys()].sort()) !== canonical(actualControlPaths)) throw new Error("Plan-change control file list does not match the event files.");
  for (const path of actualControlPaths) {
    const content = files.get(path)!;
    if (declared.get(path) !== hashText(content)) throw new Error(`Plan-change control file hash does not match ${path}.`);
    const contractMatch = path.match(/\/contracts\/chapters\/CH-([0-9]{3})\.yaml$/);
    if (contractMatch) validateFutureContract(path, content, input.book, record);
    else if (path.endsWith("/chapter-queue.yaml")) validatePastQueue(input.root, path, content, input.book);
    else if (path.endsWith("/plot-grid.yaml")) validatePastPlot(input.root, path, content, input.book);
    else if (path === "series/story-threads.yaml") validateThreadHistory(input.root, content);
    else if (["series/entity-registry.yaml", "series/state-ledger.yaml", "series/knowledge-ledger.yaml"].includes(path)) validateRegistryChanges(input.root, path, content);
  }
  for (const chapter of record.affected_chapters) {
    if (chapter <= input.book.current_chapter) throw new Error(`Plan change may affect only future chapters; Chapter ${chapter} is already drafted or current.`);
  }
  if (!Value.Check(ApprovedPlanChangeRecordSchema, record)) throw new Error("Approved plan-change record failed schema validation.");
  return record;
}

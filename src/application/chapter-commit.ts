import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import type { ChapterStitchArtifact } from "../domain/chapter-stitch-artifact.js";
import type { ChapterValidationArtifact } from "../domain/chapter-validation-artifact.js";
import type { ChapterCommitArtifact } from "../domain/chapter-commit-artifact.js";
import { ChapterCommitArtifactSchema } from "../domain/chapter-commit-artifact.js";
import { ChapterQueueSchema, type ChapterQueueState } from "../domain/schemas.js";
import type { SceneStateDeltaMutation } from "../domain/scene-state-delta-artifact.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import { readText } from "../infrastructure/files.js";
import { Value } from "@sinclair/typebox/value";
import { readChapterCommitArtifact, writeChapterCommitArtifact } from "../infrastructure/chapter-commit-artifact-store.js";
import { readChapterExecutionState, writeChapterExecutionState } from "../infrastructure/chapter-execution-store.js";
import { readChapterStitchArtifact } from "../infrastructure/chapter-stitch-artifact-store.js";
import { readChapterValidationArtifact } from "../infrastructure/chapter-validation-artifact-store.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { transitionChapterExecution } from "./chapter-execution-machine.js";
import { applyNovelEvent } from "./events.js";
import { projectStateHash } from "./project-hash.js";
import { rebuildStoryRecordIndex, readStoryRecordIndex } from "./rebuild-story-index.js";

const STATE_LEDGER_PATH = "series/state-ledger.yaml";

export interface CommitValidatedChapterInput {
  root: string;
  runId: string;
  chapter: number;
  now?: string;
  onEventApplied?: () => void;
}

export interface CommitValidatedChapterResult {
  artifact: ChapterCommitArtifact;
  artifactPath: string;
  state: ChapterExecutionState;
  recovered: boolean;
}

interface PreparedCommit {
  artifact: ChapterCommitArtifact;
  stitch: ChapterStitchArtifact;
  validation: ChapterValidationArtifact;
  manuscriptContent: string;
  stateLedgerContent: string | null;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function artifactHash(value: unknown): string {
  return hashText(JSON.stringify(value));
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function addValue(current: unknown, value: unknown, recordId: string): unknown {
  if (Array.isArray(current)) {
    const additions = Array.isArray(value) ? value : [value];
    const result = [...current];
    const keys = new Set(result.map(canonical));
    for (const item of additions) {
      const key = canonical(item);
      if (!keys.has(key)) {
        result.push(cloneValue(item));
        keys.add(key);
      }
    }
    return result;
  }
  if (typeof current === "number" && typeof value === "number") return current + value;
  throw new Error(`State mutation add requires an array or numeric state value for ${recordId}.`);
}

function removeValue(current: unknown, value: unknown, recordId: string): unknown {
  if (!Array.isArray(current)) throw new Error(`State mutation remove requires an array state value for ${recordId}.`);
  const removals = new Set((Array.isArray(value) ? value : [value]).map(canonical));
  return current.filter((item) => !removals.has(canonical(item)));
}

export function applyAcceptedStateMutations(
  ledger: StateLedger,
  mutations: readonly SceneStateDeltaMutation[],
  context: { runId: string; bookId: string; chapter: number },
): StateLedger {
  const result = structuredClone(ledger);
  const byId = new Map(result.records.map((record) => [record.id, record]));
  const chapterRef = `${context.bookId}/chapter-${String(context.chapter).padStart(3, "0")}`;
  mutations.forEach((mutation, index) => {
    const record = byId.get(mutation.record_id);
    if (!record) throw new Error(`Accepted chapter mutation references unknown state record ${mutation.record_id}.`);
    if (record.field !== mutation.field) {
      throw new Error(`Accepted chapter mutation field ${mutation.field} does not match state record ${record.id}.${record.field}.`);
    }
    if (mutation.operation === "set") record.value = cloneValue(mutation.value);
    else if (mutation.operation === "add") record.value = addValue(record.value, mutation.value, record.id);
    else record.value = removeValue(record.value, mutation.value, record.id);
    record.status = "current-state";
    record.updated_in = chapterRef;
    const evidenceId = `${context.runId}:chapter-${String(context.chapter).padStart(3, "0")}:mutation-${String(index + 1).padStart(2, "0")}`;
    if (!record.evidence_ids.includes(evidenceId)) record.evidence_ids.push(evidenceId);
  });
  if (!Value.Check(StateLedgerSchema, result)) throw new Error("Accepted state mutations produced an invalid state ledger.");
  return result;
}

function slug(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "chapter";
}

function requireExecution(root: string, runId: string, chapter: number): ChapterExecutionState {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter commit requires a positive chapter number.");
  const state = readChapterExecutionState(root, runId);
  if (!state) throw new Error(`Chapter execution state not found for ${runId}.`);
  if (state.chapter !== chapter) throw new Error(`Execution chapter ${state.chapter} does not match requested chapter ${chapter}.`);
  return state;
}

function requireStitch(root: string, runId: string, chapter: number, state: ChapterExecutionState): ChapterStitchArtifact {
  const stitch = readChapterStitchArtifact(root, runId, chapter);
  if (!stitch) throw new Error(`Stitched chapter artifact not found for chapter ${chapter}.`);
  if (stitch.run_id !== runId
    || stitch.chapter !== chapter
    || stitch.contract_hash !== state.contract_hash
    || stitch.story_index_hash !== state.canon_snapshot_hash
    || stitch.next_node !== "chapter-validate"
    || hashText(stitch.chapter_text) !== stitch.output_hash) {
    throw new Error("Chapter commit stitch provenance does not match the execution checkpoint.");
  }
  return stitch;
}

function requireValidation(root: string, runId: string, chapter: number, stitch: ChapterStitchArtifact): ChapterValidationArtifact {
  const validation = readChapterValidationArtifact(root, runId, chapter);
  if (!validation
    || !validation.passed
    || validation.next_action !== "chapter-commit"
    || validation.stitch_artifact_hash !== artifactHash(stitch)
    || validation.stitch_output_hash !== stitch.output_hash
    || validation.contract_hash !== stitch.contract_hash
    || validation.story_index_hash !== stitch.story_index_hash) {
    throw new Error("Chapter commit requires a passed chapter validation artifact for the same stitch.");
  }
  return validation;
}

function manuscriptPath(root: string, chapter: number): string {
  const book = readBook(root);
  const queueText = readText(join(root, "books", book.book_id, "chapter-queue.yaml"));
  if (queueText === null) throw new Error("Chapter commit requires the active chapter queue.");
  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, `books/${book.book_id}/chapter-queue.yaml`);
  const packet = queue.packets.find((item) => item.chapter === chapter);
  if (!packet) throw new Error(`Chapter ${chapter} packet not found for canonical commit.`);
  return `books/${book.book_id}/manuscript/chapters/${String(chapter).padStart(2, "0")}-${slug(packet.title)}.md`;
}

function buildPreparation(input: CommitValidatedChapterInput, state: ChapterExecutionState): PreparedCommit {
  if (state.status !== "active" || state.current_node !== "chapter-commit") {
    throw new Error(`Chapter commit requires active chapter-commit, current state is ${state.status}/${state.current_node}.`);
  }
  const before = projectStateHash(input.root);
  if (state.project_hash !== before) throw new Error("Cannot commit chapter because the project hash changed.");
  const stitch = requireStitch(input.root, input.runId, input.chapter, state);
  const validation = requireValidation(input.root, input.runId, input.chapter, stitch);
  const book = readBook(input.root);
  const path = manuscriptPath(input.root, input.chapter);
  if (existsSync(join(input.root, path))) throw new Error(`Canonical manuscript chapter already exists at ${path}.`);

  let stateLedgerContent: string | null = null;
  let stateLedgerHash: string | null = null;
  if (stitch.accepted_mutations.length) {
    const ledgerText = readText(join(input.root, STATE_LEDGER_PATH));
    if (ledgerText === null) throw new Error("Chapter commit mutations require series/state-ledger.yaml.");
    const ledger = parseYaml<StateLedger>(ledgerText, StateLedgerSchema, STATE_LEDGER_PATH);
    const updated = applyAcceptedStateMutations(ledger, stitch.accepted_mutations, {
      runId: input.runId,
      bookId: book.book_id,
      chapter: input.chapter,
    });
    stateLedgerContent = stringifyYaml(updated);
    stateLedgerHash = hashText(stateLedgerContent);
  }
  const preparedAt = timestamp(input.now);
  const artifact: ChapterCommitArtifact = {
    schema_version: "1.0.0",
    run_id: input.runId,
    chapter: input.chapter,
    status: "prepared",
    project_hash_before: before,
    project_hash_after: null,
    story_index_hash_before: stitch.story_index_hash,
    story_index_hash_after: null,
    contract_hash: stitch.contract_hash,
    stitch_artifact_hash: artifactHash(stitch),
    validation_artifact_hash: artifactHash(validation),
    stitch_output_hash: stitch.output_hash,
    manuscript_path: path,
    manuscript_hash: hashText(stitch.chapter_text),
    state_ledger_path: stateLedgerContent === null ? null : STATE_LEDGER_PATH,
    state_ledger_hash: stateLedgerHash,
    applied_mutations: stitch.accepted_mutations,
    changed_paths: [],
    git_message: null,
    prepared_at: preparedAt,
    committed_at: null,
  };
  if (!Value.Check(ChapterCommitArtifactSchema, artifact)) throw new Error("Prepared chapter commit artifact failed schema validation.");
  return { artifact, stitch, validation, manuscriptContent: stitch.chapter_text, stateLedgerContent };
}

function actualHash(root: string, path: string): string | null {
  const text = readText(join(root, path));
  return text === null ? null : hashText(text);
}

function canonicalFilesMatch(root: string, artifact: ChapterCommitArtifact): boolean {
  if (actualHash(root, artifact.manuscript_path) !== artifact.manuscript_hash) return false;
  if (artifact.state_ledger_path === null) return true;
  return actualHash(root, artifact.state_ledger_path) === artifact.state_ledger_hash;
}

function finishCommit(
  input: CommitValidatedChapterInput,
  prepared: ChapterCommitArtifact,
  state: ChapterExecutionState,
  event: { changed: string[]; gitMessage: string | null } | null,
  recovered: boolean,
): CommitValidatedChapterResult {
  if (!canonicalFilesMatch(input.root, prepared)) throw new Error("Canonical chapter commit files do not match the prepared journal.");
  rebuildStoryRecordIndex(input.root);
  const index = readStoryRecordIndex(input.root);
  const currentHash = projectStateHash(input.root);
  let completed = state;
  if (completed.current_node !== "complete" || completed.status !== "completed") {
    if (completed.status !== "active" || completed.current_node !== "chapter-commit") {
      throw new Error(`Cannot finalize chapter commit from ${completed.status}/${completed.current_node}.`);
    }
    completed = transitionChapterExecution(completed, "complete", input.now, completed.current_scene_id ?? undefined);
  }
  completed = {
    ...completed,
    project_hash: currentHash,
    canon_snapshot_hash: index.manifest.index_hash,
    updated_at: timestamp(input.now),
  };
  writeChapterExecutionState(input.root, completed);
  const changed = event?.changed ?? [prepared.manuscript_path, ...(prepared.state_ledger_path ? [prepared.state_ledger_path] : [])];
  const committed: ChapterCommitArtifact = {
    ...prepared,
    status: "committed",
    project_hash_after: currentHash,
    story_index_hash_after: index.manifest.index_hash,
    changed_paths: [...new Set(changed)],
    git_message: event?.gitMessage ?? prepared.git_message,
    committed_at: timestamp(input.now),
  };
  if (!Value.Check(ChapterCommitArtifactSchema, committed)) throw new Error("Committed chapter artifact failed schema validation.");
  const artifactPath = writeChapterCommitArtifact(input.root, committed);
  return { artifact: committed, artifactPath, state: completed, recovered };
}

export function commitValidatedChapter(input: CommitValidatedChapterInput): CommitValidatedChapterResult {
  const state = requireExecution(input.root, input.runId, input.chapter);
  const existing = readChapterCommitArtifact(input.root, input.runId, input.chapter);
  if (existing?.status === "committed") {
    return finishCommit(input, existing, state, null, true);
  }
  if (existing?.status === "prepared" && canonicalFilesMatch(input.root, existing)) {
    const book = readBook(input.root);
    if (projectStateHash(input.root) === existing.project_hash_before || book.current_chapter < input.chapter) {
      throw new Error("Prepared chapter files exist without a completed canonical draft event.");
    }
    return finishCommit(input, existing, state, null, true);
  }

  const prepared = buildPreparation(input, state);
  if (existing) {
    if (existing.project_hash_before !== prepared.artifact.project_hash_before
      || existing.manuscript_hash !== prepared.artifact.manuscript_hash
      || existing.state_ledger_hash !== prepared.artifact.state_ledger_hash) {
      throw new Error("Existing prepared chapter commit no longer matches the active run artifacts.");
    }
  } else {
    writeChapterCommitArtifact(input.root, prepared.artifact);
  }
  const project = readProject(input.root);
  const files = [{ path: prepared.artifact.manuscript_path, content: prepared.manuscriptContent }];
  if (prepared.stateLedgerContent !== null) files.push({ path: STATE_LEDGER_PATH, content: prepared.stateLedgerContent });
  const event = applyNovelEvent(input.root, {
    eventType: "draft-chapter",
    expectedStage: project.current_stage,
    expectedProjectHash: prepared.artifact.project_hash_before,
    chapter: input.chapter,
    files,
  });
  input.onEventApplied?.();
  return finishCommit(input, prepared.artifact, state, { changed: event.changed, gitMessage: event.gitMessage }, false);
}

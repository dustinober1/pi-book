import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import type { TSchema } from "@sinclair/typebox";
import { assertValidEntityRegistry } from "./entity-registry.js";
import { assertValidKnowledgeLedger } from "./knowledge-ledger.js";
import { assertValidStateLedger } from "./state-ledger.js";
import {
  renderStoryRecordIndex,
  type StoryRecordIndex,
  type StoryRecordIndexManifest,
  type StoryRecordIndexRecord,
  type StoryRecordKind,
} from "../context/story-record-index.js";
import { ChapterContractSchema, type ChapterContract } from "../domain/chapter-contract.js";
import { ChapterDeltaSummarySchema, type ChapterDeltaSummary } from "../domain/chapter-delta-summary.js";
import { EntityRegistrySchema, type EntityRegistry } from "../domain/entity-registry.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../domain/knowledge-ledger.js";
import { CanonSchema, StoryThreadsSchema, type CanonState, type StoryThread, type StoryThreadsState } from "../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import type { StoryRecordStatus } from "../domain/story-record-status.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { ResearchLedgerSchema, type ResearchLedger } from "../domain/v1-3-schemas.js";
import { listFilesRecursive, readText } from "../infrastructure/files.js";
import {
  readStoredStoryRecordIndex,
  storyRecordIndexPaths,
  writeStoryRecordIndex,
} from "../infrastructure/story-record-index-store.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook } from "../project/store.js";

interface LoadedSource<T> {
  path: string;
  text: string;
  hash: string;
  value: T;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function loadYaml<T>(root: string, path: string, schema: TSchema): LoadedSource<T> | null {
  const text = readText(join(root, path));
  if (text === null) return null;
  return { path, text, hash: hashText(text), value: parseYaml<T>(text, schema, path) };
}

function loadTextSource(root: string, path: string): LoadedSource<string> | null {
  const text = readText(join(root, path));
  if (text === null) return null;
  return { path, text, hash: hashText(text), value: text };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function chapterScope(values: readonly number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
}

function record(input: {
  id: string;
  kind: StoryRecordKind;
  status: StoryRecordStatus;
  source: LoadedSource<unknown>;
  version?: number;
  dependencies?: readonly string[];
  chapters?: readonly number[];
  payload: unknown;
}): StoryRecordIndexRecord {
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    source_path: input.source.path,
    source_hash: input.source.hash,
    version: input.version ?? 1,
    dependencies: uniqueSorted(input.dependencies ?? []),
    chapter_scope: chapterScope(input.chapters ?? []),
    payload: input.payload,
  };
}

function threadStatus(thread: StoryThread): StoryRecordStatus {
  if (thread.status === "planned") return "proposed-plan";
  if (thread.status === "paid-off") return "accepted-manuscript-fact";
  if (thread.status === "abandoned") return "deprecated";
  return "current-state";
}

function researchStatus(status: ResearchLedger["items"][number]["status"]): StoryRecordStatus {
  if (status === "ready") return "locked-canon";
  if (status === "planned") return "proposed-plan";
  if (status === "rejected") return "deprecated";
  return "unresolved";
}

function loadedAsUnknown<T>(source: LoadedSource<T>): LoadedSource<unknown> {
  return source;
}

function deltaMaterialChanges(summary: ChapterDeltaSummary) {
  return [
    ...summary.world_state_changes,
    ...summary.character_state_changes,
    ...summary.knowledge_changes,
    ...summary.relationship_changes,
    ...summary.object_transfers_or_destruction,
    ...summary.timeline_movement,
  ];
}

function deltaReferences(summary: ChapterDeltaSummary) {
  return [
    ...summary.threads.opened,
    ...summary.threads.advanced,
    ...summary.threads.resolved,
    ...summary.promises_to_reader,
    ...summary.research_claims_introduced,
    ...summary.unresolved_ambiguities,
  ];
}

function deltaDependencies(summary: ChapterDeltaSummary): string[] {
  return uniqueSorted([
    ...deltaMaterialChanges(summary).flatMap((change) => [change.record_id, change.subject_id]),
    ...summary.threads.opened.map((item) => item.id),
    ...summary.threads.advanced.map((item) => item.id),
    ...summary.threads.resolved.map((item) => item.id),
    ...summary.research_claims_introduced.map((item) => item.id),
  ]);
}

function manuscriptParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function validateDeltaManuscript(summary: ChapterDeltaSummary, manuscript: LoadedSource<string>): void {
  if (manuscript.hash !== summary.manuscript_hash) {
    throw new Error(`Chapter delta ${summary.chapter_ref} manuscript hash does not match ${summary.manuscript_path}.`);
  }
  const paragraphs = manuscriptParagraphs(manuscript.text);
  const anchors = new Map<string, ChapterDeltaSummary["manuscript_evidence_anchors"][number]>();
  for (const anchor of summary.manuscript_evidence_anchors) {
    if (anchors.has(anchor.id)) throw new Error(`Chapter delta ${summary.chapter_ref} repeats evidence anchor ${anchor.id}.`);
    const paragraph = paragraphs[anchor.paragraph - 1];
    if (paragraph === undefined) throw new Error(`Chapter delta ${summary.chapter_ref} evidence anchor ${anchor.id} references a missing paragraph.`);
    if (hashText(paragraph) !== anchor.paragraph_hash) throw new Error(`Chapter delta ${summary.chapter_ref} evidence anchor ${anchor.id} paragraph hash does not match.`);
    if (!paragraph.includes(anchor.quote)) throw new Error(`Chapter delta ${summary.chapter_ref} evidence anchor ${anchor.id} quote is absent from its paragraph.`);
    anchors.set(anchor.id, anchor);
  }
  const evidenceIds = [
    ...deltaMaterialChanges(summary).flatMap((change) => change.evidence_anchor_ids),
    ...deltaReferences(summary).flatMap((item) => item.evidence_anchor_ids),
  ];
  for (const evidenceId of evidenceIds) {
    if (!anchors.has(evidenceId)) throw new Error(`Chapter delta ${summary.chapter_ref} references unknown evidence anchor ${evidenceId}.`);
  }
}

function collectRecords(root: string): { records: StoryRecordIndexRecord[]; sources: Array<{ path: string; hash: string }> } {
  const book = readBook(root);
  const base = `books/${book.book_id}`;
  const records: StoryRecordIndexRecord[] = [];
  const loadedSources: Array<LoadedSource<unknown>> = [];
  const addSource = <T>(source: LoadedSource<T> | null): LoadedSource<T> | null => {
    if (source) loadedSources.push(loadedAsUnknown(source));
    return source;
  };

  const entities = addSource(loadYaml<EntityRegistry>(root, "series/entity-registry.yaml", EntityRegistrySchema));
  if (entities) {
    assertValidEntityRegistry(entities.value);
    for (const entity of entities.value.entities) {
      records.push(record({ id: entity.id, kind: "entity", status: entity.status, source: loadedAsUnknown(entities), payload: entity }));
    }
  }

  const states = addSource(loadYaml<StateLedger>(root, "series/state-ledger.yaml", StateLedgerSchema));
  if (states) {
    assertValidStateLedger(states.value);
    for (const state of states.value.records) {
      records.push(record({
        id: state.id,
        kind: "state",
        status: state.status,
        source: loadedAsUnknown(states),
        dependencies: [state.subject_id, ...state.evidence_ids],
        payload: state,
      }));
    }
  }

  const knowledge = addSource(loadYaml<KnowledgeLedger>(root, "series/knowledge-ledger.yaml", KnowledgeLedgerSchema));
  if (knowledge) {
    assertValidKnowledgeLedger(knowledge.value);
    for (const item of knowledge.value.records) {
      records.push(record({
        id: item.id,
        kind: "knowledge",
        status: item.status,
        source: loadedAsUnknown(knowledge),
        dependencies: [item.knower_id, item.fact_id, ...item.evidence_ids],
        payload: item,
      }));
    }
  }

  const canon = addSource(loadYaml<CanonState>(root, "series/canon.yaml", CanonSchema));
  if (canon) {
    for (const fact of canon.value.facts) {
      records.push(record({
        id: fact.id,
        kind: "canon-fact",
        status: fact.status === "locked" ? "locked-canon" : "unresolved",
        source: loadedAsUnknown(canon),
        payload: fact,
      }));
    }
    for (const relationship of canon.value.relationships) {
      records.push(record({
        id: relationship.id,
        kind: "relationship",
        status: relationship.status === "locked" ? "locked-canon" : "unresolved",
        source: loadedAsUnknown(canon),
        dependencies: relationship.characters,
        payload: relationship,
      }));
    }
  }

  const threads = addSource(loadYaml<StoryThreadsState>(root, "series/story-threads.yaml", StoryThreadsSchema));
  if (threads) {
    for (const thread of threads.value.threads) {
      records.push(record({
        id: thread.id,
        kind: "story-thread",
        status: threadStatus(thread),
        source: loadedAsUnknown(threads),
        dependencies: Object.keys(thread.characters_know),
        payload: thread,
      }));
    }
  }

  const research = addSource(loadYaml<ResearchLedger>(root, `${base}/research-ledger.yaml`, ResearchLedgerSchema));
  if (research) {
    for (const item of research.value.items) {
      records.push(record({
        id: item.id,
        kind: "research",
        status: researchStatus(item.status),
        source: loadedAsUnknown(research),
        dependencies: item.source_ids,
        chapters: item.story_use.chapters,
        payload: item,
      }));
    }
  }

  const plot = addSource(loadYaml<PlotGridPhase4>(root, `${base}/plot-grid.yaml`, PlotGridPhase4Schema));
  if (plot) {
    for (const chapter of plot.value.chapters) {
      records.push(record({
        id: `PLOT-CH-${String(chapter.chapter).padStart(3, "0")}`,
        kind: "plot-chapter",
        status: "required-future-event",
        source: loadedAsUnknown(plot),
        dependencies: [...chapter.setup_ids, ...chapter.payoff_ids],
        chapters: [chapter.chapter],
        payload: chapter,
      }));
    }
  }

  const contractRoot = join(root, base, "contracts", "chapters");
  const contractPaths = listFilesRecursive(contractRoot, (path) => /\.ya?ml$/i.test(path))
    .map((path) => normalizedRelative(root, path))
    .sort();
  for (const path of contractPaths) {
    const contract = addSource(loadYaml<ChapterContract>(root, path, ChapterContractSchema));
    if (!contract) continue;
    records.push(record({
      id: contract.value.contract_id,
      kind: "chapter-contract",
      status: "required-future-event",
      source: loadedAsUnknown(contract),
      version: contract.value.version,
      dependencies: contract.value.required_record_ids,
      chapters: [contract.value.chapter],
      payload: contract.value,
    }));
  }

  const deltaRoot = join(root, base, "deltas");
  const deltaPaths = listFilesRecursive(deltaRoot, (path) => /\.ya?ml$/i.test(path))
    .map((path) => normalizedRelative(root, path))
    .sort();
  for (const path of deltaPaths) {
    const delta = addSource(loadYaml<ChapterDeltaSummary>(root, path, ChapterDeltaSummarySchema));
    if (!delta) continue;
    const expectedPath = `${base}/deltas/CH-${String(delta.value.chapter).padStart(3, "0")}.yaml`;
    if (path !== expectedPath || delta.value.chapter_ref !== `${book.book_id}/chapter-${String(delta.value.chapter).padStart(3, "0")}`) {
      throw new Error(`Chapter delta identity does not match its canonical path: ${path}.`);
    }
    if (!delta.value.manuscript_path.startsWith(`${base}/manuscript/chapters/`)) {
      throw new Error(`Chapter delta ${delta.value.chapter_ref} points outside the active book manuscript.`);
    }
    const manuscript = addSource(loadTextSource(root, delta.value.manuscript_path));
    if (!manuscript) throw new Error(`Chapter delta ${delta.value.chapter_ref} manuscript is missing at ${delta.value.manuscript_path}.`);
    validateDeltaManuscript(delta.value, manuscript);
    records.push(record({
      id: `DELTA-CH-${String(delta.value.chapter).padStart(3, "0")}`,
      kind: "chapter-delta",
      status: "accepted-manuscript-fact",
      source: loadedAsUnknown(delta),
      dependencies: deltaDependencies(delta.value),
      chapters: [delta.value.chapter],
      payload: delta.value,
    }));
  }

  return {
    records,
    sources: loadedSources.map((source) => ({ path: source.path, hash: source.hash })).sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export interface RebuildStoryRecordIndexResult {
  indexPath: string;
  manifestPath: string;
  recordCount: number;
  indexHash: string;
}

export function rebuildStoryRecordIndex(root: string): RebuildStoryRecordIndexResult {
  const collected = collectRecords(root);
  const indexText = renderStoryRecordIndex(collected.records);
  const indexHash = hashText(indexText);
  const manifest: StoryRecordIndexManifest = {
    schema_version: "1.0.0",
    sources: collected.sources,
    record_count: collected.records.length,
    index_hash: indexHash,
  };
  const paths = writeStoryRecordIndex(root, indexText, manifest);
  return { indexPath: paths.indexPath, manifestPath: paths.manifestPath, recordCount: collected.records.length, indexHash };
}

export function readStoryRecordIndex(root: string): StoryRecordIndex {
  const stored = readStoredStoryRecordIndex(root);
  if (!stored) throw new Error("Story record index has not been built.");
  if (hashText(stored.indexText) !== stored.manifest.index_hash || stored.records.length !== stored.manifest.record_count) {
    throw new Error("Stored story record index is corrupt.");
  }
  for (const source of stored.manifest.sources) {
    const current = readText(join(root, source.path));
    if (current === null || hashText(current) !== source.hash) throw new Error(`Story record index is stale because ${source.path} changed.`);
  }
  return { manifest: stored.manifest, records: stored.records };
}

export function currentStoryRecordIndexPaths(root: string): ReturnType<typeof storyRecordIndexPaths> {
  return storyRecordIndexPaths(root);
}

import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import {
  ChapterDeltaSummarySchema,
  type ChapterDeltaSummary,
  type ChapterMaterialStateChange,
  type ManuscriptEvidenceAnchor,
} from "../domain/chapter-delta-summary.js";
import type { EntityCategory, EntityRegistry } from "../domain/entity-registry.js";
import type { SceneStateDeltaMutation } from "../domain/scene-state-delta-artifact.js";
import type { StateLedger, StateRecord } from "../domain/state-ledger.js";
import { stringifyYaml } from "../infrastructure/yaml.js";

export interface BuildChapterDeltaSummaryInput {
  runId: string;
  bookId: string;
  chapter: number;
  contractHash: string;
  manuscriptPath: string;
  manuscriptText: string;
  beforeStateLedger: StateLedger;
  afterStateLedger: StateLedger;
  entityRegistry: EntityRegistry;
  mutations: readonly SceneStateDeltaMutation[];
  createdAt?: string;
}

interface ParagraphRecord {
  paragraph: number;
  text: string;
  hash: string;
}

interface GroupedMutation {
  record: StateRecord;
  afterRecord: StateRecord;
  category: EntityCategory;
  operations: SceneStateDeltaMutation["operation"][];
  evidenceAnchorIds: string[];
}

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

function paragraphs(text: string): ParagraphRecord[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => ({ paragraph: index + 1, text: item, hash: hashText(item) }));
}

function requireRecord(records: ReadonlyMap<string, StateRecord>, recordId: string, label: string): StateRecord {
  const record = records.get(recordId);
  if (!record) throw new Error(`Chapter delta summary ${label} state ledger is missing ${recordId}.`);
  return record;
}

function requireEvidenceParagraph(records: readonly ParagraphRecord[], quote: string): ParagraphRecord {
  const matches = records.filter((item) => item.text.includes(quote));
  if (matches.length === 0) throw new Error(`Chapter delta summary evidence quote was not found in the manuscript: ${quote}`);
  if (matches.length > 1) throw new Error(`Chapter delta summary evidence quote appears in more than one paragraph: ${quote}`);
  return matches[0]!;
}

function materialChange(group: GroupedMutation): ChapterMaterialStateChange {
  return {
    record_id: group.record.id,
    subject_id: group.record.subject_id,
    subject_category: group.category,
    field: group.record.field,
    operations: [...group.operations],
    before: structuredClone(group.record.value),
    after: structuredClone(group.afterRecord.value),
    evidence_anchor_ids: [...new Set(group.evidenceAnchorIds)],
  };
}

function isTimelineChange(category: EntityCategory, field: string): boolean {
  return category === "event" || /(?:^|[_-])(time|date|timeline|chronology|day|hour)(?:$|[_-])/i.test(field);
}

export function buildChapterDeltaSummary(input: BuildChapterDeltaSummaryInput): ChapterDeltaSummary {
  if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Chapter delta summary requires a positive chapter number.");
  const paragraphRecords = paragraphs(input.manuscriptText);
  const beforeById = new Map(input.beforeStateLedger.records.map((record) => [record.id, record]));
  const afterById = new Map(input.afterStateLedger.records.map((record) => [record.id, record]));
  const entityById = new Map(input.entityRegistry.entities.map((entity) => [entity.id, entity]));
  const anchors: ManuscriptEvidenceAnchor[] = [];
  const groups = new Map<string, GroupedMutation>();

  input.mutations.forEach((mutation, index) => {
    const paragraph = requireEvidenceParagraph(paragraphRecords, mutation.evidence_quote);
    const anchor: ManuscriptEvidenceAnchor = {
      id: `CH-${String(input.chapter).padStart(3, "0")}-EV-${String(index + 1).padStart(3, "0")}`,
      paragraph: paragraph.paragraph,
      paragraph_hash: paragraph.hash,
      quote: mutation.evidence_quote,
    };
    anchors.push(anchor);

    const beforeRecord = requireRecord(beforeById, mutation.record_id, "before");
    const afterRecord = requireRecord(afterById, mutation.record_id, "after");
    if (beforeRecord.field !== mutation.field || afterRecord.field !== mutation.field) {
      throw new Error(`Chapter delta summary mutation field ${mutation.field} does not match ${mutation.record_id}.`);
    }
    const entity = entityById.get(beforeRecord.subject_id);
    if (!entity) throw new Error(`Chapter delta summary cannot classify unknown subject ${beforeRecord.subject_id}.`);
    const key = `${mutation.record_id}\u0000${mutation.field}`;
    const existing = groups.get(key);
    if (existing) {
      existing.operations.push(mutation.operation);
      existing.evidenceAnchorIds.push(anchor.id);
    } else {
      groups.set(key, {
        record: beforeRecord,
        afterRecord,
        category: entity.category,
        operations: [mutation.operation],
        evidenceAnchorIds: [anchor.id],
      });
    }
  });

  const worldStateChanges: ChapterMaterialStateChange[] = [];
  const characterStateChanges: ChapterMaterialStateChange[] = [];
  const relationshipChanges: ChapterMaterialStateChange[] = [];
  const objectTransfersOrDestruction: ChapterMaterialStateChange[] = [];
  const timelineMovement: ChapterMaterialStateChange[] = [];

  for (const group of groups.values()) {
    if (canonical(group.record.value) === canonical(group.afterRecord.value)) continue;
    const change = materialChange(group);
    if (group.category === "character") characterStateChanges.push(change);
    else if (group.category === "relationship") relationshipChanges.push(change);
    else if (group.category === "object") objectTransfersOrDestruction.push(change);
    else if (isTimelineChange(group.category, group.record.field)) timelineMovement.push(change);
    else worldStateChanges.push(change);
  }

  const summary: ChapterDeltaSummary = {
    schema_version: "1.0.0",
    chapter: input.chapter,
    chapter_ref: `${input.bookId}/chapter-${String(input.chapter).padStart(3, "0")}`,
    source_run_id: input.runId,
    contract_hash: input.contractHash,
    manuscript_path: input.manuscriptPath,
    manuscript_hash: hashText(input.manuscriptText),
    world_state_changes: worldStateChanges,
    character_state_changes: characterStateChanges,
    knowledge_changes: [],
    relationship_changes: relationshipStateChanges,
    object_transfers_or_destruction: objectTransfersOrDestruction,
    timeline_movement: timelineMovement,
    threads: { opened: [], advanced: [], resolved: [] },
    promises_to_reader: [],
    research_claims_introduced: [],
    unresolved_ambiguities: [],
    manuscript_evidence_anchors: anchors,
    created_at: input.createdAt ?? new Date().toISOString(),
  };
  if (!Value.Check(ChapterDeltaSummarySchema, summary)) throw new Error("Chapter delta summary failed schema validation.");
  return summary;
}

export function renderChapterDeltaSummary(summary: ChapterDeltaSummary): string {
  if (!Value.Check(ChapterDeltaSummarySchema, summary)) throw new Error("Cannot render an invalid chapter delta summary.");
  return stringifyYaml(summary);
}

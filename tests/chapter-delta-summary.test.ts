import test from "node:test";
import assert from "node:assert/strict";
import { buildChapterDeltaSummary, renderChapterDeltaSummary } from "../src/application/chapter-delta-summary.js";
import { ChapterDeltaSummarySchema } from "../src/domain/chapter-delta-summary.js";
import type { EntityRegistry } from "../src/domain/entity-registry.js";
import type { SceneStateDeltaMutation } from "../src/domain/scene-state-delta-artifact.js";
import type { StateLedger } from "../src/domain/state-ledger.js";
import { parseYaml } from "../src/infrastructure/yaml.js";

const registry: EntityRegistry = {
  schema_version: "1.0.0",
  entities: [
    { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
    { id: "OBJ-BRASS-KEY", category: "object", display_name: "Brass key", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
    { id: "LOC-ARCHIVE", category: "location", display_name: "Archive", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
  ],
};

const before: StateLedger = {
  schema_version: "1.0.0",
  records: [
    { id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: [] },
    { id: "STATE-KEY-HOLDER", subject_id: "OBJ-BRASS-KEY", field: "holder", value: "CHAR-DAVEN", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: [] },
    { id: "STATE-ARCHIVE-ALARM", subject_id: "LOC-ARCHIVE", field: "alarm_active", value: false, status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: [] },
  ],
};

const after: StateLedger = {
  schema_version: "1.0.0",
  records: [
    { ...before.records[0]!, value: "LOC-TERMINAL", updated_in: "book-01/chapter-001" },
    { ...before.records[1]!, value: "CHAR-MARA", updated_in: "book-01/chapter-001" },
    { ...before.records[2]!, value: true, updated_in: "book-01/chapter-001" },
  ],
};

const mutations: SceneStateDeltaMutation[] = [
  { record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: "Mara reached the terminal" },
  { record_id: "STATE-KEY-HOLDER", field: "holder", operation: "set", value: "CHAR-MARA", evidence_quote: "She took the brass key from Daven" },
  { record_id: "STATE-ARCHIVE-ALARM", field: "alarm_active", operation: "set", value: true, evidence_quote: "The archive alarm rang" },
];

const manuscript = "Mara reached the terminal.\n\nShe took the brass key from Daven. The archive alarm rang.";

function build() {
  return buildChapterDeltaSummary({
    runId: "RUN-DELTA-001",
    bookId: "book-01",
    chapter: 1,
    contractHash: "a".repeat(64),
    manuscriptPath: "books/book-01/manuscript/chapters/01-opening.md",
    manuscriptText: manuscript,
    beforeStateLedger: before,
    afterStateLedger: after,
    entityRegistry: registry,
    mutations,
    createdAt: "2026-07-22T12:00:00.000Z",
  });
}

test("chapter delta summaries classify material state changes and anchor every change in manuscript evidence", () => {
  const summary = build();
  assert.equal(summary.schema_version, "1.0.0");
  assert.equal(summary.chapter_ref, "book-01/chapter-001");
  assert.equal(summary.manuscript_hash.length, 64);

  assert.equal(summary.character_state_changes.length, 1);
  assert.equal(summary.character_state_changes[0]?.record_id, "STATE-MARA-LOCATION");
  assert.equal(summary.character_state_changes[0]?.before, "LOC-CORRIDOR");
  assert.equal(summary.character_state_changes[0]?.after, "LOC-TERMINAL");

  assert.equal(summary.object_transfers_or_destruction.length, 1);
  assert.equal(summary.object_transfers_or_destruction[0]?.subject_id, "OBJ-BRASS-KEY");
  assert.equal(summary.world_state_changes.length, 1);
  assert.equal(summary.world_state_changes[0]?.record_id, "STATE-ARCHIVE-ALARM");

  assert.deepEqual(summary.knowledge_changes, []);
  assert.deepEqual(summary.relationship_changes, []);
  assert.deepEqual(summary.timeline_movement, []);
  assert.deepEqual(summary.threads, { opened: [], advanced: [], resolved: [] });
  assert.deepEqual(summary.promises_to_reader, []);
  assert.deepEqual(summary.research_claims_introduced, []);
  assert.deepEqual(summary.unresolved_ambiguities, []);

  assert.deepEqual(summary.manuscript_evidence_anchors.map((anchor) => anchor.paragraph), [1, 2, 2]);
  const anchorIds = new Set(summary.manuscript_evidence_anchors.map((anchor) => anchor.id));
  for (const change of [
    ...summary.world_state_changes,
    ...summary.character_state_changes,
    ...summary.object_transfers_or_destruction,
  ]) {
    assert.ok(change.evidence_anchor_ids.length > 0);
    assert.ok(change.evidence_anchor_ids.every((id) => anchorIds.has(id)));
  }
});

test("chapter delta summary rendering is deterministic and schema-valid", () => {
  const summary = build();
  const first = renderChapterDeltaSummary(summary);
  const second = renderChapterDeltaSummary(summary);
  assert.equal(second, first);
  assert.deepEqual(parseYaml(first, ChapterDeltaSummarySchema, "chapter-delta-summary"), summary);
});

test("chapter delta summaries reject mutations without exact manuscript evidence", () => {
  assert.throws(() => buildChapterDeltaSummary({
    runId: "RUN-DELTA-001",
    bookId: "book-01",
    chapter: 1,
    contractHash: "a".repeat(64),
    manuscriptPath: "books/book-01/manuscript/chapters/01-opening.md",
    manuscriptText: manuscript,
    beforeStateLedger: before,
    afterStateLedger: after,
    entityRegistry: registry,
    mutations: [{ ...mutations[0]!, evidence_quote: "This sentence does not exist" }],
    createdAt: "2026-07-22T12:00:00.000Z",
  }), /evidence quote.*not found/i);
});

test("chapter delta summaries reject evidence quotes that match more than one paragraph", () => {
  assert.throws(() => buildChapterDeltaSummary({
    runId: "RUN-DELTA-001",
    bookId: "book-01",
    chapter: 1,
    contractHash: "a".repeat(64),
    manuscriptPath: "books/book-01/manuscript/chapters/01-opening.md",
    manuscriptText: "Mara reached the terminal.\n\nMara reached the terminal again.",
    beforeStateLedger: before,
    afterStateLedger: after,
    entityRegistry: registry,
    mutations: [mutations[0]!],
    createdAt: "2026-07-22T12:00:00.000Z",
  }), /evidence quote.*more than one paragraph|ambiguous evidence/i);
});

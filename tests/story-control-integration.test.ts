import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creativeProjectStateHash } from "../src/application/project-hash.js";
import {
  isStoryControlPathAllowed,
  storyControlPathsForEvent,
} from "../src/application/story-control-paths.js";
import { ChapterContractSchema } from "../src/domain/chapter-contract.js";
import { EntityRegistrySchema } from "../src/domain/entity-registry.js";
import { KnowledgeLedgerSchema } from "../src/domain/knowledge-ledger.js";
import { StateLedgerSchema } from "../src/domain/state-ledger.js";
import { v15SchemaForPath } from "../src/domain/v1-5-schema-registry.js";
import { projectTemplateFiles } from "../src/project/templates.js";
import { initializeProject } from "../src/project/store.js";

test("new projects initialize canonical story control ledgers", () => {
  const files = projectTemplateFiles({ projectName: "Story Controls", projectType: "standalone", profile: "thriller" });
  assert.ok(files["series/entity-registry.yaml"]);
  assert.ok(files["series/state-ledger.yaml"]);
  assert.ok(files["series/knowledge-ledger.yaml"]);
});

test("schema registry validates canonical controls and chapter contracts", () => {
  assert.equal(v15SchemaForPath("series/entity-registry.yaml"), EntityRegistrySchema);
  assert.equal(v15SchemaForPath("series/state-ledger.yaml"), StateLedgerSchema);
  assert.equal(v15SchemaForPath("series/knowledge-ledger.yaml"), KnowledgeLedgerSchema);
  assert.equal(v15SchemaForPath("books/book-01/contracts/chapters/CH-001.yaml"), ChapterContractSchema);
});

test("event path policy is conservative until delta reconciliation exists", () => {
  assert.deepEqual(storyControlPathsForEvent("series-plan", "book-01"), [
    "series/entity-registry.yaml",
    "series/knowledge-ledger.yaml",
    "series/state-ledger.yaml",
  ]);
  assert.equal(isStoryControlPathAllowed("chapter-queue", "books/book-01/contracts/chapters/CH-003.yaml", "book-01"), true);
  assert.equal(isStoryControlPathAllowed("book-plan", "series/state-ledger.yaml", "book-01"), true);
  assert.equal(isStoryControlPathAllowed("canon-lock", "series/knowledge-ledger.yaml", "book-01"), true);
  assert.equal(isStoryControlPathAllowed("draft-chapter", "series/state-ledger.yaml", "book-01"), false);
  assert.equal(isStoryControlPathAllowed("revise", "series/knowledge-ledger.yaml", "book-01"), false);
});

test("creative state hash includes canonical ledgers and compiled contracts", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-story-control-hash-"));
  try {
    const root = initializeProject(parent, { projectName: "Story Hash", projectType: "standalone", profile: "thriller" });
    const initial = creativeProjectStateHash(root);
    writeFileSync(join(root, "series", "state-ledger.yaml"), "schema_version: 1.0.0\nrecords:\n  - id: STATE-MARA-LOCATION\n    subject_id: CHAR-MARA\n    field: location\n    value: LOC-ARCHIVE\n    status: current-state\n    source: chapter-01\n    introduced_in: chapter-01\n    updated_in: chapter-01\n    evidence_ids: [chapter-01]\n", "utf8");
    const ledgerHash = creativeProjectStateHash(root);
    assert.notEqual(ledgerHash, initial);
    const contractRoot = join(root, "books", "book-01", "contracts", "chapters");
    mkdirSync(contractRoot, { recursive: true });
    writeFileSync(join(contractRoot, "CH-001.yaml"), "schema_version: 2.0.0\ncontract_id: CH-001\n", "utf8");
    assert.notEqual(creativeProjectStateHash(root), ledgerHash);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

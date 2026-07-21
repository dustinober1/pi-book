import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { chapterContractPath, type ChapterContract } from "../src/domain/chapter-contract.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-canonical-story-"));
}

function packet() {
  return {
    chapter: 1,
    title: "Opening",
    status: "ready" as const,
    pov: "CHAR-MARA",
    purpose: "Recover the ledger.",
    scene_engine: "Access fails under pressure.",
    pressure_movement: "Security closes in.",
    character_movement: "Mara chooses evidence over safety.",
    relationship_movement: "Trust changes.",
    story_thread_refs: [],
    continuity_refs: [],
    character_refs: [],
    required_research: [],
    profile_fields: {
      threat_delta: "+1",
      evidence_delta: "EV-1",
      reader_forecast_change: "the archive is compromised",
      protagonist_choice: "continues",
    },
    ending_hook: "Someone used the terminal first.",
    milestone_gate: null,
    target_words: 1800,
  };
}

function contract(requiredRecordIds = ["CHAR-MARA", "STATE-MARA-LOCATION", "KNOW-MARA-ACCESS", "CAN-ACCESS"]): ChapterContract {
  return {
    schema_version: "2.0.0",
    contract_id: "CH-001",
    version: 1,
    chapter: 1,
    title: "Opening",
    source_kind: "approved-contract",
    source_packet_hash: "a".repeat(64),
    pov: "CHAR-MARA",
    purpose: "Recover the ledger.",
    required_beats: ["Enter archive", "Discover prior access", "Choose evidence over safety"],
    active_thread_ids: [],
    required_record_ids: requiredRecordIds,
    start_state_ids: ["STATE-MARA-LOCATION"],
    required_end_state: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-ARCHIVE" }],
    forbidden_changes: ["Do not identify the prior user."],
    knowledge_boundary_ids: ["KNOW-MARA-ACCESS"],
    target_words: { minimum: 1500, maximum: 2100 },
    ending_hook: "Someone used the terminal first.",
    small_model_ready: true,
    missing_small_model_fields: [],
  };
}

function setup(stage: "chapter-queue" | "drafting" = "chapter-queue"): { parent: string; root: string } {
  const parent = temp();
  const root = initializeProject(parent, {
    projectName: "Canonical Story",
    projectType: "standalone",
    profile: "thriller",
  });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [
      { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
      { id: "LOC-ARCHIVE", category: "location", display_name: "Archive", aliases: [], status: "locked-canon", source: "book-bible", introduced_in: "book-01" },
    ],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    records: [{
      id: "STATE-MARA-LOCATION",
      subject_id: "CHAR-MARA",
      field: "location",
      value: "LOC-ARCHIVE",
      status: "current-state",
      source: "chapter-00",
      introduced_in: "chapter-00",
      updated_in: "chapter-00",
      evidence_ids: ["C00-P001"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    records: [{
      id: "KNOW-MARA-ACCESS",
      knower_id: "CHAR-MARA",
      fact_id: "CAN-ACCESS",
      knowledge: "known",
      status: "accepted-manuscript-fact",
      source: "chapter-00",
      introduced_in: "chapter-00",
      evidence_ids: ["C00-P001"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "Mara has archive access.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 1, act: "act-1", causality: "therefore she enters", state_change: "access is tested", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
    decisions: [],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "act-1",
    packets: [packet()],
  }), "utf8");
  return { parent, root };
}

test("new projects include empty canonical entity, state, and knowledge ledgers", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Templates", projectType: "standalone", profile: "thriller" });
    for (const name of ["entity-registry.yaml", "state-ledger.yaml", "knowledge-ledger.yaml"]) {
      assert.equal(existsSync(join(root, "series", name)), true, `${name} should exist`);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("canonical entity and ledger changes alter the guarded project hash", () => {
  const { parent, root } = setup();
  try {
    const before = projectStateHash(root);
    const path = join(root, "series", "entity-registry.yaml");
    writeFileSync(path, readFileSync(path, "utf8").replace("Mara\n", "Mara Vale\n"), "utf8");
    assert.notEqual(projectStateHash(root), before);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("chapter-queue events may save valid contracts at the canonical path", () => {
  const { parent, root } = setup();
  try {
    const queuePath = "books/book-01/chapter-queue.yaml";
    const contractPath = chapterContractPath("book-01", 1);
    applyNovelEvent(root, {
      eventType: "chapter-queue",
      expectedStage: "chapter-queue",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: queuePath, content: readFileSync(join(root, queuePath), "utf8") },
        { path: contractPath, content: stringifyYaml(contract()) },
      ],
    });
    assert.equal(existsSync(join(root, contractPath)), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("contract events block unresolved required record IDs before mutation", () => {
  const { parent, root } = setup();
  try {
    const queuePath = "books/book-01/chapter-queue.yaml";
    const contractPath = chapterContractPath("book-01", 1);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "chapter-queue",
      expectedStage: "chapter-queue",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: queuePath, content: readFileSync(join(root, queuePath), "utf8") },
        { path: contractPath, content: stringifyYaml(contract(["CHAR-MISSING"])) },
      ],
    }), /missing required record CHAR-MISSING/i);
    assert.equal(existsSync(join(root, contractPath)), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("draft events reject conflicting established state records rather than accepting ambiguous reality", () => {
  const { parent, root } = setup("drafting");
  try {
    const statePath = "series/state-ledger.yaml";
    const conflicting = {
      schema_version: "1.0.0",
      records: [
        {
          id: "STATE-MARA-LOCATION",
          subject_id: "CHAR-MARA",
          field: "location",
          value: "LOC-ARCHIVE",
          status: "current-state",
          source: "chapter-00",
          introduced_in: "chapter-00",
          updated_in: "chapter-00",
          evidence_ids: ["C00-P001"],
        },
        {
          id: "STATE-MARA-LOCATION-NEW",
          subject_id: "CHAR-MARA",
          field: "location",
          value: "LOC-ROOF",
          status: "accepted-manuscript-fact",
          source: "chapter-01",
          introduced_in: "chapter-01",
          updated_in: "chapter-01",
          evidence_ids: ["C01-P010"],
        },
      ],
    };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "draft-chapter",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      chapter: 1,
      files: [
        { path: "books/book-01/manuscript/chapters/01-opening.md", content: "# Opening\n\nMara reaches the roof.\n" },
        { path: statePath, content: stringifyYaml(conflicting) },
      ],
    }), /multiple established state records/i);
    assert.equal(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md")), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

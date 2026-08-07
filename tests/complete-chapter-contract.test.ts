import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeChapterContract } from "../src/application/contracts/complete-chapter-contract.js";
import { compileLegacyChapterContract } from "../src/application/contracts/chapter-contract-compiler.js";
import { deriveContractFields, remainingContractFields } from "../src/application/contracts/contract-field-derivation.js";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../src/domain/chapter-contract.js";
import type { ChapterPacket } from "../src/domain/schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-complete-contract-")); }

function packet(): ChapterPacket {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "Reach the terminal.",
    scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["CAN-ACCESS"],
    character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
    ending_hook: "danger", milestone_gate: null, target_words: 1000,
  } as unknown as ChapterPacket;
}

function stateLedger() {
  return {
    schema_version: "1.0.0",
    records: [
      { id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: ["C00-P001"] },
      { id: "STATE-MARA-CREDENTIAL", subject_id: "CHAR-MARA", field: "credential", value: "revoked", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: ["C00-P002"] },
      // A different subject: must not leak into this chapter's start state.
      { id: "STATE-VOSS-LOCATION", subject_id: "CHAR-VOSS", field: "location", value: "LOC-ROOF", status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: ["C00-P003"] },
      // Not established: a proposed plan is not a fact to start from.
      { id: "STATE-MARA-PLAN", subject_id: "CHAR-MARA", field: "plan", value: "descend", status: "proposed-plan", source: "chapter-00", introduced_in: null, updated_in: null, evidence_ids: [] },
    ],
  };
}

function knowledgeLedger() {
  return {
    schema_version: "1.0.0",
    records: [
      { id: "KNOW-MARA-ACCESS", knower_id: "CHAR-MARA", fact_id: "CAN-ACCESS", knowledge: "known", status: "locked-canon", source: "chapter-00", introduced_in: "chapter-00", evidence_ids: ["C00-P001"] },
      // Another knower: a boundary is what this POV may know.
      { id: "KNOW-VOSS-ACCESS", knower_id: "CHAR-VOSS", fact_id: "CAN-ACCESS", knowledge: "known", status: "locked-canon", source: "chapter-00", introduced_in: "chapter-00", evidence_ids: ["C00-P002"] },
    ],
  };
}

/**
 * A project in the state the tool actually meets: a valid plot grid and canon so
 * the chapter-queue event's own reference checks pass, and a clean worktree,
 * because the working-tree guard rightly rejects a submission that differs from
 * an uncommitted file.
 */
function setup(options: { ledgers?: boolean } = {}) {
  const parent = temp();
  const root = initializeProject(parent, { projectName: "Contract Typing", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "chapter-queue";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books/book-01/chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet()] }), "utf8");
  writeFileSync(join(root, "books/book-01/plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "access is tested", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  // Canonical story integrity requires every ledger subject to be a registered
  // entity; without it the guarded event correctly refuses the contract.
  writeFileSync(join(root, "series/entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [
      { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
      { id: "CHAR-VOSS", category: "character", display_name: "Voss", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
    ],
  }), "utf8");
  writeFileSync(join(root, "series/canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The terminal credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  if (options.ledgers !== false) {
    writeFileSync(join(root, "series/state-ledger.yaml"), stringifyYaml(stateLedger()), "utf8");
    writeFileSync(join(root, "series/knowledge-ledger.yaml"), stringifyYaml(knowledgeLedger()), "utf8");
  }
  return { parent, root };
}

function commitAll(root: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
}

function writeSkeleton(root: string, withLedgers: boolean): ChapterContract {
  mkdirSync(join(root, "books/book-01/contracts/chapters"), { recursive: true });
  const contract = compileLegacyChapterContract(packet(), withLedgers
    ? { ledgers: { state: stateLedger() as never, knowledge: knowledgeLedger() as never } }
    : {});
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(contract), "utf8");
  return contract;
}

test("derivation resolves the two graph fields and scopes them correctly", () => {
  const derived = deriveContractFields(packet(), { state: stateLedger() as never, knowledge: knowledgeLedger() as never });
  // Only this chapter's subjects, and only established records.
  assert.deepEqual(derived.startStateIds, ["STATE-MARA-CREDENTIAL", "STATE-MARA-LOCATION"]);
  assert.ok(!derived.startStateIds.includes("STATE-VOSS-LOCATION"), "another character's state is not a start state here");
  assert.ok(!derived.startStateIds.includes("STATE-MARA-PLAN"), "a proposed plan is not an established fact");
  // A knowledge boundary is what this POV may know, not the cast's union.
  assert.deepEqual(derived.knowledgeBoundaryIds, ["KNOW-MARA-ACCESS"]);
});

test("a project with no ledgers derives nothing rather than guessing", () => {
  const derived = deriveContractFields(packet(), {});
  assert.deepEqual(derived.startStateIds, []);
  assert.deepEqual(derived.knowledgeBoundaryIds, []);
  // Both derived fields stay missing, so an empty ledger cannot produce a
  // contract that merely looks executable.
  assert.deepEqual(
    remainingContractFields(derived).sort(),
    ["forbidden_changes", "knowledge_boundary_ids", "required_end_state", "start_state_ids"],
  );
});

test("a compiled skeleton now asks the author for two fields instead of four", () => {
  const withoutLedgers = compileLegacyChapterContract(packet());
  assert.deepEqual(withoutLedgers.missing_small_model_fields.sort(), ["forbidden_changes", "knowledge_boundary_ids", "required_end_state", "start_state_ids"]);

  const withLedgers = compileLegacyChapterContract(packet(), { ledgers: { state: stateLedger() as never, knowledge: knowledgeLedger() as never } });
  assert.deepEqual(withLedgers.missing_small_model_fields.sort(), ["forbidden_changes", "required_end_state"]);
  assert.deepEqual(withLedgers.start_state_ids, ["STATE-MARA-CREDENTIAL", "STATE-MARA-LOCATION"]);
  assert.deepEqual(withLedgers.knowledge_boundary_ids, ["KNOW-MARA-ACCESS"]);
  assert.equal(withLedgers.small_model_ready, false, "derivation alone never claims readiness");
});

test("typed completion produces an executable contract without the model writing YAML", () => {
  const { parent, root } = setup();
  try {
    writeSkeleton(root, true);
    const result = completeChapterContract(root, {
      chapter: 1,
      requiredEndState: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbiddenChanges: ["Do not identify the prior user."],
    });
    assert.equal(result.contract.small_model_ready, true);
    assert.deepEqual(result.stillMissing, []);
    assert.deepEqual(result.derivedFields.sort(), ["knowledge_boundary_ids", "start_state_ids"]);
    // Authoring supersedes the compiled skeleton.
    assert.equal(result.contract.source_kind, "approved-contract");
    assert.equal(result.contract.version, 2);
    // The tool serialised it, so the result is schema-valid by construction.
    const reparsed = parseYaml<ChapterContract>(result.content, ChapterContractSchema, result.path);
    assert.deepEqual(reparsed, result.contract);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a value that would be invention is rejected rather than serialised", () => {
  const { parent, root } = setup();
  try {
    writeSkeleton(root, true);
    // Typing the input must not merely move invention from malformed YAML into
    // well-formed nonsense: every ID has to name a record that exists.
    assert.throws(() => completeChapterContract(root, {
      chapter: 1,
      requiredEndState: [{ record_id: "STATE-DOES-NOT-EXIST", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbiddenChanges: [],
    }), /required_end_state names a record that do(es)? not exist|do not exist/);

    assert.throws(() => completeChapterContract(root, {
      chapter: 1,
      requiredEndState: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbiddenChanges: [],
      startStateIds: ["STATE-IMAGINARY"],
    }), /start_state_ids/);

    assert.throws(() => completeChapterContract(root, {
      chapter: 1,
      requiredEndState: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbiddenChanges: [],
      knowledgeBoundaryIds: ["KNOW-IMAGINARY"],
    }), /knowledge_boundary_ids/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a chapter that changes nothing has no executable contract", () => {
  const { parent, root } = setup();
  try {
    writeSkeleton(root, true);
    assert.throws(() => completeChapterContract(root, {
      chapter: 1, requiredEndState: [], forbiddenChanges: ["Do not identify the prior user."],
    }), /at least one state change/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("completion without ledgers reports what is still missing instead of claiming readiness", () => {
  const { parent, root } = setup({ ledgers: false });
  try {
    writeSkeleton(root, false);
    // No ledgers means no records to name, so the only honest outcome is a
    // rejection naming the unknown ID — not a contract that looks executable.
    assert.throws(() => completeChapterContract(root, {
      chapter: 1,
      requiredEndState: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbiddenChanges: [],
    }), /do not exist/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the tool applies through the guarded chapter-queue event", async () => {
  const { parent, root } = setup();
  try {
    writeSkeleton(root, true);
    commitAll(root);
    const tools = new Map<string, any>();
    registerNovelForgeWithRecalibration({
      registerCommand() {}, registerTool(tool: any) { tools.set(tool.name, tool); }, sendUserMessage() {},
    } as never);
    const tool = tools.get("novel_complete_chapter_contract");
    assert.ok(tool, "novel_complete_chapter_contract must be registered");

    const result = await tool.execute("call-1", {
      project_root: root,
      chapter: 1,
      required_end_state: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
      forbidden_changes: ["Do not identify the prior user."],
    }, undefined, undefined, { cwd: root });

    assert.equal(result.details.small_model_ready, true);
    assert.match(result.content[0].text, /is now executable/);
    assert.match(result.content[0].text, /Derived from the story ledgers, not asked of you/);
    // The contract reached disk through the guarded event, not a direct write.
    const onDisk = parseYaml<ChapterContract>(readFileSync(join(root, chapterContractPath("book-01", 1)), "utf8"), ChapterContractSchema, "contract");
    assert.equal(onDisk.small_model_ready, true);
    assert.deepEqual(onDisk.required_end_state, [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }]);
    assert.ok(result.details.changed.includes(chapterContractPath("book-01", 1)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the tool surfaces a rejection instead of throwing", async () => {
  const { parent, root } = setup();
  try {
    writeSkeleton(root, true);
    commitAll(root);
    const tools = new Map<string, any>();
    registerNovelForgeWithRecalibration({
      registerCommand() {}, registerTool(tool: any) { tools.set(tool.name, tool); }, sendUserMessage() {},
    } as never);
    const result = await tools.get("novel_complete_chapter_contract").execute("call-2", {
      project_root: root, chapter: 99,
      required_end_state: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "x" }],
      forbidden_changes: [],
    }, undefined, undefined, { cwd: root });
    assert.match(result.content[0].text, /blocked/);
    assert.match(result.details.error, /no packet in the active chapter queue/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { chapterContractPath, renderChapterContract } from "../src/application/contracts/chapter-contract-renderer.js";
import { ChapterContractSchema, type ChapterContract } from "../src/domain/chapter-contract.js";
import { v15SchemaForPath } from "../src/domain/v1-5-schema-registry.js";

function approvedContract(): ChapterContract {
  return {
    schema_version: "2.0.0",
    contract_id: "CH-001",
    chapter: 1,
    title: "The False Alarm",
    status: "approved",
    pov: "CHAR-MARA-001",
    tense: "past",
    purpose: "Establish the impossible archive alarm.",
    start_state_refs: ["STATE-MARA-LOCATION-001"],
    required_end_state: [{
      id: "EXP-001",
      subject_ref: "CHAR-MARA-001",
      field: "knowledge",
      operation: "add",
      value: "FACT-ALARM-FALSE-001",
    }],
    required_beat_ids: ["BEAT-001", "BEAT-002"],
    forbidden_change_ids: ["LOCK-IDENTITY-001"],
    knowledge_boundary_ids: ["KNOW-MARA-001"],
    allowed_invention_rules: ["Incidental physical detail only."],
    active_thread_ids: ["THREAD-ALARM-001"],
    required_research_ids: [],
    scene_ids: ["SCN-001", "SCN-002"],
    style_card_ref: "STYLE-MARA-001",
    target_words: { minimum: 2200, maximum: 2800 },
    acceptance_tests: [{
      id: "TEST-001",
      category: "required-beat",
      description: "Both required beats appear in order.",
      record_ids: ["BEAT-001", "BEAT-002"],
    }],
    stop_conditions: ["Stop if a protected reveal would be required."],
    source_packet_hash: "c".repeat(64),
  };
}

test("approved contracts render to the canonical chapter contract path", () => {
  const contract = approvedContract();
  const rendered = renderChapterContract("book-01", contract);
  assert.equal(rendered.path, "books/book-01/contracts/chapters/CH-001.yaml");
  assert.equal(rendered.path, chapterContractPath("book-01", 1));
  assert.deepEqual(parseYaml(rendered.content, ChapterContractSchema, rendered.path), contract);
  assert.equal(v15SchemaForPath(rendered.path), ChapterContractSchema);
});

test("contract rendering is deterministic", () => {
  const first = renderChapterContract("book-01", approvedContract());
  const second = renderChapterContract("book-01", approvedContract());
  assert.equal(first.content, second.content);
});

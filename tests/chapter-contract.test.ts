import test from "node:test";
import assert from "node:assert/strict";
import { compileLegacyChapterContract } from "../src/application/contracts/chapter-contract-compiler.js";

const packet = {
  chapter: 1,
  title: "The Archive",
  status: "ready" as const,
  pov: "CHAR-MARA",
  purpose: "Recover the ledger.",
  scene_engine: "Access fails under pressure.",
  pressure_movement: "Security closes in.",
  character_movement: "Mara chooses evidence over safety.",
  relationship_movement: "",
  story_thread_refs: ["THREAD-LEDGER"],
  continuity_refs: ["FACT-ACCESS"],
  character_refs: ["CHAR-MARA"],
  required_research: [],
  profile_fields: {},
  ending_hook: "Someone used the terminal first.",
  milestone_gate: null,
  target_words: 2400,
};

test("legacy packets compile to deterministic schema-two contracts", () => {
  const contract = compileLegacyChapterContract(packet);
  assert.equal(contract.schema_version, "2.0.0");
  assert.equal(contract.contract_id, "CH-001");
  assert.equal(contract.source_kind, "legacy-packet");
  assert.match(contract.source_packet_hash, /^[a-f0-9]{64}$/);
  assert.equal(contract.target_words.maximum, 2640);
});

test("legacy contracts are not small-model ready without explicit boundaries", () => {
  const contract = compileLegacyChapterContract(packet);
  assert.equal(contract.small_model_ready, false);
  assert.ok(contract.missing_small_model_fields.includes("start_state_ids"));
  assert.ok(contract.missing_small_model_fields.includes("required_end_state"));
});

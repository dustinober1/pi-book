import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  assertChapterContractDraftable,
  chapterContractFindings,
  compileLegacyChapterContract,
} from "../src/application/contracts/chapter-contract-compiler.js";
import { ChapterContractSchema } from "../src/domain/chapter-contract.js";
import type { ChapterPacket } from "../src/domain/schemas.js";

const packet: ChapterPacket = {
  chapter: 7,
  title: "The Locked Archive",
  status: "ready",
  pov: "CHAR-MARA-001",
  purpose: "Mara reaches the archive and discovers prior access.",
  scene_engine: "credential failure forces a covert workaround",
  pressure_movement: "security pressure rises",
  character_movement: "Mara chooses evidence over safety",
  relationship_movement: "Mara stops trusting Hale",
  story_thread_refs: ["THREAD-LEDGER-005"],
  continuity_refs: ["STATE-MARA-LOCATION-001"],
  character_refs: ["CHAR-MARA-001"],
  required_research: ["RES-014"],
  profile_fields: {},
  ending_hook: "The access log shows an earlier user.",
  milestone_gate: null,
  target_words: 2400,
};

test("legacy packets compile deterministically without becoming approved small-model contracts", () => {
  const sourcePacketHash = "a".repeat(64);
  const contract = compileLegacyChapterContract({ packet, sourcePacketHash });
  assert.equal(contract.schema_version, "2.0.0");
  assert.equal(contract.contract_id, "CH-007");
  assert.equal(contract.chapter, 7);
  assert.equal(contract.status, "draft");
  assert.equal(contract.source_packet_hash, sourcePacketHash);
  assert.deepEqual(contract.active_thread_ids, ["THREAD-LEDGER-005"]);
  assert.deepEqual(contract.required_research_ids, ["RES-014"]);
  assert.deepEqual(contract.target_words, { minimum: 1920, maximum: 2880 });
  assert.equal(Value.Check(ChapterContractSchema, contract), true);
  const codes = chapterContractFindings(contract, { smallModel: true }).map((finding) => finding.code);
  assert.ok(codes.includes("contract-not-approved"));
  assert.ok(codes.includes("missing-end-state"));
  assert.ok(codes.includes("missing-scene-ids"));
  assert.throws(() => assertChapterContractDraftable(contract, { smallModel: true }), /not draftable/i);
});

test("legacy compiler extracts explicit control fields when the packet carries them", () => {
  const contract = compileLegacyChapterContract({
    packet: {
      ...packet,
      profile_fields: {
        tense: "present",
        required_beat_ids: ["BEAT-071", "BEAT-072"],
        forbidden_change_ids: ["LOCK-REVEAL-009"],
        knowledge_boundary_ids: ["KNOW-MARA-004"],
        allowed_invention_rules: ["May invent incidental archive textures."],
        style_card_ref: "STYLE-MARA-005",
      },
    },
    sourcePacketHash: "b".repeat(64),
  });
  assert.equal(contract.tense, "present");
  assert.deepEqual(contract.required_beat_ids, ["BEAT-071", "BEAT-072"]);
  assert.deepEqual(contract.forbidden_change_ids, ["LOCK-REVEAL-009"]);
  assert.deepEqual(contract.knowledge_boundary_ids, ["KNOW-MARA-004"]);
  assert.equal(contract.style_card_ref, "STYLE-MARA-005");
});

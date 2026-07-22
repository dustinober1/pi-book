import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActiveContextCapsule } from "../src/domain/active-context-capsule.js";
import {
  contextCapsuleCacheKey,
  contextCapsuleCachePath,
  readCachedContextCapsule,
  writeCachedContextCapsule,
  type ContextCapsuleCacheKeyInput,
} from "../src/infrastructure/context-capsule-cache.js";

function capsule(): ActiveContextCapsule {
  return {
    schema_version: "1.0.0",
    capsule_id: "CAP-0123456789ABCDEF",
    job_type: "draft-scene",
    model_execution_profile: "small-12b-q4",
    scene_contract: {
      schema_version: "1.0.0",
      scene_id: "CH-001-SC-01-V1",
      chapter_contract_id: "CH-001",
      chapter_contract_version: 1,
      sequence: 1,
      pov: "CHAR-MARA",
      objective: "Reach the terminal.",
      conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.",
      required_beats: ["Enter"],
      active_thread_ids: [],
      required_record_ids: [],
      start_state_ids: [],
      expected_state_delta: [],
      forbidden_changes: [],
      knowledge_boundary_ids: [],
      target_words: { minimum: 700, maximum: 900 },
      ending_requirement: "Reach the terminal unseen.",
    },
    contract_hash: "a".repeat(64),
    story_index_hash: "b".repeat(64),
    opening_rules: ["Preserve canon."],
    records: [],
    previous_tail: null,
    style_card: null,
    closing_task: ["Draft the scene."],
    manifest: {
      included_record_ids: [],
      omitted_record_ids: [],
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: [],
      estimated_evidence_tokens: 120,
      maximum_evidence_tokens: 6000,
    },
  };
}

function keyInput(value = capsule()): ContextCapsuleCacheKeyInput {
  return {
    projectHash: "c".repeat(64),
    runtimeProfile: "tiny-local",
    capsule: value,
  };
}

test("cache keys include every execution and authority dimension", () => {
  const base = keyInput();
  const first = contextCapsuleCacheKey(base);
  assert.equal(first, contextCapsuleCacheKey(base));

  const variants: ContextCapsuleCacheKeyInput[] = [
    { ...base, projectHash: "d".repeat(64) },
    { ...base, runtimeProfile: "local" },
    { ...base, capsule: { ...base.capsule, contract_hash: "d".repeat(64) } },
    { ...base, capsule: { ...base.capsule, story_index_hash: "d".repeat(64) } },
    { ...base, capsule: { ...base.capsule, model_execution_profile: "host-default" } },
    { ...base, capsule: { ...base.capsule, job_type: "plan-scene" } },
    { ...base, capsule: { ...base.capsule, capsule_id: "CAP-FEDCBA9876543210" } },
  ];
  for (const variant of variants) assert.notEqual(contextCapsuleCacheKey(variant), first);
});

test("cached capsules persist atomically and reject mismatched lookups", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-capsule-cache-"));
  try {
    const input = keyInput();
    const written = writeCachedContextCapsule(root, input);
    assert.equal(written.key, contextCapsuleCacheKey(input));
    assert.equal(written.path, contextCapsuleCachePath(root, written.key));
    assert.deepEqual(readCachedContextCapsule(root, input), input.capsule);
    assert.equal(readCachedContextCapsule(root, { ...input, runtimeProfile: "full" }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

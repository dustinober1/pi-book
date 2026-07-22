import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SceneCriticArtifact, SceneCriticSummaryArtifact } from "../src/domain/scene-critic-artifact.js";
import { readSceneCriticArtifact, writeSceneCriticArtifact } from "../src/infrastructure/scene-critic-artifact-store.js";
import { readSceneCriticSummaryArtifact, writeSceneCriticSummaryArtifact } from "../src/infrastructure/scene-critic-summary-store.js";

function critic(): SceneCriticArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    draft_attempt: 1,
    draft_output_hash: "a".repeat(64),
    job_type: "critic-continuity",
    capsule_id: "CAP-1111111111111111",
    contract_hash: "b".repeat(64),
    critic_attempt: 1,
    verdict: "pass",
    findings: [],
    usage: {
      callId: "critic-1",
      stage: "drafting",
      chapter: 1,
      sceneId: "CH-001-SC-01-V1",
      attempt: 1,
      pass: "critic",
      jobType: "critic-continuity",
      contractHash: "b".repeat(64),
      capsuleHash: "c".repeat(64),
      includedRecordCount: 0,
      estimated: true,
      elapsedMs: 1,
      promptHash: "d".repeat(64),
      contextHash: "e".repeat(64),
      outputHash: "f".repeat(64),
    },
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function summary(): SceneCriticSummaryArtifact {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 1,
    scene_id: "CH-001-SC-01-V1",
    draft_attempt: 1,
    draft_output_hash: "a".repeat(64),
    contract_hash: "b".repeat(64),
    required_job_types: ["critic-continuity"],
    critics: [{ job_type: "critic-continuity", critic_attempt: 1, verdict: "pass", finding_count: 0 }],
    blocker_count: 0,
    repair_count: 0,
    passed: true,
    next_action: "state-delta",
    created_at: "2026-07-22T00:00:01.000Z",
  };
}

test("critic and critic-summary artifacts persist independently", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-critic-store-"));
  try {
    const criticValue = critic();
    const summaryValue = summary();
    writeSceneCriticArtifact(root, criticValue);
    writeSceneCriticSummaryArtifact(root, summaryValue);
    assert.deepEqual(readSceneCriticArtifact(root, "RUN-001", "CH-001-SC-01-V1", "critic-continuity", 1), criticValue);
    assert.deepEqual(readSceneCriticSummaryArtifact(root, "RUN-001", "CH-001-SC-01-V1", 1), summaryValue);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", "RUN-001", "scenes", "CH-001-SC-01-V1")).sort(), [
      "critic-continuity-attempt-1.json",
      "critic-summary-draft-1.json",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("critic stores reject unsafe identifiers", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-critic-store-"));
  try {
    assert.throws(() => readSceneCriticArtifact(root, "../escape", "CH-001-SC-01-V1", "critic-continuity", 1), /invalid run id/i);
    assert.throws(() => readSceneCriticArtifact(root, "RUN-001", "../scene", "critic-continuity", 1), /invalid scene id/i);
    assert.throws(() => readSceneCriticArtifact(root, "RUN-001", "CH-001-SC-01-V1", "draft-scene" as never, 1), /critic job/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

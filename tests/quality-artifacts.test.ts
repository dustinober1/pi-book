import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  QualityCandidateSelectionSchema,
  QualityDraftCandidateSchema,
  QualityLaneCritiqueSchema,
  QualityScenePlanSchema,
  QualitySynthesisSchema,
} from "../src/domain/quality-artifacts.js";

const common = {
  schema_version: "1.0.0" as const,
  run_id: "RUN-001",
  chapter: 4,
  source_hashes: ["a".repeat(64), "b".repeat(64)],
  creation_order: 1,
};

test("quality artifacts use strict versioned provenance-bearing schemas", () => {
  const scenePlan = {
    ...common,
    artifact_type: "scene-plan" as const,
    objective: "Force the protagonist to choose between proof and safety.",
    beats: ["Enter under false authority.", "Discover the evidence trap."],
    protected_constraints: ["Preserve the reveal order."],
    ending_hook: "The archive changes its own record.",
    evidence_refs: ["CAN-001", "ST-001"],
  };
  const candidate = {
    ...common,
    creation_order: 2,
    artifact_type: "draft-candidate" as const,
    candidate_id: "CAND-01",
    text: "The archive door opened on a credential that no longer existed.",
    proposed_delta: { canon: [], relationships: [], threads: [] },
  };
  const critique = {
    ...common,
    creation_order: 3,
    artifact_type: "lane-critique" as const,
    candidate_id: "CAND-01",
    lane: "continuity" as const,
    findings: [{ severity: "high" as const, evidence: "The credential was revoked earlier.", required_change: "Explain the temporary grant." }],
    verdict: "revise" as const,
  };
  const selection = {
    ...common,
    creation_order: 4,
    artifact_type: "candidate-selection" as const,
    candidate_ids: ["CAND-01", "CAND-02"],
    selected_candidate_id: "CAND-01",
    rationale: "It preserves causality and gives the reveal a concrete price.",
    evidence: ["The door event follows CAN-001."],
  };
  const synthesis = {
    ...common,
    creation_order: 5,
    artifact_type: "synthesis" as const,
    selected_candidate_id: "CAND-01",
    applied_critique_lanes: ["continuity", "voice"],
    final_output_hash: "c".repeat(64),
    summary: "Resolved the credential contradiction without changing the chapter endpoint.",
  };

  assert.equal(Value.Check(QualityScenePlanSchema, scenePlan), true);
  assert.equal(Value.Check(QualityDraftCandidateSchema, candidate), true);
  assert.equal(Value.Check(QualityLaneCritiqueSchema, critique), true);
  assert.equal(Value.Check(QualityCandidateSelectionSchema, selection), true);
  assert.equal(Value.Check(QualitySynthesisSchema, synthesis), true);
  assert.equal(Value.Check(QualityScenePlanSchema, { ...scenePlan, extra: true }), false);
  assert.equal(Value.Check(QualityDraftCandidateSchema, { ...candidate, source_hashes: ["short"] }), false);
});

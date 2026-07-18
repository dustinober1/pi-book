import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterPacket } from "../src/domain/schemas.js";
import { getProfile } from "../src/profiles/index.js";

function packet(profileFields: Record<string, unknown>): ChapterPacket {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "lead", purpose: "force a choice",
    scene_engine: "field operation", pressure_movement: "deadline becomes visible", character_movement: "lead accepts risk",
    relationship_movement: "trust changes", story_thread_refs: [], continuity_refs: [], character_refs: [], required_research: [],
    profile_fields: profileFields, ending_hook: "the door locks", milestone_gate: "first-chapter-approval", target_words: 3000,
  };
}

test("thriller requires threat, evidence, forecast, and choice", () => {
  const profile = getProfile("thriller");
  const findings = profile.validatePacket(packet({ threat_delta: "+1" }));
  assert.ok(findings.some((item) => item.message.includes("evidence_delta")));
  assert.equal(profile.validatePacket(packet({ threat_delta: "+1", evidence_delta: "EV-1", reader_forecast_change: "new suspect", protagonist_choice: "crosses line" })).filter((item) => item.severity === "blocker").length, 0);
});

test("romantasy requires fantasy, romance, trust, power, and consent movement", () => {
  const profile = getProfile("romantasy");
  const fields = { fantasy_movement: "ward fails", romance_movement: "trust rises", trust_delta: "+1", desire_conflict: "need versus fear", power_balance: "shared", consent_state: "explicit" };
  assert.equal(profile.validatePacket(packet(fields)).filter((item) => item.severity === "blocker").length, 0);
  assert.ok(profile.validatePacket(packet({})).length >= 6);
});

test("historical fiction exposes its accuracy contract and packet requirements", () => {
  const profile = getProfile("historical-fiction" as never);
  assert.equal(profile.id, "historical-fiction");
  assert.equal(profile.label, "Historical Fiction");
  assert.deepEqual(profile.defaultGenreConfig().settings, {
    story_mode: "literary",
    relationship_to_history: "fictional-characters-documented-setting",
    accuracy_contract: "balanced",
    prose_register: "period-shaped-readable",
    real_person_policy: "evidence-and-restraint",
    counterfactual_policy: "prohibit-major",
  });
  assert.deepEqual(profile.defaultGenreConfig().requirements, {
    risk_based_research: true,
    chronology_control: "required",
    invention_tracking: "required",
    knowledge_boundaries: "required",
    material_causality: "required",
    anachronism_review: "required",
    portrayal_review: "required",
    historical_note: "conditional",
  });

  const fields = {
    historical_risk: "high",
    chronology_refs: ["HIST-001"],
    constraint_refs: ["HC-001"],
    invention_refs: ["INV-001"],
    knowledge_boundary: "KB-001",
    historical_pressure: "The curfew forces the meeting underground.",
    material_world: "Coal smoke and ration paper constrain movement.",
  };
  assert.equal(profile.validatePacket(packet(fields)).filter((item) => item.severity === "blocker").length, 0);
  assert.ok(profile.validatePacket(packet({ ...fields, constraint_refs: [] })).some((item) => item.message.includes("constraint_refs")));
  assert.ok(profile.planningQuestions.some((item) => /documented|research/i.test(item)));
  assert.ok(profile.milestoneReviewLanes.some((item) => /anachronism/i.test(item)));
  assert.ok(profile.draftingRules.some((item) => /knowledge/i.test(item)));
});

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

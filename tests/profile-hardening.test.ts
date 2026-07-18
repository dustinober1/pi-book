import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterPacket, GenreConfig, PlotGridState } from "../src/domain/schemas.js";
import { romantasyProfile } from "../src/profiles/romantasy.js";
import { thrillerProfile } from "../src/profiles/thriller.js";
import { thrillerArchitectureFindings } from "../src/profiles/thriller.js";
import { getProfile } from "../src/profiles/index.js";

const packet = { chapter: 1, title: "x", status: "ready", pov: "x", purpose: "x", scene_engine: "x", pressure_movement: "x", character_movement: "x", relationship_movement: "x", story_thread_refs: [], continuity_refs: [], character_refs: [], required_research: [], profile_fields: {}, ending_hook: "x", milestone_gate: null, target_words: 1000 } as ChapterPacket;

test("profile packet validators reject wrong value types, not only missing keys", () => {
  const thriller = { ...packet, profile_fields: { threat_delta: null, evidence_delta: {}, reader_forecast_change: "x", protagonist_choice: "x" } } as unknown as ChapterPacket;
  assert.ok(thrillerProfile.validatePacket(thriller).some((finding) => finding.severity === "blocker"));
  const romantasy = { ...packet, profile_fields: { fantasy_movement: "x", romance_movement: "x", trust_delta: {}, desire_conflict: "x", power_balance: "x", consent_state: "x" } } as unknown as ChapterPacket;
  assert.ok(romantasyProfile.validatePacket(romantasy).some((finding) => finding.severity === "blocker"));
});

test("genre configuration and whole-book architecture receive profile validation", () => {
  const invalidThriller = { schema_version: "1.0.0", profile: "thriller", settings: { thriller_type: "cozy" }, requirements: {} } as GenreConfig;
  assert.ok(thrillerProfile.validateGenreConfig(invalidThriller).some((finding) => finding.severity === "blocker"));
  const invalidRomantasy = { schema_version: "1.0.0", profile: "romantasy", settings: { ending_contract: "undefined" }, requirements: {} } as GenreConfig;
  assert.ok(romantasyProfile.validateGenreConfig(invalidRomantasy).some((finding) => finding.severity === "blocker"));

  const plot = { schema_version: "1.0.0", acts: [{ id: "act-1", purpose: "setup", start_chapter: 1, end_chapter: 10, gate: null }], chapters: [{ chapter: 1, act: "act-1", causality: "and then", state_change: "none", setup_ids: [], payoff_ids: [], profile_obligations: [] }] } as PlotGridState;
  assert.ok(thrillerProfile.validatePlot(plot).some((finding) => finding.severity === "blocker" || finding.severity === "high"));
  assert.ok(romantasyProfile.validatePlot(plot).some((finding) => finding.severity === "blocker" || finding.severity === "high"));
});

test("thriller architecture flags missing clock, objective, opposition benefit, and counterevidence", () => {
  const plot = { schema_version: "1.0.0", acts: [], chapters: [1, 2, 3].map((chapter) => ({ chapter, act: "act-1", causality: "therefore", state_change: "pressure rises", setup_ids: [], payoff_ids: [], profile_obligations: [] })) } as never;
  const findings = thrillerArchitectureFindings(plot);
  assert.equal(findings.length, 4);
});

test("historical fiction rejects invalid settings requirements and packet value types", () => {
  const profile = getProfile("historical-fiction" as never);
  const config = profile.defaultGenreConfig();
  assert.equal(profile.validateGenreConfig(config).length, 0);

  const invalidSettings = {
    ...config,
    settings: { ...config.settings, story_mode: "time-travel" },
  } as GenreConfig;
  assert.ok(profile.validateGenreConfig(invalidSettings).some((finding) => finding.severity === "blocker"));

  const invalidRequirements = {
    ...config,
    requirements: { ...config.requirements, risk_based_research: "sometimes" },
  } as unknown as GenreConfig;
  assert.ok(profile.validateGenreConfig(invalidRequirements).some((finding) => finding.severity === "blocker"));

  const invalidPacket = {
    ...packet,
    profile_fields: {
      historical_risk: 3,
      chronology_refs: "HIST-001",
      constraint_refs: [],
      invention_refs: [],
      knowledge_boundary: {},
      historical_pressure: "x",
      material_world: "x",
    },
  } as unknown as ChapterPacket;
  assert.ok(profile.validatePacket(invalidPacket).some((finding) => finding.severity === "blocker"));
});

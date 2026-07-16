import test from "node:test";
import assert from "node:assert/strict";
import { sceneAuditFindings } from "../src/application/scene-audit.js";
import type { ChapterQueueState } from "../src/domain/schemas.js";
import type { PlotGridPhase4 } from "../src/domain/v1-3-architecture-schemas.js";

interface MovementOverrides {
  pressure?: string;
  character?: string;
  relationship?: string;
}

function queue(engines: string[], overrides: Record<number, MovementOverrides> = {}): ChapterQueueState {
  return {
    schema_version: "1.0.0", active_window: "Act I",
    packets: engines.map((scene_engine, index) => {
      const movement = overrides[index + 1] ?? {};
      return {
        chapter: index + 1, title: `Chapter ${index + 1}`, status: "ready", pov: "Mara", purpose: "advance",
        scene_engine,
        pressure_movement: movement.pressure ?? "pressure rises",
        character_movement: movement.character ?? "Mara commits",
        relationship_movement: movement.relationship ?? "trust shifts",
        story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"], required_research: [],
        profile_fields: {}, ending_hook: "new pressure", milestone_gate: null, target_words: 1500,
      };
    }),
  };
}

function plot(states: string[]): PlotGridPhase4 {
  return {
    schema_version: "1.0.0", acts: [{ id: "I", purpose: "entry", start_chapter: 1, end_chapter: states.length, gate: null }],
    chapters: states.map((state_change, index) => ({
      chapter: index + 1, act: "I", causality: "therefore", state_change, setup_ids: [], payoff_ids: [], profile_obligations: [],
    })), decisions: [],
  };
}

test("three consecutive identical scene engines are flagged while two are allowed", () => {
  assert.equal(sceneAuditFindings(queue(["interview", "interview"]), plot(["clue A", "clue B"])).some((item) => item.code === "consecutive-scene-engine"), false);
  const findings = sceneAuditFindings(queue(["interview", "interview", "interview"]), plot(["clue A", "clue B", "clue C"]));
  assert.ok(findings.some((item) => item.code === "consecutive-scene-engine" && item.chapters.join(",") === "1,2,3"));
});

test("whole-book dominance requires six chapters and more than half usage", () => {
  assert.equal(sceneAuditFindings(queue(["search", "search", "search", "search", "argument"]), plot(["a", "b", "c", "d", "e"])).some((item) => item.code === "scene-engine-dominance"), false);
  const findings = sceneAuditFindings(queue(["search", "search", "search", "search", "argument", "escape"]), plot(["a", "b", "c", "d", "e", "f"]));
  assert.ok(findings.some((item) => item.code === "scene-engine-dominance"));
});

test("state-neutral conversations require every state channel to remain neutral", () => {
  const allNeutral = queue(["interview"], { 1: { pressure: "unchanged", character: "unchanged", relationship: "unchanged" } });
  const neutral = sceneAuditFindings(allNeutral, plot(["unchanged"]));
  assert.ok(neutral.some((item) => item.code === "state-neutral-conversation"));

  for (const [label, movement] of [
    ["pressure", { pressure: "deadline advances", character: "unchanged", relationship: "unchanged" }],
    ["character", { pressure: "unchanged", character: "Mara accepts responsibility", relationship: "unchanged" }],
    ["relationship", { pressure: "unchanged", character: "unchanged", relationship: "Jonah withdraws trust" }],
  ] as const) {
    const changed = sceneAuditFindings(queue(["interview"], { 1: movement }), plot(["unchanged"]));
    assert.equal(changed.some((item) => item.code === "state-neutral-conversation"), false, `${label} movement should suppress the finding`);
  }

  const plotChanged = sceneAuditFindings(allNeutral, plot(["Mara learns the lock code"]));
  assert.equal(plotChanged.some((item) => item.code === "state-neutral-conversation"), false);
});

test("briefings and interrogations use the same full state-vector rule", () => {
  const neutralMovements = { 1: { pressure: "none", character: "none", relationship: "none" } };
  for (const engine of ["briefing", "interrogation"]) {
    const findings = sceneAuditFindings(queue([engine], neutralMovements), plot(["none"]));
    assert.ok(findings.some((item) => item.code === "state-neutral-conversation"), engine);
  }
});

test("adjacent indistinguishable state changes are flagged", () => {
  const findings = sceneAuditFindings(queue(["search", "argument"]), plot(["Mara gains access", "mara gains access."]));
  assert.ok(findings.some((item) => item.code === "indistinguishable-state-change" && item.chapters.join(",") === "1,2"));
});

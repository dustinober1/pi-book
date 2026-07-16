import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterQueueState } from "../src/domain/schemas.js";
import type { PlotGridPhase4 } from "../src/domain/v1-3-architecture-schemas.js";
import { sceneDiversityFindings } from "../src/application/scene-diversity.js";

function packet(chapter: number, engine: string, movement = "changes") {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready" as const, pov: "Mara", purpose: "advance",
    scene_engine: engine, pressure_movement: movement, character_movement: movement,
    relationship_movement: movement, story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"],
    required_research: [], profile_fields: {}, ending_hook: "hook", milestone_gate: null, target_words: 1500,
  };
}

function queue(packets: ReturnType<typeof packet>[]): ChapterQueueState {
  return { schema_version: "1.0.0", active_window: "test", packets };
}

function plot(stateChanges: string[]): PlotGridPhase4 {
  return {
    schema_version: "1.0.0", acts: [], decisions: [],
    chapters: stateChanges.map((state_change, index) => ({
      chapter: index + 1, act: "I", causality: "therefore", state_change,
      setup_ids: [], payoff_ids: [], profile_obligations: [],
    })),
  };
}

test("more than two consecutive identical scene engines are flagged", () => {
  const findings = sceneDiversityFindings(
    queue([packet(1, "interview"), packet(2, "interview"), packet(3, "interview")]),
    plot(["new clue", "new suspect", "new risk"]),
  );
  assert.ok(findings.some((item) => item.code === "consecutive-scene-engine" && item.chapters.length === 3));
});

test("two consecutive identical scene engines do not trigger the consecutive rule", () => {
  const findings = sceneDiversityFindings(
    queue([packet(1, "interview"), packet(2, "interview"), packet(3, "pursuit")]),
    plot(["new clue", "new suspect", "new risk"]),
  );
  assert.equal(findings.some((item) => item.code === "consecutive-scene-engine"), false);
});

test("dialogue or interview scenes without state movement are flagged", () => {
  const findings = sceneDiversityFindings(
    queue([packet(1, "conversation", "unchanged")]),
    plot(["unchanged"]),
  );
  assert.ok(findings.some((item) => item.code === "state-neutral-conversation"));
});

test("adjacent chapters with indistinguishable state vectors are flagged", () => {
  const findings = sceneDiversityFindings(
    queue([packet(1, "search", "same pressure"), packet(2, "pursuit", "same pressure")]),
    plot(["same state", "same state"]),
  );
  assert.ok(findings.some((item) => item.code === "indistinguishable-adjacent-chapters"));
});

test("an engine dominating a sufficiently large book is flagged", () => {
  const packets = Array.from({ length: 8 }, (_, index) => packet(index + 1, index < 5 ? "search" : `engine-${index}`));
  const findings = sceneDiversityFindings(queue(packets), plot(packets.map((_, index) => `state-${index}`)));
  assert.ok(findings.some((item) => item.code === "whole-book-engine-dominance"));
});

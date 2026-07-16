import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterPacket, ChapterQueueState } from "../src/domain/schemas.js";
import type { PlotGridPhase4 } from "../src/domain/v1-3-architecture-schemas.js";
import {
  DEFAULT_PACKET_WINDOW_POLICY,
  compactPacketWindow,
  packetWindowDecision,
  packetWindowFindings,
} from "../src/application/packet-window.js";

function packet(chapter: number, status: ChapterPacket["status"] = "ready"): ChapterPacket {
  return {
    chapter,
    title: `Chapter ${chapter}`,
    status,
    pov: "Mara",
    purpose: "advance pressure",
    scene_engine: `engine-${chapter}`,
    pressure_movement: "rises",
    character_movement: "chooses",
    relationship_movement: "shifts",
    story_thread_refs: [],
    continuity_refs: [],
    character_refs: ["Mara"],
    required_research: [],
    profile_fields: {},
    ending_hook: "new pressure",
    milestone_gate: null,
    target_words: 1800,
  };
}

function queue(chapters: number[], status: ChapterPacket["status"] = "ready"): ChapterQueueState {
  return { schema_version: "1.0.0", active_window: "rolling", packets: chapters.map((chapter) => packet(chapter, status)) };
}

function plot(count: number): PlotGridPhase4 {
  return {
    schema_version: "1.0.0",
    acts: [{ id: "I", purpose: "build", start_chapter: 1, end_chapter: count, gate: null }],
    chapters: Array.from({ length: count }, (_, index) => ({
      chapter: index + 1,
      act: "I",
      causality: "therefore",
      state_change: `state-${index + 1}`,
      setup_ids: [],
      payoff_ids: [],
      profile_obligations: [],
    })),
    decisions: [],
  };
}

test("default policy targets six ready packets and refills below two", () => {
  assert.deepEqual(DEFAULT_PACKET_WINDOW_POLICY, { targetReady: 6, refillThreshold: 2 });
  assert.equal(packetWindowDecision(queue([1, 2]), plot(10), new Set()).needsRefill, false);
  const one = packetWindowDecision(queue([1]), plot(10), new Set());
  assert.equal(one.needsRefill, true);
  assert.equal(one.readyCount, 1);
  assert.deepEqual(one.candidateChapters, [2, 3, 4, 5, 6]);
});

test("terminal packets leave the active queue while blocked and ready packets remain", () => {
  const value: ChapterQueueState = {
    schema_version: "1.0.0",
    active_window: "rolling",
    packets: [packet(1, "drafted"), packet(2, "reviewed"), packet(3, "revised"), packet(4, "blocked"), packet(5, "ready")],
  };
  assert.deepEqual(compactPacketWindow(value).packets.map((item) => [item.chapter, item.status]), [[4, "blocked"], [5, "ready"]]);
});

test("refill candidates exclude drafted chapters and all chapters already in the active queue", () => {
  const decision = packetWindowDecision(queue([4]), plot(10), new Set([1, 2, 3]));
  assert.deepEqual(decision.candidateChapters, [5, 6, 7, 8, 9]);
  assert.equal(decision.candidateChapters.includes(4), false);
  assert.equal(decision.candidateChapters.includes(1), false);
});

test("refill uses only remaining planned chapters and never exceeds the target", () => {
  const decision = packetWindowDecision(queue([8]), plot(10), new Set([1, 2, 3, 4, 5, 6, 7]));
  assert.deepEqual(decision.candidateChapters, [9, 10]);
  assert.equal(decision.targetCount, 3);
});

test("window findings block duplicates terminal packets drafted chapters and oversized ready windows", () => {
  const duplicate = queue([1, 1]);
  assert.ok(packetWindowFindings(duplicate, plot(10), new Set()).some((item) => item.code === "duplicate-packet-chapter"));
  assert.ok(packetWindowFindings(queue([1], "drafted"), plot(10), new Set()).some((item) => item.code === "terminal-packet-in-window"));
  assert.ok(packetWindowFindings(queue([1]), plot(10), new Set([1])).some((item) => item.code === "drafted-chapter-requeued"));
  assert.ok(packetWindowFindings(queue([1, 2, 3, 4, 5, 6, 7]), plot(10), new Set()).some((item) => item.code === "packet-window-too-large"));
});

test("ten planned chapters complete with one refill and no duplicate packet generation", () => {
  const planned = plot(10);
  let active = queue([1, 2, 3, 4, 5, 6]);
  const drafted = new Set<number>();
  let refills = 0;
  const generated: number[] = [1, 2, 3, 4, 5, 6];

  while (drafted.size < 10) {
    const next = active.packets.find((item) => item.status === "ready");
    assert.ok(next, "a ready packet must exist until all chapters are drafted");
    drafted.add(next.chapter);
    active = { ...active, packets: active.packets.filter((item) => item.chapter !== next.chapter) };
    const decision = packetWindowDecision(active, planned, drafted);
    if (decision.needsRefill) {
      refills += 1;
      generated.push(...decision.candidateChapters);
      active = { ...active, packets: [...active.packets, ...decision.candidateChapters.map((chapter) => packet(chapter))] };
      assert.ok(active.packets.filter((item) => item.status === "ready").length <= 6);
    }
  }

  assert.equal(refills, 1);
  assert.deepEqual([...drafted].sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(new Set(generated).size, 10);
});

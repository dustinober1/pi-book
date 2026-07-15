import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStoryGraph,
  resolveDraftingGraphContext,
  type StoryGraphInput,
} from "../src/context/story-graph.js";

function fixture(): StoryGraphInput {
  return {
    bookId: "book-01",
    canon: {
      schema_version: "1.0.0",
      facts: [
        { id: "CAN-1", category: "injury", subject: "Mara", fact: "left wrist sprained", source: "chapter-01", status: "locked", introduced_in: "book-01" },
        { id: "CAN-2", category: "injury", subject: "Mara", fact: "right knee bruised", source: "chapter-02", status: "locked", introduced_in: "book-01" },
        { id: "CAN-P", category: "secret", subject: "Mara", fact: "provisional private theory", source: "plan", status: "provisional", introduced_in: null },
        { id: "CAN-F", category: "future", subject: "Mara", fact: "future-book revelation", source: "series-plan", status: "locked", introduced_in: "book-02" },
        { id: "CAN-J", category: "injury", subject: "Jonah", fact: "old shoulder wound", source: "chapter-01", status: "locked", introduced_in: "book-01" },
        { id: "CAN-SOURCE-A", category: "object", subject: "Archive key", fact: "the key is brass", source: "research", status: "locked", introduced_in: "book-01" },
        { id: "CAN-SOURCE-B", category: "object", subject: "Vault seal", fact: "the seal is red", source: "research", status: "locked", introduced_in: "book-01" },
        { id: "CAN-CHAPTER-A", category: "object", subject: "North door", fact: "the north door is damaged", source: "chapter-01", status: "locked", introduced_in: "book-01" },
        { id: "CAN-CHAPTER-B", category: "object", subject: "South window", fact: "the south window is intact", source: "chapter-01", status: "locked", introduced_in: "book-01" },
      ],
      relationships: [
        { id: "REL-1", characters: ["Mara", "Jonah"], state: "uneasy allies", trust: "fragile", public_status: "colleagues", private_status: "mutual suspicion", unresolved: ["missing key"], status: "locked" },
        { id: "REL-P", characters: ["Mara", "Inez"], state: "possible alliance", trust: "unknown", public_status: "strangers", private_status: "unverified", unresolved: [], status: "provisional" },
      ],
    },
    threads: {
      schema_version: "1.0.0",
      threads: [
        { id: "ST-1", type: "mystery", setup: "missing key", reader_knows: "the key was moved", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: "chapter-02" },
        { id: "ST-2", type: "mystery", setup: "altered log", reader_knows: "the log changed", characters_know: { Mara: "suspicious" }, status: "advanced", intended_payoff: "book-01", last_advanced_in: "chapter-02" },
        { id: "ST-PLANNED", type: "future", setup: "sealed letter", reader_knows: "none", characters_know: { Mara: "none" }, status: "planned", intended_payoff: "book-02", last_advanced_in: null },
        { id: "ST-PAID", type: "mystery", setup: "old alarm", reader_knows: "resolved", characters_know: { Mara: "resolved" }, status: "paid-off", intended_payoff: "book-01", last_advanced_in: "chapter-01" },
        { id: "ST-ABANDONED", type: "mystery", setup: "discarded clue", reader_knows: "irrelevant", characters_know: { Mara: "irrelevant" }, status: "abandoned", intended_payoff: null, last_advanced_in: null },
      ],
    },
    queue: {
      schema_version: "1.0.0",
      active_window: "Act I",
      packets: [
        {
          chapter: 1,
          title: "Earlier",
          status: "reviewed",
          pov: "Jonah",
          purpose: "establish doors",
          scene_engine: "inspection",
          pressure_movement: "none",
          character_movement: "Jonah takes inventory",
          relationship_movement: "",
          story_thread_refs: [],
          continuity_refs: ["CAN-CHAPTER-A", "CAN-CHAPTER-B"],
          character_refs: ["Jonah"],
          required_research: [],
          profile_fields: {},
          ending_hook: "",
          milestone_gate: null,
          target_words: 1200,
        },
        {
          chapter: 3,
          title: "Current",
          status: "ready",
          pov: "Mara",
          purpose: "recover the key",
          scene_engine: "search",
          pressure_movement: "guards approach",
          character_movement: "Mara risks exposure",
          relationship_movement: "Mara tests Jonah",
          story_thread_refs: ["ST-1"],
          continuity_refs: ["CAN-1", "CAN-SOURCE-A", "CAN-CHAPTER-A"],
          character_refs: ["Mara"],
          required_research: [],
          profile_fields: {},
          ending_hook: "the lock turns",
          milestone_gate: null,
          target_words: 2400,
        },
      ],
    },
    plot: {
      schema_version: "1.0.0",
      acts: [{ id: "I", purpose: "entry", start_chapter: 1, end_chapter: 8, gate: null }],
      chapters: [
        { chapter: 1, act: "I", causality: "because", state_change: "doors inspected", setup_ids: [], payoff_ids: [], profile_obligations: [] },
        { chapter: 3, act: "I", causality: "therefore", state_change: "key recovered", setup_ids: ["ST-1"], payoff_ids: [], profile_obligations: [] },
      ],
    },
    sources: {
      schema_version: "1.0.0",
      sources: [
        { id: "SRC-1", type: "reference", title: "Archive hardware notes", location: "research/archive.md", verified_on: "2026-07-14", supports: ["CAN-SOURCE-A", "CAN-SOURCE-B"], notes: "physical description" },
      ],
    },
  };
}

function currentPacket(input: StoryGraphInput) {
  const packet = input.queue.packets.find((item) => item.chapter === 3);
  assert.ok(packet);
  return packet;
}

test("discovers safe character-linked continuity with explainable paths", () => {
  const input = fixture();
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));

  assert.deepEqual(resolution.factIds, ["CAN-1", "CAN-2", "CAN-CHAPTER-A", "CAN-SOURCE-A"]);
  assert.deepEqual(resolution.relationshipIds, ["REL-1"]);
  assert.deepEqual(resolution.threadIds, ["ST-1", "ST-2"]);
  assert.deepEqual(resolution.sourceIds, ["SRC-1"]);

  const discovered = resolution.selections.find((item) => item.refId === "CAN-2");
  assert.ok(discovered);
  assert.equal(discovered.reason, "graph-discovered");
  assert.equal(discovered.depth, 1);
  assert.deepEqual(discovered.path, ["character:mara", "canon-fact:CAN-2"]);
});

test("blocks provisional, future-book, and inactive records", () => {
  const input = fixture();
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));
  const blocked = new Map(resolution.blocked.map((item) => [item.refId, item.reason]));

  assert.equal(blocked.get("CAN-P"), "provisional");
  assert.equal(blocked.get("CAN-F"), "future-book");
  assert.equal(blocked.get("REL-P"), "provisional");
  assert.equal(blocked.get("ST-PLANNED"), "inactive-thread");
  assert.equal(blocked.get("ST-PAID"), "inactive-thread");
  assert.equal(blocked.get("ST-ABANDONED"), "inactive-thread");
});

test("treats research sources and chapters as terminal nodes", () => {
  const input = fixture();
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));

  assert.ok(resolution.sourceIds.includes("SRC-1"));
  assert.ok(!resolution.factIds.includes("CAN-SOURCE-B"));
  assert.ok(!resolution.factIds.includes("CAN-CHAPTER-B"));
});

test("enforces two-hop traversal and deterministic ordering", () => {
  const input = fixture();
  const graph = buildStoryGraph(input);
  const first = resolveDraftingGraphContext(graph, currentPacket(input));
  const second = resolveDraftingGraphContext(graph, currentPacket(input));

  assert.deepEqual(second, first);
  assert.ok(!first.factIds.includes("CAN-J"));
  assert.ok(first.selections.every((item) => item.depth <= 2));
});

test("preserves explicitly referenced provisional records", () => {
  const input = fixture();
  const packet = currentPacket(input);
  packet.continuity_refs.push("CAN-P");

  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), packet);

  assert.ok(resolution.factIds.includes("CAN-P"));
  assert.equal(resolution.selections.find((item) => item.refId === "CAN-P")?.reason, "explicit");
  assert.ok(!resolution.blocked.some((item) => item.refId === "CAN-P"));
});

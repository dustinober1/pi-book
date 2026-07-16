import test from "node:test";
import assert from "node:assert/strict";
import { buildStoryGraph, resolveDraftingGraphContext, type StoryGraphInput } from "../src/context/story-graph.js";
import { completePlot, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function fixture(): StoryGraphInput {
  return {
    bookId: "book-01",
    canon: {
      schema_version: "1.0.0",
      facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access", source: "chapter-01", status: "locked", introduced_in: "book-01" }],
      relationships: [],
    },
    threads: {
      schema_version: "1.0.0",
      threads: [{ id: "ST-001", type: "mystery", setup: "missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
    },
    queue: queueFixture(),
    plot: completePlot(),
    sources: sourcesFixture(),
    research: researchFixture(),
  };
}

function packet(input: StoryGraphInput) {
  const value = input.queue.packets.find((item) => item.chapter === 2);
  assert.ok(value);
  return value;
}

test("explicit ready research selects the claim and discovers supporting sources", () => {
  const input = fixture();
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), packet(input));
  assert.deepEqual(resolution.researchIds, ["RES-001"]);
  assert.deepEqual(resolution.sourceIds, ["SRC-001"]);
  assert.ok(!resolution.researchIds.includes("RES-002"));
});

test("research sources remain terminal and cannot pull another claim", () => {
  const input = fixture();
  input.sources.sources[0]!.supports_research_ids = ["RES-001", "RES-002"];
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), packet(input));
  assert.deepEqual(resolution.researchIds, ["RES-001"]);
});

test("legacy source IDs preserve explicit source behavior", () => {
  const input = fixture();
  packet(input).required_research = ["SRC-001"];
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), packet(input));
  assert.ok(resolution.sourceIds.includes("SRC-001"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import { StoryThreadsSchema } from "../src/domain/schemas.js";
import {
  StoryThreadsV2Schema,
  normalizeStoryThreads,
} from "../src/domain/story-thread-v2.js";

const legacy = {
  schema_version: "1.0.0" as const,
  threads: [{
    id: "THREAD-LEDGER",
    type: "mystery",
    setup: "Someone accessed the terminal first.",
    reader_knows: "The access log is wrong.",
    characters_know: { "CHAR-MARA": "Mara knows the terminal was used." },
    status: "advanced" as const,
    intended_payoff: "Reveal the prior user.",
    last_advanced_in: "book-01/chapter-003",
  }],
};

test("story-thread schema one remains valid and normalizes without changing legacy meaning", () => {
  assert.equal(Value.Check(StoryThreadsSchema, legacy), true);
  const normalized = normalizeStoryThreads(legacy);
  assert.equal(normalized.schema_version, "2.0.0");
  assert.equal(Value.Check(StoryThreadsV2Schema, normalized), true);
  assert.deepEqual(normalized.threads[0], {
    ...legacy.threads[0],
    priority: "normal",
    opened_in: null,
    last_touched_in: 3,
    next_required_touch: null,
    payoff_window: { earliest_chapter: null, latest_chapter: null },
    dependent_thread_ids: [],
    participating_entity_ids: ["CHAR-MARA"],
    reader_knowledge_state: legacy.threads[0].reader_knows,
    character_knowledge_refs: [],
  });
});

test("story-thread schema two carries scheduling, dependency, entity, and knowledge metadata", () => {
  const state = {
    schema_version: "2.0.0" as const,
    threads: [{
      ...legacy.threads[0],
      priority: "high" as const,
      opened_in: 1,
      last_touched_in: 3,
      next_required_touch: 6,
      payoff_window: { earliest_chapter: 8, latest_chapter: 10 },
      dependent_thread_ids: ["THREAD-ACCESS"],
      participating_entity_ids: ["CHAR-MARA", "OBJ-LEDGER"],
      reader_knowledge_state: "The reader suspects a protected user.",
      character_knowledge_refs: ["KNOW-MARA-ACCESS"],
    }],
  };
  assert.equal(Value.Check(StoryThreadsSchema, state), true);
  assert.equal(Value.Check(StoryThreadsV2Schema, state), true);
  assert.deepEqual(normalizeStoryThreads(state), state);
});

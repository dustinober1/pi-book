import test from "node:test";
import assert from "node:assert/strict";
import { compileLegacyChapterContract } from "../src/application/contracts/chapter-contract-compiler.js";
import { scheduleStoryThreads } from "../src/application/thread-scheduler.js";
import type { StoryThreadsV2State } from "../src/domain/story-thread-v2.js";

function thread(input: Partial<StoryThreadsV2State["threads"][number]> & Pick<StoryThreadsV2State["threads"][number], "id">): StoryThreadsV2State["threads"][number] {
  return {
    id: input.id,
    type: input.type ?? "mystery",
    setup: input.setup ?? input.id,
    reader_knows: input.reader_knows ?? "",
    characters_know: input.characters_know ?? {},
    status: input.status ?? "open",
    intended_payoff: input.intended_payoff ?? null,
    last_advanced_in: input.last_advanced_in ?? null,
    priority: input.priority ?? "normal",
    opened_in: input.opened_in ?? 1,
    last_touched_in: input.last_touched_in ?? 1,
    next_required_touch: input.next_required_touch ?? null,
    payoff_window: input.payoff_window ?? { earliest_chapter: null, latest_chapter: null },
    dependent_thread_ids: input.dependent_thread_ids ?? [],
    participating_entity_ids: input.participating_entity_ids ?? [],
    reader_knowledge_state: input.reader_knowledge_state ?? "",
    character_knowledge_refs: input.character_knowledge_refs ?? [],
  };
}

const threads: StoryThreadsV2State = {
  schema_version: "2.0.0",
  threads: [
    thread({ id: "THREAD-EXPLICIT", last_touched_in: 5 }),
    thread({ id: "THREAD-OVERDUE", priority: "high", last_touched_in: 2, next_required_touch: 4 }),
    thread({ id: "THREAD-STARVING", priority: "high", status: "advanced", last_touched_in: 1 }),
    thread({ id: "THREAD-DUE", priority: "low", last_touched_in: 5, next_required_touch: 6 }),
    thread({ id: "THREAD-BLOCKED", priority: "critical", last_touched_in: 1, next_required_touch: 3, dependent_thread_ids: ["THREAD-DEPENDENCY"] }),
    thread({ id: "THREAD-DEPENDENCY", status: "planned" }),
    thread({ id: "THREAD-PAID", status: "paid-off", last_touched_in: 5 }),
  ],
};

test("thread scheduler selects a bounded explicit, overdue, and starving set instead of every open thread", () => {
  const result = scheduleStoryThreads({
    threads,
    chapter: 6,
    explicitThreadIds: ["THREAD-EXPLICIT"],
    maximumActiveThreads: 3,
    starvationLimitChapters: 4,
  });
  assert.deepEqual(result.active_thread_ids, ["THREAD-EXPLICIT", "THREAD-OVERDUE", "THREAD-STARVING"]);
  assert.equal(result.active_thread_ids.includes("THREAD-DUE"), false);
  assert.equal(result.active_thread_ids.includes("THREAD-BLOCKED"), false);
  assert.equal(result.active_thread_ids.includes("THREAD-PAID"), false);
  assert.ok(result.deferred_thread_ids.includes("THREAD-DUE"));
  assert.ok(result.findings.some((item) => item.code === "thread-overdue" && item.thread_id === "THREAD-OVERDUE"));
  assert.ok(result.findings.some((item) => item.code === "thread-starving" && item.thread_id === "THREAD-STARVING"));
  assert.ok(result.findings.some((item) => item.code === "thread-dependency-blocked" && item.thread_id === "THREAD-BLOCKED"));
  assert.ok(result.selection_reasons["THREAD-EXPLICIT"]?.includes("explicit"));
});

test("thread scheduler refuses an explicit set larger than the chapter capacity", () => {
  assert.throws(() => scheduleStoryThreads({
    threads,
    chapter: 6,
    explicitThreadIds: ["THREAD-EXPLICIT", "THREAD-OVERDUE"],
    maximumActiveThreads: 1,
  }), /explicit thread count.*capacity/i);
});

test("legacy contract compilation consumes a bounded schedule without dropping packet threads", () => {
  const packet = {
    chapter: 6,
    title: "The Ledger",
    status: "ready" as const,
    pov: "CHAR-MARA",
    purpose: "Recover the ledger.",
    scene_engine: "Access fails.",
    pressure_movement: "Security closes in.",
    character_movement: "Mara chooses evidence.",
    relationship_movement: "Trust narrows.",
    story_thread_refs: ["THREAD-EXPLICIT"],
    continuity_refs: ["STATE-MARA-LOCATION"],
    character_refs: ["CHAR-MARA"],
    required_research: [],
    profile_fields: {},
    ending_hook: "The protected user moves.",
    milestone_gate: null,
    target_words: 1800,
  };
  const contract = compileLegacyChapterContract(packet, {
    activeThreadIds: ["THREAD-EXPLICIT", "THREAD-OVERDUE"],
  });
  assert.deepEqual(contract.active_thread_ids, ["THREAD-EXPLICIT", "THREAD-OVERDUE"]);
  assert.ok(contract.required_record_ids.includes("THREAD-OVERDUE"));
  assert.throws(() => compileLegacyChapterContract(packet, {
    activeThreadIds: ["THREAD-OVERDUE"],
  }), /schedule omitted explicit packet thread THREAD-EXPLICIT/i);
});

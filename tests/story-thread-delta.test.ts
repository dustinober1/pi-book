import test from "node:test";
import assert from "node:assert/strict";
import { applyAcceptedThreadChanges } from "../src/application/story-thread-delta.js";
import type { StoryThreadsV2State } from "../src/domain/story-thread-v2.js";

function state(status: StoryThreadsV2State["threads"][number]["status"] = "planned"): StoryThreadsV2State {
  return {
    schema_version: "2.0.0",
    threads: [{
      id: "THREAD-ACCESS", type: "mystery", setup: "The access record is wrong.", reader_knows: "The log is wrong.", characters_know: {},
      status, intended_payoff: "Identify the user.", last_advanced_in: null, priority: "high", opened_in: null,
      last_touched_in: null, next_required_touch: 3, payoff_window: { earliest_chapter: 4, latest_chapter: 8 },
      dependent_thread_ids: [], participating_entity_ids: [], reader_knowledge_state: "The log is wrong.", character_knowledge_refs: [],
    }],
  };
}

const evidence = "The terminal proves the access record was altered.";

test("accepted opened, advanced, and resolved changes update thread chronology deterministically", () => {
  const opened = applyAcceptedThreadChanges(state(), [{ thread_id: "THREAD-ACCESS", operation: "opened", description: "The investigation opens.", evidence_quote: evidence }], { bookId: "book-01", chapter: 2 });
  assert.equal(opened.threads[0]?.status, "open");
  assert.equal(opened.threads[0]?.opened_in, 2);
  assert.equal(opened.threads[0]?.last_touched_in, 2);
  assert.equal(opened.threads[0]?.last_advanced_in, "book-01/chapter-002");
  assert.equal(opened.threads[0]?.next_required_touch, null);

  const advanced = applyAcceptedThreadChanges(opened, [{ thread_id: "THREAD-ACCESS", operation: "advanced", description: "New evidence appears.", evidence_quote: evidence }], { bookId: "book-01", chapter: 3 });
  assert.equal(advanced.threads[0]?.status, "advanced");
  assert.equal(advanced.threads[0]?.opened_in, 2);
  assert.equal(advanced.threads[0]?.last_touched_in, 3);
  assert.equal(advanced.threads[0]?.last_advanced_in, "book-01/chapter-003");

  const resolved = applyAcceptedThreadChanges(advanced, [{ thread_id: "THREAD-ACCESS", operation: "resolved", description: "The user is identified.", evidence_quote: evidence }], { bookId: "book-01", chapter: 4 });
  assert.equal(resolved.threads[0]?.status, "paid-off");
  assert.equal(resolved.threads[0]?.last_touched_in, 4);
  assert.equal(resolved.threads[0]?.last_advanced_in, "book-01/chapter-004");
});

test("thread transitions reject unknown IDs, terminal changes, and lifecycle regression", () => {
  assert.throws(() => applyAcceptedThreadChanges(state(), [{ thread_id: "THREAD-MISSING", operation: "advanced", description: "No.", evidence_quote: evidence }], { bookId: "book-01", chapter: 2 }), /unknown story thread.*THREAD-MISSING/i);
  assert.throws(() => applyAcceptedThreadChanges(state("paid-off"), [{ thread_id: "THREAD-ACCESS", operation: "advanced", description: "No.", evidence_quote: evidence }], { bookId: "book-01", chapter: 5 }), /paid-off|resolved|cannot advance/i);
  assert.throws(() => applyAcceptedThreadChanges(state("advanced"), [{ thread_id: "THREAD-ACCESS", operation: "opened", description: "No.", evidence_quote: evidence }], { bookId: "book-01", chapter: 5 }), /cannot reopen|already advanced|lifecycle/i);
});

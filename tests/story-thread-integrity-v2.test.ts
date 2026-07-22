import test from "node:test";
import assert from "node:assert/strict";
import { canonicalStoryFindings } from "../src/application/canonical-story-integrity.js";
import type { StoryThreadsV2State } from "../src/domain/story-thread-v2.js";

const threads: StoryThreadsV2State = {
  schema_version: "2.0.0",
  threads: [{
    id: "THREAD-ACCESS",
    type: "mystery",
    setup: "Access was falsified.",
    reader_knows: "The log is wrong.",
    characters_know: { "CHAR-MARA": "Mara knows the log is wrong." },
    status: "open",
    intended_payoff: "Reveal the prior user.",
    last_advanced_in: "book-01/chapter-003",
    priority: "high",
    opened_in: 2,
    last_touched_in: 3,
    next_required_touch: 6,
    payoff_window: { earliest_chapter: 10, latest_chapter: 8 },
    dependent_thread_ids: ["THREAD-MISSING"],
    participating_entity_ids: ["CHAR-MISSING"],
    reader_knowledge_state: "The reader suspects a protected user.",
    character_knowledge_refs: ["KNOW-MISSING"],
  }],
};

test("story-thread v2 references and payoff windows are validated against canonical records", () => {
  const findings = canonicalStoryFindings({
    entities: {
      schema_version: "1.0.0",
      entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
    },
    state: { schema_version: "1.0.0", records: [] },
    knowledge: { schema_version: "1.0.0", records: [] },
    canon: { schema_version: "1.0.0", facts: [], relationships: [] },
    threads,
    research: { schema_version: "1.0.0", items: [] },
    plot: { schema_version: "1.0.0", acts: [], chapters: [], decisions: [] },
  });
  assert.ok(findings.some((item) => item.code === "unknown-thread-dependency" && item.record_ids.includes("THREAD-MISSING")));
  assert.ok(findings.some((item) => item.code === "unknown-thread-entity" && item.record_ids.includes("CHAR-MISSING")));
  assert.ok(findings.some((item) => item.code === "unknown-thread-knowledge" && item.record_ids.includes("KNOW-MISSING")));
  assert.ok(findings.some((item) => item.code === "invalid-thread-payoff-window" && item.record_ids.includes("THREAD-ACCESS")));
});

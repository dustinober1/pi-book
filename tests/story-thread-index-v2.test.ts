import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStoryRecordIndex, rebuildStoryRecordIndex } from "../src/application/rebuild-story-index.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";


test("story record index carries story-thread v2 dependency, entity, and knowledge edges", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-thread-index-v2-"));
  const root = initializeProject(parent, { projectName: "Thread Index V2", projectType: "standalone", profile: "thriller" });
  try {
    writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      entities: [
        { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
        { id: "OBJ-LEDGER", category: "object", display_name: "Ledger", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
      ],
    }), "utf8");
    writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      records: [{ id: "KNOW-MARA-ACCESS", knower_id: "CHAR-MARA", fact_id: "SECRET-ACCESS", knowledge: "known", status: "accepted-manuscript-fact", source: "chapter-01", introduced_in: "chapter-01", evidence_ids: ["C01-P001"] }],
    }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
      schema_version: "2.0.0",
      threads: [
        {
          id: "THREAD-ACCESS", type: "mystery", setup: "Access was falsified.", reader_knows: "The log is wrong.", characters_know: { "CHAR-MARA": "Mara knows." },
          status: "advanced", intended_payoff: "Reveal the prior user.", last_advanced_in: "book-01/chapter-003",
          priority: "high", opened_in: 1, last_touched_in: 3, next_required_touch: 6,
          payoff_window: { earliest_chapter: 8, latest_chapter: 10 }, dependent_thread_ids: ["THREAD-IDENTITY"],
          participating_entity_ids: ["CHAR-MARA", "OBJ-LEDGER"], reader_knowledge_state: "The reader suspects protection.", character_knowledge_refs: ["KNOW-MARA-ACCESS"],
        },
        {
          id: "THREAD-IDENTITY", type: "identity", setup: "The user is hidden.", reader_knows: "Someone is protected.", characters_know: {},
          status: "open", intended_payoff: "Name the user.", last_advanced_in: null,
          priority: "normal", opened_in: 1, last_touched_in: 1, next_required_touch: null,
          payoff_window: { earliest_chapter: null, latest_chapter: null }, dependent_thread_ids: [], participating_entity_ids: [],
          reader_knowledge_state: "The identity is unknown.", character_knowledge_refs: [],
        },
      ],
    }), "utf8");

    rebuildStoryRecordIndex(root);
    const record = readStoryRecordIndex(root).records.find((item) => item.id === "THREAD-ACCESS");
    assert.equal(record?.kind, "story-thread");
    assert.deepEqual(record?.dependencies, ["CHAR-MARA", "KNOW-MARA-ACCESS", "OBJ-LEDGER", "THREAD-IDENTITY"]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

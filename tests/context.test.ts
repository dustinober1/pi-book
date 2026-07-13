import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject } from "../src/project/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { buildChapterContext } from "../src/context/context-builder.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-context-")); }

test("chapter context includes referenced canon and excludes unrelated facts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Context Test", projectType: "planned-series", profile: "thriller" });
    const book = join(root, "books", "book-01");
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [
      { id: "CAN-1", category: "injury", subject: "Mara", fact: "left wrist sprained", source: "chapter-01", status: "locked", introduced_in: "book-01" },
      { id: "CAN-2", category: "secret", subject: "Unrelated", fact: "future book fact", source: "plan", status: "provisional", introduced_in: null },
    ], relationships: [] }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [
      { id: "ST-1", type: "mystery", setup: "missing device", reader_knows: "stolen", characters_know: { lead: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null },
      { id: "ST-2", type: "future", setup: "unrelated", reader_knows: "none", characters_know: {}, status: "planned", intended_payoff: "book-03", last_advanced_in: null },
    ] }), "utf8");
    writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, act: "I", causality: "therefore", state_change: "door locks", setup_ids: ["ST-1"], payoff_ids: [], profile_obligations: [] }] }), "utf8");
    writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "Act I", packets: [{
      chapter: 1, title: "Locked Room", status: "ready", pov: "Mara", purpose: "force escape", scene_engine: "physical pursuit",
      pressure_movement: "threat enters room", character_movement: "Mara chooses evidence over safety", relationship_movement: "",
      story_thread_refs: ["ST-1"], continuity_refs: ["CAN-1"], character_refs: ["Mara"], required_research: [],
      profile_fields: { threat_delta: "+2", evidence_delta: "EV-1", reader_forecast_change: "inside job", protagonist_choice: "stays" },
      ending_hook: "second lock engages", milestone_gate: "first-chapter-approval", target_words: 2500,
    }] }), "utf8");
    const context = buildChapterContext(root);
    assert.match(context.text, /CAN-1/);
    assert.doesNotMatch(context.text, /CAN-2/);
    assert.match(context.text, /ST-1/);
    assert.doesNotMatch(context.text, /ST-2/);
    assert.ok(context.report.excluded.includes("future books"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function packet(overrides: Record<string, unknown> = {}) {
  return {
    chapter: 2, title: "Second", status: "ready", pov: "lead", purpose: "escalate",
    scene_engine: "field operation", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "trust changes", story_thread_refs: ["ST-001"], continuity_refs: ["CAN-001"],
    character_refs: ["lead"], required_research: ["SRC-001"], profile_fields: {
      threat_delta: "+1", evidence_delta: "EV-2 gained", reader_forecast_change: "inside help", protagonist_choice: "continues",
    }, ending_hook: "new danger", milestone_gate: null, target_words: 2000, ...overrides,
  };
}

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-context-hardening-"));
  const root = initializeProject(parent, { projectName: "Context", projectType: "standalone", profile: "thriller" });
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [{ id: "CAN-001", category: "fact", subject: "lead", fact: "known", source: "book", status: "locked", introduced_in: "book-01" }], relationships: [] }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [{ id: "ST-001", type: "mystery", setup: "x", reader_knows: "little", characters_know: {}, status: "open", intended_payoff: "book-01", last_advanced_in: null }] }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({ schema_version: "1.0.0", sources: [{ id: "SRC-001", type: "expert", title: "source", location: "notes", verified_on: null, supports: ["chapter-02"], notes: "" }] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 2, act: "act-1", causality: "therefore", state_change: "changed", setup_ids: [], payoff_ids: [], profile_obligations: [] }] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-1", packets: [packet()] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# One\n\nPREVIOUS-CHAPTER-MARKER", "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "09-future.md"), "# Nine\n\nFUTURE-CHAPTER-MARKER", "utf8");
  return { parent, root };
}

test("chapter context selects the actual preceding chapter and preserves it under the budget", () => {
  const { parent, root } = setup();
  try {
    const context = buildChapterContext(root, 2, 5000);
    assert.match(context.text, /PREVIOUS-CHAPTER-MARKER/);
    assert.doesNotMatch(context.text, /FUTURE-CHAPTER-MARKER/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing canon, research, and closed thread references block drafting", () => {
  const { parent, root } = setup();
  try {
    const queuePath = join(root, "books", "book-01", "chapter-queue.yaml");
    writeFileSync(queuePath, stringifyYaml({ schema_version: "1.0.0", active_window: "x", packets: [packet({ continuity_refs: ["CAN-MISSING"] })] }), "utf8");
    assert.throws(() => buildChapterContext(root, 2), /CAN-MISSING/);
    writeFileSync(queuePath, stringifyYaml({ schema_version: "1.0.0", active_window: "x", packets: [packet({ required_research: ["SRC-MISSING"] })] }), "utf8");
    assert.throws(() => buildChapterContext(root, 2), /SRC-MISSING/);
    writeFileSync(queuePath, stringifyYaml({ schema_version: "1.0.0", active_window: "x", packets: [packet()] }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [{ id: "ST-001", type: "mystery", setup: "x", reader_knows: "all", characters_know: {}, status: "paid-off", intended_payoff: "book-01", last_advanced_in: "chapter-01" }] }), "utf8");
    assert.throws(() => buildChapterContext(root, 2), /paid-off|closed/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

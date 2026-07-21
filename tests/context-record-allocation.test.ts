import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContextBudgetError } from "../src/context/context-budget.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-context-records-"));
  const root = initializeProject(parent, { projectName: "Context Records", projectType: "standalone", profile: "thriller" });
  const book = join(root, "books", "book-01");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{
      id: "CAN-001",
      category: "injury",
      subject: "Mara",
      fact: `The left wrist is sprained. ${"specific detail ".repeat(35)}CANON-END-MARKER`,
      source: "chapter-01",
      status: "locked",
      introduced_in: "book-01",
    }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{
      id: "ST-001",
      type: "mystery",
      setup: "The evacuation log changed.",
      reader_knows: "The record is unreliable.",
      characters_know: { Mara: "The timestamp moved." },
      status: "open",
      intended_payoff: "book-01",
      last_advanced_in: "chapter-01",
    }],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({ schema_version: "1.0.0", sources: [] }), "utf8");
  writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 2, act: "I", causality: "therefore", state_change: "Mara stays", setup_ids: ["ST-001"], payoff_ids: [], profile_obligations: [] }],
    decisions: [],
  }), "utf8");
  writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "Act I",
    packets: [{
      chapter: 2,
      title: "Second Lock",
      status: "ready",
      pov: "Mara",
      purpose: "force a choice between escape and evidence",
      scene_engine: "physical pursuit",
      pressure_movement: "the second exit seals",
      character_movement: "Mara stays for the log",
      relationship_movement: "",
      story_thread_refs: ["ST-001"],
      continuity_refs: ["CAN-001"],
      character_refs: ["Mara"],
      required_research: [],
      profile_fields: { threat_delta: "+2", evidence_delta: "EV-002", reader_forecast_change: "inside help", protagonist_choice: "stays" },
      ending_hook: "the timestamp changes again",
      milestone_gate: null,
      target_words: 2500,
    }],
  }), "utf8");
  writeFileSync(join(book, "manuscript", "chapters", "01-opening.md"), [
    "# Chapter 1",
    "",
    `PREVIOUS-LARGE-START ${"older context ".repeat(260)}`,
    "",
    "TAIL-PARAGRAPH-COMPLETE",
  ].join("\n"), "utf8");
  return { parent, root };
}

test("chapter context preserves complete structured records and reports exact allocation", () => {
  const { parent, root } = setup();
  try {
    const limit = 5_000;
    const context = buildChapterContext(root, 2, limit);
    assert.ok(context.text.length <= limit);
    assert.match(context.text, /CAN-001/);
    assert.match(context.text, /CANON-END-MARKER/);
    assert.match(context.text, /ST-001/);
    assert.match(context.text, /TAIL-PARAGRAPH-COMPLETE/);
    assert.doesNotMatch(context.text, /PREVIOUS-LARGE-START/);
    assert.ok(context.report.allocation.includedRecordIds.includes("CAN-001"));
    assert.ok(context.report.allocation.includedRecordIds.includes("ST-001"));
    assert.ok(context.report.allocation.includedRecordIds.includes("previous:paragraph:0003"));
    assert.ok(context.report.allocation.omittedRecordIds.includes("previous:paragraph:0002"));
    assert.equal(context.report.allocation.characters, context.text.length - `# Drafting Context — Chapter 2`.length);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("chapter context overflow stops before inference and names missing required IDs", () => {
  const { parent, root } = setup();
  try {
    assert.throws(
      () => buildChapterContext(root, 2, 200),
      (error: unknown) => {
        assert.ok(error instanceof ContextBudgetError);
        for (const id of ["chapter-packet:2", "CAN-001", "ST-001", "plot:chapter:2"]) {
          assert.ok(error.requiredRecordIds.includes(id), `missing required overflow ID ${id}`);
        }
        return true;
      },
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

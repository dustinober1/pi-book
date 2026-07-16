import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function setup(stage: "book-planning" | "chapter-queue") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase4-event-"));
  const root = initializeProject(parent, { projectName: "Phase 4 Event", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access", source: "chapter-01", status: "locked", introduced_in: "book-01" }], relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0", threads: [{ id: "ST-001", type: "mystery", setup: "missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml(sourcesFixture()), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml(researchFixture()), "utf8");
  return { parent, root };
}

function validRemarkability() {
  return {
    schema_version: "1.0.0", safe_obvious_version: "A routine archive mystery", author_only_advantage: "Institutional intimacy",
    productive_discomfort: "The right choice has a cost", retellable_hook: "The archive records choices before they occur",
    signature_moments: [
      { id: "SIG-001", description: "Mara opens the predictive ledger", intended_reader_memory: "the impossible entry", planned_location: "chapter-2", status: "planned" },
      { id: "SIG-002", description: "Mara burns her own clearance", intended_reader_memory: "the costly choice", planned_location: "chapter-4", status: "planned" },
    ],
    productive_disagreements: [{ question: "Was the breach justified?", competing_readings: ["yes", "no"] }],
    recurring_motifs: [], lingering_question: "Who wrote the first entry?", hand_sell_reason: "A fair-play institutional mystery", accepted_reader_costs: ["procedural density"],
  };
}

function bookPlanFiles(root: string, strategy = completeStrategy(), plot = completePlot()) {
  const bookRoot = join(root, "books", "book-01");
  return [
    { path: "books/book-01/book-bible.md", content: readFileSync(join(bookRoot, "book-bible.md"), "utf8") },
    { path: "books/book-01/genre.yaml", content: readFileSync(join(bookRoot, "genre.yaml"), "utf8") },
    { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(plot) },
    { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
    { path: "books/book-01/continuity-delta.yaml", content: readFileSync(join(bookRoot, "continuity-delta.yaml"), "utf8") },
    { path: "books/book-01/remarkability.yaml", content: stringifyYaml(validRemarkability()) },
    { path: "books/book-01/research-ledger.yaml", content: stringifyYaml(researchFixture()) },
    { path: "books/book-01/book-strategy.yaml", content: stringifyYaml(strategy) },
    { path: "research/source-register.yaml", content: stringifyYaml(sourcesFixture()) },
    { path: "series/story-threads.yaml", content: readFileSync(join(root, "series", "story-threads.yaml"), "utf8") },
  ];
}

test("book-plan rejects an unresolved stress test", () => {
  const { parent, root } = setup("book-planning");
  try {
    const strategy = completeStrategy();
    strategy.plan_stress_test![0]!.status = "pending";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: bookPlanFiles(root, strategy),
    }), /early-genre-promise remains pending/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("book-plan rejects an invalid decision payoff window", () => {
  const { parent, root } = setup("book-planning");
  try {
    const plot = completePlot();
    plot.decisions![0]!.payoff_window = { start_chapter: 1, end_chapter: 1 };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: bookPlanFiles(root, completeStrategy(), plot),
    }), /payoff/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter queue rejects a ready packet whose research item is unready", () => {
  const { parent, root } = setup("chapter-queue");
  try {
    writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml(researchFixture("researching")), "utf8");
    assert.throws(() => applyNovelEvent(root, {
      eventType: "chapter-queue", expectedStage: "chapter-queue", expectedProjectHash: projectStateHash(root),
      files: [
        { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
        { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(completePlot()) },
      ],
    }), /not ready/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";
import { learningStrategy, recurrenceTickets } from "./phase5-fixtures.js";

function setup(parent: string, stage: "drafting" | "act-review" | "manuscript-review" = "drafting") {
  const root = initializeProject(parent, { projectName: "Phase 5 Integration", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access", source: "chapter-01", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml(sourcesFixture()), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml(researchFixture()), "utf8");
  writeFileSync(join(root, "books", "book-01", "book-strategy.yaml"), stringifyYaml(learningStrategy("proposed", true)), "utf8");
  writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml({ schema_version: "1.0.0", tickets: [] }), "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: [], prefer: [], avoid: [], monitor: [],
    baseline: { path: "series/voice-experiments/VE-001/baseline.md", content_hash: "a".repeat(64), metrics: { dialogue_ratio: 0.25, average_sentence_words: 8 } },
    pov_signatures: [],
  }), "utf8");
  return root;
}

function architecture(root: string, chapter: number, engine = "search") {
  const queue = structuredClone(queueFixture());
  const packet = queue.packets[0]!;
  packet.chapter = chapter;
  packet.scene_engine = engine;
  packet.status = "ready";
  const plot = structuredClone(completePlot());
  if (!plot.chapters.some((item) => item.chapter === chapter)) {
    plot.chapters.push({ chapter, act: "I", causality: "therefore", state_change: `Chapter ${chapter} changes access`, setup_ids: [], payoff_ids: [], profile_obligations: [] });
  }
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(plot), "utf8");
  return { queue, plot };
}

function draft(root: string, chapter: number) {
  architecture(root, chapter);
  return applyNovelEvent(root, {
    eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter,
    files: [{ path: `books/book-01/manuscript/chapters/${String(chapter).padStart(2, "0")}-chapter.md`, content: `# Chapter ${chapter}\n\nMara watched the door.\n\n\"Move,\" Jonah said.\n\nWhy now? Her hand tightened on the file.` }],
  });
}

test("Chapter 1 and Chapter 3 append voice audits while Chapter 2 does not", () => {
  for (const [chapter, expected] of [[1, true], [2, false], [3, true]] as const) {
    const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-draft-"));
    try {
      const root = setup(parent);
      draft(root, chapter);
      const audits = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
      assert.equal(audits.includes(`chapter-${chapter}`), expected);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});

test("missing baseline skips milestone audit without blocking drafting", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-no-baseline-"));
  try {
    const root = setup(parent);
    writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
      schema_version: "1.0.0", must: [], prefer: [], avoid: [], monitor: [], baseline: { path: null, content_hash: null, metrics: {} }, pov_signatures: [],
    }), "utf8");
    assert.doesNotThrow(() => draft(root, 1));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("act review appends audit evidence and deterministic scene tickets without editing prose", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-review-"));
  try {
    const root = setup(parent, "act-review");
    const { queue, plot } = architecture(root, 1, "interview");
    const basePacket = queue.packets[0]!;
    queue.packets = [1, 2, 3].map((chapter) => ({ ...structuredClone(basePacket), chapter, scene_engine: "interview", status: "reviewed" }));
    for (const entry of plot.chapters) if ([1, 2, 3].includes(entry.chapter)) entry.state_change = "unchanged";
    writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
    writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(plot), "utf8");
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-one.md"), "# One\n\nMara asked the same questions.", "utf8");
    const before = readFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-one.md"), "utf8");
    applyNovelEvent(root, {
      eventType: "review", expectedStage: "act-review", expectedProjectHash: projectStateHash(root), scope: "act",
      files: [{ path: "books/book-01/revision-tickets.yaml", content: stringifyYaml({ schema_version: "1.0.0", tickets: [] }) }],
    });
    const tickets = readFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), "utf8");
    const audits = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
    assert.match(tickets, /scene-diversity/);
    assert.match(tickets, /act/);
    assert.match(audits, /scope: act/);
    assert.equal(readFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-one.md"), "utf8"), before);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("research-update rejects ineligible approval and accepts eligible approval without manuscript mutation", () => {
  for (const eligible of [false, true]) {
    const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-promotion-"));
    try {
      const root = setup(parent);
      writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml(recurrenceTickets(eligible)), "utf8");
      const manuscriptPath = join(root, "books", "book-01", "manuscript", "chapters", "01-existing.md");
      writeFileSync(manuscriptPath, "# Existing\n\nUntouched prose.", "utf8");
      const action = () => applyNovelEvent(root, {
        eventType: "research-update", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), scope: "guardrail-promotion",
        files: [{ path: "books/book-01/book-strategy.yaml", content: stringifyYaml(learningStrategy("approved", eligible)) }],
      });
      if (eligible) assert.doesNotThrow(action); else assert.throws(action, /eligible|threshold/i);
      assert.equal(readFileSync(manuscriptPath, "utf8"), "# Existing\n\nUntouched prose.");
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});

test("future chapter context includes approved learning guardrails only", () => {
  for (const status of ["proposed", "approved"] as const) {
    const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-context-"));
    try {
      const root = setup(parent);
      architecture(root, 2);
      writeFileSync(join(root, "books", "book-01", "book-strategy.yaml"), stringifyYaml(learningStrategy(status, true)), "utf8");
      writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml(recurrenceTickets(true)), "utf8");
      const context = buildChapterContext(root, 2);
      assert.equal(context.text.includes("Every interview must change case, relationship, power, or knowledge state."), status === "approved");
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});


test("explicit recalibration through research-update appends evidence without changing stage", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-recalibration-"));
  try {
    const root = setup(parent);
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-existing.md"), "# Existing\n\nMara watched the door.\n\n\"Move,\" Jonah said.", "utf8");
    const beforeStage = readProject(root).current_stage;
    applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      scope: "recalibration",
      files: [{
        path: "books/book-01/voice-audits.yaml",
        content: stringifyYaml({ schema_version: "1.0.0", audits: [] }),
      }],
    });
    const audits = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
    assert.match(audits, /scope: recalibration/);
    assert.equal(readProject(root).current_stage, beforeStage);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

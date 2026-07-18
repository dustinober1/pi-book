import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-event-")); }
function readyPacket() { return { chapter: 1, title: "Opening", status: "ready", pov: "lead", purpose: "begin", scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses", relationship_movement: "changes", story_thread_refs: [], continuity_refs: [], character_refs: [], required_research: [], profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" }, ending_hook: "danger", milestone_gate: null, target_words: 1000 }; }
function setup(): { parent: string; root: string } { const parent = temp(); const root = initializeProject(parent, { projectName: "Event", projectType: "standalone", profile: "thriller" }); const project = readProject(root); project.current_stage = "drafting"; project.next_gate = null; writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8"); writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, act: "act-1", causality: "therefore", state_change: "threat visible", setup_ids: [], payoff_ids: [], profile_obligations: ["midpoint state change planned"] }] }), "utf8"); writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-1", packets: [readyPacket()] }), "utf8"); return { parent, root }; }
function setupSeriesPlan(): { parent: string; root: string } { const parent = temp(); const root = initializeProject(parent, { projectName: "Series", projectType: "planned-series", profile: "thriller" }); const project = readProject(root); project.current_stage = "series-planning"; project.next_gate = null; writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8"); return { parent, root }; }
test("draft events apply through one guarded transaction and derive state", () => { const { parent, root } = setup(); try { applyNovelEvent(root, { eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content: "# Opening\n\nA specific opening under pressure." }] }); assert.ok(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"))); const project = readProject(root); const book = readBook(root); assert.equal(project.next_gate, "first-chapter-approval"); assert.equal(project.gates["first-chapter-approval"], "pending"); assert.equal(book.current_chapter, 1); assert.ok(book.actual_words > 0); assert.doesNotMatch(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), /drafted/);
    assert.match(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), /packets: \[\]/); } finally { rmSync(parent, { recursive: true, force: true }); } });
test("plot-derived act gate stops drafting at the act boundary even when the packet marker is missing", () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "drafting";
    project.gates["first-chapter-approval"] = "approved";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const plot = {
      schema_version: "1.0.0",
      acts: [{ id: "ACT-1", purpose: "entry", start_chapter: 1, end_chapter: 6, gate: "act-1-review" }, { id: "ACT-2", purpose: "pressure", start_chapter: 7, end_chapter: 7, gate: null }],
      chapters: Array.from({ length: 7 }, (_, index) => ({ chapter: index + 1, act: index < 6 ? "ACT-1" : "ACT-2", causality: "therefore", state_change: `state ${index + 1}`, setup_ids: [], payoff_ids: [], profile_obligations: [] })),
    };
    const packet = (chapter: number) => ({ ...readyPacket(), chapter, title: `Chapter ${chapter}`, milestone_gate: null });
    writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(plot), "utf8");
    writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet(6), packet(7)] }), "utf8");
    applyNovelEvent(root, { eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 6, files: [{ path: "books/book-01/manuscript/chapters/06-boundary.md", content: "# Boundary\n\nThe gate arrives." }] });
    const after = readProject(root);
    assert.equal(after.current_stage, "act-review");
    assert.equal(after.next_gate, "act-1-review");
    assert.equal(readBook(root).act_checkpoint, "act-1-review");
    assert.throws(() => applyNovelEvent(root, { eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 7, files: [{ path: "books/book-01/manuscript/chapters/07-next.md", content: "# Next\n\nBlocked." }] }), /wrong stage|act-review/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
test("event writes reject stale hashes and paths outside the event allowlist", () => { const { parent, root } = setup(); try { assert.throws(() => applyNovelEvent(root, { eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: "stale", chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content: "x" }] }), /stale|hash/i); assert.throws(() => applyNovelEvent(root, { eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 1, files: [{ path: "series/canon.yaml", content: 'schema_version: "1.0.0"\nfacts: []\nrelationships: []\n' }] }), /not allowed/i); assert.equal(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md")), false); } finally { rmSync(parent, { recursive: true, force: true }); } });
test("series-plan rejects a partial output bundle", () => { const { parent, root } = setupSeriesPlan(); try { assert.throws(() => applyNovelEvent(root, { eventType: "series-plan", expectedStage: "series-planning", expectedProjectHash: projectStateHash(root), files: [{ path: "series/series-bible.md", content: "# Series Bible\n" }] }), /missing required output.*series-arc\.yaml.*canon\.yaml.*story-threads\.yaml/i); assert.equal(readProject(root).current_stage, "series-planning"); } finally { rmSync(parent, { recursive: true, force: true }); } });
test("project hash changes when canonical series state changes", () => { const { parent, root } = setupSeriesPlan(); try { const before = projectStateHash(root); writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [{ id: "CAN-001", category: "character", subject: "Lead", fact: "The lead left home.", source: "author-interview", status: "provisional", introduced_in: "book-01" }], relationships: [] }), "utf8"); assert.notEqual(projectStateHash(root), before); } finally { rmSync(parent, { recursive: true, force: true }); } });

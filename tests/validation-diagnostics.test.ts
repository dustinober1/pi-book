import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash, validateNovelEvent } from "../src/application/events.js";
import { normalizeEventRejection, rejectionInstruction } from "../src/application/event-rejection.js";
import { schemaErrorLines } from "../src/domain/schema-errors.js";
import { RemarkabilitySchema } from "../src/domain/schemas.js";
import { ResearchLedgerSchema } from "../src/domain/v1-3-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function setup(parent: string): string {
  const root = initializeProject(parent, { projectName: "Diagnostics", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "book-planning";
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
  return root;
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

function bookPlanFiles(root: string, strategy = completeStrategy()) {
  const bookRoot = join(root, "books", "book-01");
  return [
    { path: "books/book-01/book-bible.md", content: readFileSync(join(bookRoot, "book-bible.md"), "utf8") },
    { path: "books/book-01/genre.yaml", content: readFileSync(join(bookRoot, "genre.yaml"), "utf8") },
    { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(completePlot()) },
    { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
    { path: "books/book-01/continuity-delta.yaml", content: readFileSync(join(bookRoot, "continuity-delta.yaml"), "utf8") },
    { path: "books/book-01/remarkability.yaml", content: stringifyYaml(validRemarkability()) },
    { path: "books/book-01/research-ledger.yaml", content: stringifyYaml(researchFixture()) },
    { path: "books/book-01/book-strategy.yaml", content: stringifyYaml(strategy) },
    { path: "research/source-register.yaml", content: stringifyYaml(sourcesFixture()) },
    { path: "series/story-threads.yaml", content: readFileSync(join(root, "series", "story-threads.yaml"), "utf8") },
  ];
}

test("a failed union reports the closest variant's real fields, not just the union", () => {
  const invalidItem = `schema_version: "1.0.0"
items:
  - id: RES-001
    question: "How were archive logs kept?"
    status: ready
    confidence: ""
    answer: "By hand."
    source_ids: ["SRC-001"]
`;
  let message = "";
  assert.throws(() => parseYaml(invalidItem, ResearchLedgerSchema as never, "books/book-01/research-ledger.yaml"), (error: Error) => { message = error.message; return true; });
  assert.match(message, /\/items\/0/);
  assert.doesNotMatch(message, /Expected union value/);
  assert.match(message, /closest of \d+ allowed shapes/);
  // The point of the expansion: concrete field names an author can act on.
  assert.match(message, /\/items\/0\/[a-z_]+: /);
});

test("a union of literals reports the allowed values instead of a shape mismatch", () => {
  const ledger = researchFixture();
  ledger.items[ledger.items.length - 1]!.lane = "not-a-lane" as never;
  const lines = schemaErrorLines(ResearchLedgerSchema as never, ledger);
  assert.ok(lines.some((line) => /\/lane: expected one of /.test(line) && line.includes('"story-world"')), lines.join("\n"));
});

test("schema errors name the offending property and its instance path", () => {
  const withExtraKey = { ...validRemarkability(), signature_moments: [{ ...validRemarkability().signature_moments[0]!, sensory_note: "extra" }] };
  const lines = schemaErrorLines(RemarkabilitySchema as never, withExtraKey);
  assert.deepEqual(lines, ["/signature_moments/0/sensory_note: Unexpected property"]);
});

test("schema error output is deduplicated and capped with an honest remainder", () => {
  const manyBroken = { schema_version: "1.0.0", items: Array.from({ length: 30 }, (_, index) => ({ id: `RES-${index}` })) };
  const lines = schemaErrorLines(ResearchLedgerSchema as never, manyBroken, 5);
  assert.equal(lines.length, 6);
  assert.match(lines[5]!, /^\.\.\. and \d+ more schema problems in this file\.$/);
});

test("packet findings name the chapter they came from", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-diagnostics-"));
  try {
    const root = setup(parent);
    const queue = queueFixture();
    queue.packets[0]!.pressure_movement = "";
    const files = bookPlanFiles(root).map((file) => (
      file.path === "books/book-01/chapter-queue.yaml" ? { ...file, content: stringifyYaml(queue) } : file
    ));
    let message = "";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files,
    }), (error: Error) => { message = error.message; return true; });
    assert.match(message, new RegExp(`Chapter ${queue.packets[0]!.chapter}: Thriller chapter has no pressure movement`));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("payload-fixable blockers are retryable instead of stopping automatic work", () => {
  const cases = [
    "Profile validation blocked book-plan:\n- Chapter 1: missing field",
    "Remarkability validation blocked book-plan:\n- needs two signature moments",
    "Book strategy validation blocked book-plan:\n- early-genre-promise remains pending",
    "Packet-window validation blocked chapter-queue:\n- window too wide",
    "Research and reader-friction validation blocked the event:\n- SRC-001 does not declare support for RES-009.",
    "book-plan event is missing required output: books/book-01/book-bible.md",
  ];
  for (const message of cases) {
    const detail = normalizeEventRejection(new Error(message), { currentStage: "book-planning", currentProjectHash: "hash" }).detail;
    assert.equal(detail.code, "payload-validation", message);
    assert.equal(detail.retryable, true, message);
    assert.equal(detail.requiresReload, false, message);
    assert.match(rejectionInstruction(detail, 0), /resubmit the complete required file set/i);
    assert.doesNotMatch(rejectionInstruction(detail, 0), /Stop automatic work/i);
  }
});

test("unsafe rejections still stop automatic work", () => {
  for (const message of ["Stale project hash; reload state before applying this event.", "books/book-01/x.yaml is not allowed for book-plan."]) {
    const detail = normalizeEventRejection(new Error(message), { currentStage: "book-planning", currentProjectHash: "hash" }).detail;
    assert.equal(detail.retryable, false, message);
  }
});

test("validate reports problems without applying anything", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-diagnostics-"));
  try {
    const root = setup(parent);
    const strategy = completeStrategy();
    strategy.plan_stress_test![0]!.status = "pending";
    const hashBefore = projectStateHash(root);
    const result = validateNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: hashBefore,
      files: bookPlanFiles(root, strategy).filter((file) => file.path !== "books/book-01/book-bible.md"),
    });
    assert.equal(result.valid, false);
    assert.equal(result.rejection?.retryable, true);
    assert.match(result.rejection!.message, /early-genre-promise remains pending/i);
    assert.deepEqual(result.missingRequiredPaths, ["books/book-01/book-bible.md"]);
    assert.equal(projectStateHash(root), hashBefore);
    assert.equal(readProject(root).gates["book-plan-approval"], "open");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("validate accepts a valid event and still applies nothing", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-diagnostics-"));
  try {
    const root = setup(parent);
    const hashBefore = projectStateHash(root);
    const files = bookPlanFiles(root);
    const result = validateNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: hashBefore, files,
    });
    assert.equal(result.valid, true);
    assert.equal(result.rejection, null);
    assert.deepEqual(result.missingRequiredPaths, []);
    assert.equal(projectStateHash(root), hashBefore);
    assert.equal(readProject(root).gates["book-plan-approval"], "open");

    // The same files must then apply for real, proving the dry run is the same contract.
    applyNovelEvent(root, { eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: hashBefore, files });
    assert.equal(readProject(root).gates["book-plan-approval"], "pending");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

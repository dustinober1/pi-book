import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash, requiredBookPlanPaths } from "../src/application/events.js";
import { ValidationAggregator, aggregateRejectionMessage } from "../src/application/validation-aggregate.js";
import { rejectionInstruction } from "../src/application/event-rejection.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function setup(parent: string): string {
  const root = initializeProject(parent, { projectName: "Aggregated Validation", projectType: "standalone", profile: "thriller" });
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

function bookPlanFiles(root: string, strategy = completeStrategy(), remarkability: object = validRemarkability()) {
  const bookRoot = join(root, "books", "book-01");
  return [
    { path: "books/book-01/book-bible.md", content: readFileSync(join(bookRoot, "book-bible.md"), "utf8") },
    { path: "books/book-01/genre.yaml", content: readFileSync(join(bookRoot, "genre.yaml"), "utf8") },
    { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(completePlot()) },
    { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
    { path: "books/book-01/continuity-delta.yaml", content: readFileSync(join(bookRoot, "continuity-delta.yaml"), "utf8") },
    { path: "books/book-01/remarkability.yaml", content: stringifyYaml(remarkability) },
    { path: "books/book-01/research-ledger.yaml", content: stringifyYaml(researchFixture()) },
    { path: "books/book-01/book-strategy.yaml", content: stringifyYaml(strategy) },
    { path: "research/source-register.yaml", content: stringifyYaml(sourcesFixture()) },
    { path: "series/story-threads.yaml", content: readFileSync(join(root, "series", "story-threads.yaml"), "utf8") },
  ];
}

test("the aggregator preserves a lone problem verbatim and numbers multiple problems", () => {
  assert.equal(aggregateRejectionMessage(["only problem"]), "only problem");
  const many = aggregateRejectionMessage(["first problem", "second problem"]);
  assert.match(many, /2 validation problems must all be fixed/);
  assert.match(many, /resubmit the complete required file set/i);
  assert.match(many, /1\. first problem/);
  assert.match(many, /2\. second problem/);
});

test("the aggregator deduplicates a problem reported by more than one layer", () => {
  assert.equal(aggregateRejectionMessage(["same failure", "same failure"]), "same failure");
});

test("a failed aggregator step yields undefined so later independent steps still run", () => {
  const findings = new ValidationAggregator();
  const first = findings.run(() => { throw new Error("layer one failed"); });
  const second = findings.run(() => "layer two ran");
  findings.add("layer three failed");
  assert.equal(first, undefined);
  assert.equal(second, "layer two ran");
  assert.deepEqual(findings.collected, ["layer one failed", "layer three failed"]);
  assert.equal(findings.failed, true);
  assert.throws(() => findings.throwIfAny(), /2 validation problems/);
});

test("an aggregator with no problems throws nothing", () => {
  const findings = new ValidationAggregator();
  findings.run(() => "fine");
  assert.equal(findings.failed, false);
  findings.throwIfAny();
});

test("book-plan reports missing-output, remarkability, and strategy problems in one rejection", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-aggregate-"));
  try {
    const root = setup(parent);
    const strategy = completeStrategy();
    strategy.plan_stress_test![0]!.status = "pending";
    const remarkability = { ...validRemarkability(), signature_moments: [validRemarkability().signature_moments[0]!] };
    const files = bookPlanFiles(root, strategy, remarkability).filter((file) => file.path !== "books/book-01/book-bible.md");

    let message = "";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files,
    }), (error: Error) => { message = error.message; return true; });

    assert.match(message, /book-plan event is missing required output: books\/book-01\/book-bible\.md/);
    assert.match(message, /Remarkability validation blocked book-plan/);
    assert.match(message, /at least two specific signature moments/);
    assert.match(message, /Book strategy validation blocked book-plan/);
    assert.match(message, /early-genre-promise remains pending/i);
    assert.match(message, /3 validation problems must all be fixed/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a single-layer failure still reads as one plain rejection", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-aggregate-"));
  try {
    const root = setup(parent);
    const strategy = completeStrategy();
    strategy.plan_stress_test![0]!.status = "pending";
    let message = "";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: bookPlanFiles(root, strategy),
    }), (error: Error) => { message = error.message; return true; });
    assert.match(message, /early-genre-promise remains pending/i);
    assert.doesNotMatch(message, /validation problems must all be fixed/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a complete, valid book-plan still applies", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-aggregate-"));
  try {
    const root = setup(parent);
    const result = applyNovelEvent(root, {
      eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: bookPlanFiles(root),
    });
    assert.equal(readProject(root).gates["book-plan-approval"], "pending");
    assert.ok(result.changed.length > 0);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the book-plan required set is shared and covers the historical-fiction additions", () => {
  const thriller = requiredBookPlanPaths({ book_id: "book-01", profile: "thriller" });
  const historical = requiredBookPlanPaths({ book_id: "book-01", profile: "historical-fiction" });
  for (const path of thriller) assert.ok(historical.includes(path), `${path} missing from the historical set`);
  assert.ok(thriller.includes("books/book-01/book-strategy.yaml"));
  assert.ok(historical.includes("books/book-01/historical-context.yaml"));
  assert.ok(historical.includes("books/book-01/invention-ledger.yaml"));
  assert.ok(!thriller.includes("books/book-01/historical-context.yaml"));
});

test("the retryable instruction demands the complete file set, not only the rejected payload", () => {
  const instruction = rejectionInstruction({
    code: "schema-validation", message: "example", retryable: true, requiresReload: false,
    invalidPaths: [], issues: [], currentStage: "book-planning", currentProjectHash: "hash",
  }, 0);
  assert.match(instruction, /resubmit the complete required file set/i);
  assert.match(instruction, /omitting a file that was already correct is itself a rejection/i);
  assert.doesNotMatch(instruction, /correct only the rejected payload/i);
});

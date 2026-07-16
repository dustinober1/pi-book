import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { NovelEventRejection } from "../src/application/event-rejection.js";
import { gitHeadInfo } from "../src/infrastructure/git.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
import { defaultDecisionLedger, defaultPremiseLab, type PremiseVariant } from "../src/domain/v1-4-schemas.js";

function premiseVariant(order: number): PremiseVariant {
  return {
    id: `PV-${String(order).padStart(3, "0")}`,
    order,
    title: `Engine ${order}`,
    premise: `Mara follows the signal through premise ${order}.`,
    is_raw_idea_baseline: order === 1,
    preserved_seed_elements: ["Mara", "signal"],
    story_engine: `engine-${order}`,
    central_final_page_question: `What does Mara choose in version ${order}?`,
    immediate_gain: `Gain ${order}`,
    deferred_cost: `Cost ${order}`,
    irreversible_effect: `Effect ${order}`,
    differentiation: `Difference ${order}`,
    series_potential: `Potential ${order}`,
    accepted_tradeoffs: [`Tradeoff ${order}`],
    diagnostics: [`Observation ${order}`],
  };
}

function populatedLab() {
  const lab = defaultPremiseLab("book-01");
  lab.raw_idea = "Mara follows a signal no one else can hear.";
  lab.seed_elements = ["Mara", "signal"];
  lab.variants = [1, 2, 3].map(premiseVariant);
  return lab;
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-premise-event-"));
  const root = initializeProject(parent, { projectName: "Premise Event", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "book-planning";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return { parent, root };
}

function expectRejection(run: () => unknown, code: string): NovelEventRejection {
  try { run(); } catch (error) {
    assert.ok(error instanceof NovelEventRejection);
    assert.equal(error.detail.code, code);
    return error;
  }
  assert.fail(`Expected ${code} rejection.`);
}

test("new books seed an empty premise lab", () => {
  const { parent, root } = setup();
  try {
    const path = join(root, "books", "book-01", "premise-lab.yaml");
    assert.equal(existsSync(path), true);
    assert.match(readFileSync(path, "utf8"), /book_id: book-01/);
    assert.match(readFileSync(path, "utf8"), /variants: \[\]/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("premise-update saves comparison evidence without changing creative state", () => {
  const { parent, root } = setup();
  try {
    const projectBefore = structuredClone(readProject(root));
    const bookBefore = structuredClone(readBook(root));
    const hashBefore = projectStateHash(root);
    const result = applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: hashBefore,
      files: [{ path: "books/book-01/premise-lab.yaml", content: stringifyYaml(populatedLab()) }],
    });
    assert.equal(result.stage, "book-planning");
    assert.notEqual(result.projectHash, hashBefore);
    assert.deepEqual(readProject(root), projectBefore);
    assert.deepEqual(readBook(root), bookBefore);
    assert.match(gitHeadInfo(root)?.subject ?? "", /^Novel Forge: premise-update/);
    assert.deepEqual(readdirSync(join(root, "books", "book-01", "manuscript", "chapters")), []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("premise-update atomically validates selection against the decision ledger", () => {
  const { parent, root } = setup();
  try {
    const lab = populatedLab();
    lab.selected_variant_id = "PV-002";
    lab.selection_decision_id = "DEC-001";
    const invalid = expectRejection(() => applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/premise-lab.yaml", content: stringifyYaml(lab) }],
    }), "schema-validation");
    assert.match(invalid.message, /premise/i);

    const ledger = defaultDecisionLedger();
    ledger.decisions.push({ id: "DEC-001", scope: "book-01", subject: "premise-selection", choice: "PV-002", decidedAt: "2026-07-16T12:00:00Z", evidenceRefs: ["writer selection"], replaces: null });
    const result = applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: "books/book-01/premise-lab.yaml", content: stringifyYaml(lab) },
        { path: "series/decision-ledger.yaml", content: stringifyYaml(ledger) },
      ],
    });
    assert.equal(result.changed.includes("books/book-01/premise-lab.yaml"), true);
    assert.equal(result.changed.includes("series/decision-ledger.yaml"), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("premise-update rejects wrong stages empty unsafe inactive and malformed submissions", () => {
  const { parent, root } = setup();
  try {
    assert.throws(() => applyNovelEvent(root, { eventType: "premise-update", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: [] }), /at least one/i);
    for (const path of [
      "PROJECT.yaml",
      "books/book-01/BOOK.yaml",
      "books/book-02/premise-lab.yaml",
      "books/book-01/manuscript/chapters/01.md",
      "books/book-01/reader-experiments.yaml",
      "books/book-01/publishing.yaml",
      "books/book-01/marketing.yaml",
      "STATUS.md",
      "HANDOFF.md",
    ]) expectRejection(() => applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files: [{ path, content: path.endsWith(".yaml") ? "schema_version: 1.0.0\n" : "forbidden" }],
    }), "allowlist-violation");

    const malformed = expectRejection(() => applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/premise-lab.yaml", content: "schema_version: [\n" }],
    }), "schema-validation");
    assert.deepEqual(malformed.detail.invalidPaths, ["books/book-01/premise-lab.yaml"]);

    expectRejection(() => applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "book-planning",
      expectedProjectHash: "stale",
      files: [{ path: "books/book-01/premise-lab.yaml", content: stringifyYaml(populatedLab()) }],
    }), "stale-project-hash");

    const project = readProject(root);
    project.current_stage = "drafting";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    expectRejection(() => applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/premise-lab.yaml", content: stringifyYaml(populatedLab()) }],
    }), "wrong-stage");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

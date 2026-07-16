import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { NovelEventRejection } from "../src/application/event-rejection.js";
import { defaultDecisionLedger, defaultIntake } from "../src/domain/v1-4-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { gitHeadInfo } from "../src/infrastructure/git.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-intake-event-"));
  const root = initializeProject(parent, { projectName: "Intake Event", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

function rejection(run: () => unknown, code: string): NovelEventRejection {
  try { run(); } catch (error) {
    assert.ok(error instanceof NovelEventRejection);
    assert.equal(error.detail.code, code);
    return error;
  }
  assert.fail(`Expected ${code} rejection.`);
}

test("intake-update is state-neutral in all three planning stages", () => {
  for (const stage of ["voice-intake", "series-planning", "book-planning"] as const) {
    const { parent, root } = setup();
    try {
      const project = readProject(root);
      project.current_stage = stage;
      project.next_gate = null;
      writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
      const projectBefore = structuredClone(readProject(root));
      const bookBefore = structuredClone(readBook(root));
      const intake = defaultIntake();
      intake.original_idea = "An auditor finds a pattern no one signed.";
      const result = applyNovelEvent(root, {
        eventType: "intake-update",
        expectedStage: stage,
        expectedProjectHash: projectStateHash(root),
        files: [{ path: "series/intake.yaml", content: stringifyYaml(intake) }],
      });
      assert.equal(result.stage, stage);
      assert.deepEqual(readProject(root), projectBefore);
      assert.deepEqual(readBook(root), bookBefore);
      assert.equal(result.changed.includes("PROJECT.yaml"), false);
      assert.equal(result.changed.includes("books/book-01/BOOK.yaml"), false);
      assert.match(gitHeadInfo(root)?.subject ?? "", /^Novel Forge: intake-update/);
      assert.match(readFileSync(join(root, "STATUS.md"), "utf8"), /Novel Forge/);
      assert.match(readFileSync(join(root, "HANDOFF.md"), "utf8"), /Handoff/);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});

test("intake-update accepts either or both files and changes the guarded hash", () => {
  const { parent, root } = setup();
  try {
    const originalHash = projectStateHash(root);
    const ledger = defaultDecisionLedger();
    ledger.assumptions.push({
      id: "ASM-001",
      scope: "project",
      subject: "profile",
      value: "thriller",
      status: "inferred",
      source: { type: "inference", path: "series/intake.yaml" },
      confidence: "moderate",
      affects: ["voice-plan"],
      supersedes: null,
    });
    const first = applyNovelEvent(root, {
      eventType: "intake-update",
      expectedStage: "voice-intake",
      expectedProjectHash: originalHash,
      files: [{ path: "series/decision-ledger.yaml", content: stringifyYaml(ledger) }],
    });
    assert.notEqual(first.projectHash, originalHash);
    assert.equal(first.projectHash, projectStateHash(root));

    const intake = defaultIntake();
    intake.inferred.profile = { value: "thriller", assumption_id: "ASM-001" };
    const second = applyNovelEvent(root, {
      eventType: "intake-update",
      expectedStage: "voice-intake",
      expectedProjectHash: first.projectHash,
      files: [
        { path: "series/intake.yaml", content: stringifyYaml(intake) },
        { path: "series/decision-ledger.yaml", content: stringifyYaml(ledger) },
      ],
    });
    assert.equal(second.changed.includes("series/intake.yaml"), true);
    assert.equal(second.changed.includes("series/decision-ledger.yaml"), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("intake-update rejects empty unsafe stale and malformed submissions before mutation", () => {
  const { parent, root } = setup();
  try {
    const projectBefore = readFileSync(join(root, "PROJECT.yaml"), "utf8");
    const bookBefore = readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8");
    const hash = projectStateHash(root);

    assert.throws(() => applyNovelEvent(root, { eventType: "intake-update", expectedStage: "voice-intake", expectedProjectHash: hash, files: [] }), /at least one/i);
    for (const path of [
      "PROJECT.yaml",
      "books/book-01/BOOK.yaml",
      "books/book-01/manuscript/chapters/01-opening.md",
      "books/book-01/reader-experiments.yaml",
      "books/book-01/publishing.yaml",
      "books/book-01/marketing.yaml",
      "books/book-01/package.md",
      "STATUS.md",
      "HANDOFF.md",
    ]) {
      rejection(() => applyNovelEvent(root, {
        eventType: "intake-update",
        expectedStage: "voice-intake",
        expectedProjectHash: projectStateHash(root),
        files: [{ path, content: path.endsWith(".yaml") ? "schema_version: 1.0.0\n" : "forbidden" }],
      }), "allowlist-violation");
    }

    const malformed = rejection(() => applyNovelEvent(root, {
      eventType: "intake-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "series/decision-ledger.yaml", content: "schema_version: [\n" }],
    }), "schema-validation");
    assert.deepEqual(malformed.detail.invalidPaths, ["series/decision-ledger.yaml"]);

    rejection(() => applyNovelEvent(root, {
      eventType: "intake-update",
      expectedStage: "voice-intake",
      expectedProjectHash: "stale",
      files: [{ path: "series/intake.yaml", content: stringifyYaml(defaultIntake()) }],
    }), "stale-project-hash");

    assert.equal(readFileSync(join(root, "PROJECT.yaml"), "utf8"), projectBefore);
    assert.equal(readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8"), bookBefore);
    assert.deepEqual(readdirSync(join(root, "books", "book-01", "manuscript", "chapters")), []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("decision-ledger cross-record blockers reject before mutation", () => {
  const { parent, root } = setup();
  try {
    const ledger = defaultDecisionLedger();
    const record = {
      id: "ASM-001",
      scope: "project" as const,
      subject: "profile",
      value: "thriller",
      status: "inferred" as const,
      source: { type: "inference" as const, path: "series/intake.yaml" },
      confidence: "moderate" as const,
      affects: ["voice-plan"],
      supersedes: null,
    };
    ledger.assumptions.push(record, { ...record, id: "ASM-002", value: "romantasy" });
    const before = readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8");
    const value = rejection(() => applyNovelEvent(root, {
      eventType: "intake-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "series/decision-ledger.yaml", content: stringifyYaml(ledger) }],
    }), "schema-validation");
    assert.match(value.message, /decision ledger/i);
    assert.equal(readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8"), before);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

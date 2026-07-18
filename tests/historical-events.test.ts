import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { HistoricalContextSchema, type HistoricalContext } from "../src/domain/historical-fiction.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-historical-events-"));
}

function historicalRoot(parent: string): string {
  return initializeProject(parent, {
    projectName: "Historical Events",
    projectType: "standalone",
    profile: "historical-fiction",
  });
}

test("historical research updates are guarded and change the project hash", () => {
  const parent = temp();
  try {
    const root = historicalRoot(parent);
    const path = "books/book-01/historical-context.yaml";
    const absolute = join(root, path);
    const context = parseYaml<HistoricalContext>(readFileSync(absolute, "utf8"), HistoricalContextSchema, path);
    context.temporal_scope = "Paris, February through June 1848";
    const before = projectStateHash(root);
    const result = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: before,
      files: [{ path, content: stringifyYaml(context) }],
    });
    assert.notEqual(result.projectHash, before);
    assert.equal(result.projectHash, projectStateHash(root));
    assert.equal(readProject(root).current_stage, "voice-intake");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical updates reject settings drift atomically", () => {
  const parent = temp();
  try {
    const root = historicalRoot(parent);
    const path = "books/book-01/historical-context.yaml";
    const absolute = join(root, path);
    const original = readFileSync(absolute, "utf8");
    const context = parseYaml<HistoricalContext>(original, HistoricalContextSchema, path);
    context.settings.story_mode = "war";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path, content: stringifyYaml(context) }],
    }), /settings.*match|historical integrity/i);
    assert.equal(readFileSync(absolute, "utf8"), original);
    assert.equal(readProject(root).current_stage, "voice-intake");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical paths remain isolated from other profiles and event types", () => {
  const parent = temp();
  try {
    const thriller = initializeProject(parent, { projectName: "Modern", projectType: "standalone", profile: "thriller" });
    assert.throws(() => applyNovelEvent(thriller, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(thriller),
      files: [{ path: "books/book-01/historical-context.yaml", content: "schema_version: 1.0.0\n" }],
    }), /not allowed/i);

    const historical = historicalRoot(parent);
    const project = readProject(historical);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(historical, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const context = readFileSync(join(historical, "books/book-01/historical-context.yaml"), "utf8");
    assert.throws(() => applyNovelEvent(historical, {
      eventType: "draft-chapter",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(historical),
      chapter: 1,
      files: [{ path: "books/book-01/historical-context.yaml", content: context }],
    }), /not allowed/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical book plans require both historical artifacts", () => {
  const parent = temp();
  try {
    const root = historicalRoot(parent);
    const project = readProject(root);
    project.current_stage = "book-planning";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const bookRoot = join(root, "books/book-01");
    const names = ["book-bible.md", "plot-grid.yaml", "remarkability.yaml", "research-ledger.yaml", "book-strategy.yaml"];
    const files = names.map((name) => ({
      path: `books/book-01/${name}`,
      content: readFileSync(join(bookRoot, name), "utf8"),
    }));
    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files,
    }), /historical-context\.yaml.*invention-ledger\.yaml/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("direct edits to either historical artifact change the guarded hash", () => {
  const parent = temp();
  try {
    const root = historicalRoot(parent);
    const before = projectStateHash(root);
    const contextPath = join(root, "books/book-01/historical-context.yaml");
    writeFileSync(contextPath, `${readFileSync(contextPath, "utf8")}\n`, "utf8");
    const afterContext = projectStateHash(root);
    assert.notEqual(afterContext, before);
    const ledgerPath = join(root, "books/book-01/invention-ledger.yaml");
    writeFileSync(ledgerPath, `${readFileSync(ledgerPath, "utf8")}\n`, "utf8");
    assert.notEqual(projectStateHash(root), afterContext);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

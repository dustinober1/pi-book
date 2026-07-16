import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../../src/project/store.js";
import type { ProjectStateV14 } from "../../src/domain/v1-4-project-schema.js";
import { creativeProjectStateHash, projectStateHash } from "../../src/application/project-hash.js";
import {
  beginPersistentRun,
  cancelPersistentRun,
  pausePersistentRun,
  resumePersistentRun,
} from "../../src/application/run.js";

function activeRun(root: string) { return (readProject(root) as ProjectStateV14).automation.active_run; }

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-automation-resume-"));
  const root = initializeProject(parent, { projectName: "Automation Resume", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

test("starting and pausing a run persists intent without changing creative state", () => {
  const { parent, root } = setup();
  try {
    const projectBefore = projectStateHash(root);
    const creativeBefore = creativeProjectStateHash(root);
    const bookBefore = readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8");
    const started = beginPersistentRun(root, { target: "voice-approval", maxChapters: 3, now: "2026-07-16T12:00:00Z" });
    assert.match(started.message, /RUN-001|run/i);
    assert.notEqual(projectStateHash(root), projectBefore);
    assert.equal(creativeProjectStateHash(root), creativeBefore);
    assert.equal(activeRun(root)?.status, "active");
    pausePersistentRun(root, "2026-07-16T12:01:00Z");
    assert.equal(activeRun(root)?.status, "paused");
    assert.equal(readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8"), bookBefore);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("resume reloads persisted state and returns the current action", () => {
  const { parent, root } = setup();
  try {
    beginPersistentRun(root, { target: "voice-approval", maxChapters: 3, now: "2026-07-16T12:00:00Z" });
    pausePersistentRun(root, "2026-07-16T12:01:00Z");
    assert.equal(activeRun(root)?.id, "RUN-001");
    const decision = resumePersistentRun(root, "2026-07-16T12:02:00Z");
    assert.equal(activeRun(root)?.status, "active");
    assert.equal(decision.action, "voice");
    assert.ok(decision.prompt);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("outside creative changes stop resume before another prompt", () => {
  const { parent, root } = setup();
  try {
    beginPersistentRun(root, { target: "voice-approval", maxChapters: 3, now: "2026-07-16T12:00:00Z" });
    pausePersistentRun(root, "2026-07-16T12:01:00Z");
    const book = readBook(root);
    book.title = "Changed Outside Run";
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const decision = resumePersistentRun(root, "2026-07-16T12:02:00Z");
    assert.equal(decision.action, "blocked");
    assert.equal(decision.prompt, null);
    assert.equal(activeRun(root)?.status, "stopped");
    assert.match(activeRun(root)?.stopReason ?? "", /changed|hash|replan/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("cancel is persisted and cannot resume", () => {
  const { parent, root } = setup();
  try {
    beginPersistentRun(root, { target: "voice-approval", maxChapters: 3, now: "2026-07-16T12:00:00Z" });
    cancelPersistentRun(root, "2026-07-16T12:01:00Z");
    assert.equal(activeRun(root)?.status, "cancelled");
    assert.throws(() => resumePersistentRun(root, "2026-07-16T12:02:00Z"), /cancelled/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

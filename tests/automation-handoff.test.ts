import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGuideScreen } from "../src/application/guide.js";
import { renderHandoff } from "../src/application/handoff.js";
import { getProjectStatus } from "../src/application/status.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

function setup(status: "active" | "paused" | "stopped" = "paused") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-run-handoff-"));
  const root = initializeProject(parent, { projectName: "Run Handoff", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  (project.automation as any).active_run = {
    id: "RUN-001",
    status,
    target: "midpoint-review",
    startedStage: project.current_stage,
    currentAction: "voice",
    requestedMaxChapters: 10,
    completedEventKeys: ["draft-chapter:1", "draft-chapter:2"],
    lastProjectHash: "creative-hash",
    refillCount: 0,
    retryCounts: {},
    stopReason: status === "stopped" ? "creative-state-changed" : null,
    startedAt: "2026-07-16T12:00:00Z",
    updatedAt: "2026-07-16T12:10:00Z",
  };
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return { parent, root };
}

test("handoff records resumable run identity progress and exact command", () => {
  const { parent, root } = setup("paused");
  try {
    const project = readProject(root);
    const markdown = renderHandoff(project, readBook(root), getProjectStatus(root), {}, root);
    assert.match(markdown, /RUN-001/);
    assert.match(markdown, /paused/);
    assert.match(markdown, /midpoint-review/);
    assert.match(markdown, /2 completed/i);
    assert.match(markdown, /\/novel-run --resume/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("guide keeps the stage action primary and exposes run controls secondarily", () => {
  const { parent, root } = setup("paused");
  try {
    const screen = buildGuideScreen(root);
    assert.equal(screen.primary.id, "continue");
    assert.ok(screen.actions.some((action) => action.id === "resume-run"));
    assert.ok(screen.actions.some((action) => action.id === "cancel-run"));
    assert.notEqual(screen.actions[0]?.id, "resume-run");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("stopped run handoff explains stop reason without claiming it can resume", () => {
  const { parent, root } = setup("stopped");
  try {
    const markdown = renderHandoff(readProject(root), readBook(root), getProjectStatus(root), {}, root);
    assert.match(markdown, /creative-state-changed/);
    assert.doesNotMatch(markdown, /Exact resume command:\s*`\/novel-run --resume`/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

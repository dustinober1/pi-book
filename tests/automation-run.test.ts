import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectV14Schema, type ProjectStateV14 } from "../src/domain/v1-4-project-schema.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import {
  automationEventKey,
  cancelAutomationRun,
  completeAutomationEvent,
  pauseAutomationRun,
  recordAutomationRejection,
  resumeAutomationRun,
  startAutomationRun,
} from "../src/application/automation-run.js";

function project(): ProjectStateV14 {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-run-schema-"));
  try {
    const root = initializeProject(parent, { projectName: "Run Schema", projectType: "standalone", profile: "thriller" });
    return readProject(root) as ProjectStateV14;
  } finally { rmSync(parent, { recursive: true, force: true }); }
}

function started(): ProjectState {
  return startAutomationRun(project(), {
    id: "RUN-001",
    target: "midpoint-review",
    currentAction: "draft-chapter:1",
    requestedMaxChapters: 10,
    creativeHash: "creative-hash-1",
    startedAt: "2026-07-16T12:00:00Z",
  });
}

test("existing project YAML without active_run remains readable and new projects initialize null", () => {
  const value = project();
  assert.equal(value.automation.active_run, null);
  const legacy = structuredClone(value) as ProjectStateV14 & { automation: Record<string, unknown> };
  delete legacy.automation.active_run;
  assert.doesNotThrow(() => parseYaml(stringifyYaml(legacy), ProjectV14Schema, "PROJECT.yaml"));
});

test("starting a run records durable intent and rejects a second live run", () => {
  const value = started();
  assert.deepEqual(value.automation.active_run, {
    id: "RUN-001",
    status: "active",
    target: "midpoint-review",
    startedStage: value.current_stage,
    currentAction: "draft-chapter:1",
    requestedMaxChapters: 10,
    completedEventKeys: [],
    lastProjectHash: "creative-hash-1",
    refillCount: 0,
    retryCounts: {},
    stopReason: null,
    startedAt: "2026-07-16T12:00:00Z",
    updatedAt: "2026-07-16T12:00:00Z",
  });
  assert.throws(() => startAutomationRun(value, {
    id: "RUN-002", target: "act-1-review", currentAction: "draft-chapter:1", requestedMaxChapters: 3,
    creativeHash: "creative-hash-1", startedAt: "2026-07-16T12:01:00Z",
  }), /active|paused|cancel/i);
});

test("completed event keys persist across YAML reload and duplicates do not replay", () => {
  let value = started();
  for (let chapter = 1; chapter <= 4; chapter += 1) {
    value = completeAutomationEvent(value, automationEventKey("draft-chapter", chapter), `draft-chapter:${chapter + 1}`, `hash-${chapter + 1}`, `2026-07-16T12:0${chapter}:00Z`);
  }
  const reloaded = parseYaml<ProjectState>(stringifyYaml(value), ProjectSchema, "PROJECT.yaml");
  assert.deepEqual(reloaded.automation.active_run?.completedEventKeys, [
    "draft-chapter:1", "draft-chapter:2", "draft-chapter:3", "draft-chapter:4",
  ]);
  const duplicate = completeAutomationEvent(reloaded, "draft-chapter:4", "draft-chapter:5", "hash-5", "2026-07-16T12:05:00Z");
  assert.deepEqual(duplicate.automation.active_run?.completedEventKeys, reloaded.automation.active_run?.completedEventKeys);
});

test("pause and cancel are idempotent and cancelled runs cannot resume", () => {
  const paused = pauseAutomationRun(started(), "2026-07-16T12:10:00Z");
  assert.equal(paused.automation.active_run?.status, "paused");
  assert.deepEqual(pauseAutomationRun(paused, "2026-07-16T12:11:00Z"), paused);
  const cancelled = cancelAutomationRun(paused, "2026-07-16T12:12:00Z");
  assert.equal(cancelled.automation.active_run?.status, "cancelled");
  assert.deepEqual(cancelAutomationRun(cancelled, "2026-07-16T12:13:00Z"), cancelled);
  assert.throws(() => resumeAutomationRun(cancelled, cancelled.current_stage, "creative-hash-1", "2026-07-16T12:14:00Z"), /cancelled/i);
});

test("resume reactivates matching state and stops before mutation on stage or hash drift", () => {
  const paused = pauseAutomationRun(started(), "2026-07-16T12:10:00Z");
  const resumed = resumeAutomationRun(paused, paused.current_stage, "creative-hash-1", "2026-07-16T12:11:00Z");
  assert.equal(resumed.automation.active_run?.status, "active");
  const stale = resumeAutomationRun(paused, "drafting", "different-hash", "2026-07-16T12:12:00Z");
  assert.equal(stale.automation.active_run?.status, "stopped");
  assert.match(stale.automation.active_run?.stopReason ?? "", /stage|hash|changed/i);
});

test("retry policy counts one repair then stops and human gates stop immediately", () => {
  const retryable = {
    code: "schema-validation" as const,
    message: "bad payload",
    retryable: true,
    requiresReload: false,
    invalidPaths: ["books/book-01/chapter-queue.yaml"],
    issues: [],
    currentStage: "drafting",
    currentProjectHash: "creative-hash-1",
  };
  const once = recordAutomationRejection(started(), "draft-chapter:1", retryable, "creative-hash-1", "2026-07-16T12:10:00Z");
  assert.equal(once.automation.active_run?.retryCounts["draft-chapter:1"], 1);
  assert.equal(once.automation.active_run?.status, "active");
  const twice = recordAutomationRejection(once, "draft-chapter:1", retryable, "creative-hash-1", "2026-07-16T12:11:00Z");
  assert.equal(twice.automation.active_run?.status, "stopped");
  assert.match(twice.automation.active_run?.stopReason ?? "", /retry/i);

  const humanGate = { ...retryable, code: "human-gate-required" as const, message: "approval required", retryable: false };
  const gated = recordAutomationRejection(started(), "draft-chapter:1", humanGate, "creative-hash-1", "2026-07-16T12:10:00Z");
  assert.equal(gated.automation.active_run?.status, "stopped");
  assert.equal(gated.automation.active_run?.stopReason, "human-gate");
});

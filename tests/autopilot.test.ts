import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotDecision, beginAutopilotRun } from "../src/application/autopilot.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

test("autopilot queues the current safe action and persists its target", () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-autopilot-start-"));
  try {
    const root = initializeProject(parent, { projectName: "Autopilot", projectType: "planned-series", profile: "thriller" });
    const decision = beginAutopilotRun(root, { target: "book-plan-approval", maxChapters: 3, now: "2026-07-16T12:00:00Z" });
    assert.equal(decision.action, "voice");
    assert.ok(decision.prompt);
    assert.equal((readProject(root) as any).automation.active_run?.target, "book-plan-approval");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("autopilot stops at a pending human gate and never approves it", () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-autopilot-gate-"));
  try {
    const root = initializeProject(parent, { projectName: "Gate Stop", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.next_gate = "voice-approval";
    project.gates["voice-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const decision = autopilotDecision(root, "book-plan-approval");
    assert.equal(decision.action, "human-gate");
    assert.equal(decision.prompt, null);
    assert.equal(readProject(root).gates["voice-approval"], "pending");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("requested target stops once that gate is reached", () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-autopilot-target-"));
  try {
    const root = initializeProject(parent, { projectName: "Target Stop", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.next_gate = "voice-approval";
    project.gates["voice-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const decision = autopilotDecision(root, "voice-approval");
    assert.equal(decision.action, "target-reached");
    assert.equal(decision.prompt, null);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

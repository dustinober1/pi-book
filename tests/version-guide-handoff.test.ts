import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { buildGuideScreen } from "../src/application/guide.js";
import { refreshGuidance } from "../src/application/handoff.js";
import { getProjectStatus } from "../src/application/status.js";
import { NOVEL_FORGE_VERSION, upgradeProjectVersion, versionFindings } from "../src/application/version.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-guided-")); }

function voiceFiles(root: string, profile: string) {
  return [
    { path: "series/voice-profile.md", content: profile },
    { path: "series/taste-profile.yaml", content: readFileSync(join(root, "series", "taste-profile.yaml"), "utf8") },
    { path: "series/voice-guardrails.yaml", content: readFileSync(join(root, "series", "voice-guardrails.yaml"), "utf8") },
    { path: "series/voice-experiments/index.yaml", content: readFileSync(join(root, "series", "voice-experiments", "index.yaml"), "utf8") },
  ];
}

test("new projects expose versioned author entry files", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Guided Signal", projectType: "standalone", profile: "thriller" });
    assert.equal(readProject(root).novel_forge_version, NOVEL_FORGE_VERSION);
    assert.equal(existsSync(join(root, "START-HERE.md")), true);
    assert.equal(existsSync(join(root, "HANDOFF.md")), true);
    assert.match(readFileSync(join(root, "START-HERE.md"), "utf8"), /\/novel\b/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("version compatibility warns on old projects and blocks newer projects", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Compatibility", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    delete project.novel_forge_version;
    assert.ok(versionFindings(project).some((item) => item.severity === "warning" && /missing/i.test(item.message)));
    project.novel_forge_version = "1.0.0";
    assert.ok(versionFindings(project).some((item) => item.severity === "warning" && /older/i.test(item.message)));
    project.novel_forge_version = "9.0.0";
    assert.ok(versionFindings(project).some((item) => item.severity === "blocker" && /newer/i.test(item.message)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("metadata upgrade preserves creative workflow state", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Upgrade", projectType: "standalone", profile: "romantasy" });
    const before = readProject(root);
    delete before.novel_forge_version;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(before), "utf8");
    const version = upgradeProjectVersion(root);
    const after = readProject(root);
    assert.equal(version, NOVEL_FORGE_VERSION);
    assert.equal(after.novel_forge_version, NOVEL_FORGE_VERSION);
    assert.equal(after.current_stage, before.current_stage);
    assert.equal(after.next_gate, before.next_gate);
    assert.deepEqual(after.gates, before.gates);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("guided screen turns pending and rejected gates into friendly actions", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Gate Cards", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.gates["voice-approval"] = "pending";
    project.next_gate = "voice-approval";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const pending = buildGuideScreen(root);
    assert.match(pending.title, /Voice Profile/i);
    assert.deepEqual(pending.actions.map((item) => item.id), ["approve", "request-changes", "view-evidence", "status", "advanced"]);
    project.gates["voice-approval"] = "rejected";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const rejected = buildGuideScreen(root);
    assert.equal(rejected.primary.id, "repair");
    assert.ok(rejected.actions.some((item) => item.id === "repair"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("status starts with a decision and handoff is portable", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Portable", projectType: "standalone", profile: "thriller" });
    const status = getProjectStatus(root);
    assert.match(status.markdown, /^# Novel Forge\n/m);
    assert.match(status.markdown, /## What needs you[\s\S]*## Recommended action[\s\S]*## Why this stopped[\s\S]*## Project snapshot/);
    refreshGuidance(root, { lastAction: "Initialized project" });
    const handoff = readFileSync(join(root, "HANDOFF.md"), "utf8");
    assert.match(handoff, /Git reference: .* @ HEAD/);
    assert.match(handoff, /Project state hash: [a-f0-9]{64}/);
    assert.match(handoff, /Last completed action: Initialized project/);
    assert.match(handoff, /Run exactly: `\/novel`/);
    assert.match(handoff, /Continuation prompt/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("guarded events refresh status and handoff without recording their own in-flight dirtiness", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Event Handoff", projectType: "standalone", profile: "thriller" });
    const result = applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: voiceFiles(root, "# Voice Profile\n\nSpecific, compressed, and human.\n"),
    });
    assert.ok(result.changed.includes("STATUS.md"));
    assert.ok(result.changed.includes("HANDOFF.md"));
    assert.match(readFileSync(join(root, "HANDOFF.md"), "utf8"), /voice-profile/);
    assert.doesNotMatch(readFileSync(join(root, "STATUS.md"), "utf8"), /uncommitted file/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("guarded events preserve warnings for unrelated pre-existing dirty files", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Existing Dirtiness", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(root, "author-notes.txt"), "Uncommitted author notes.\n", "utf8");
    applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: voiceFiles(root, "# Voice Profile\n\nEvidence-specific restraint.\n"),
    });
    assert.match(readFileSync(join(root, "STATUS.md"), "utf8"), /1 uncommitted file\(s\) exist/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

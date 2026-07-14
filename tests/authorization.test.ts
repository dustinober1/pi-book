import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approveProjectGate, directDraftDecision } from "../src/application/run.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-auth-")); }

test("gate approval cannot skip the active stage or approve an open gate", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Guarded", projectType: "standalone", profile: "thriller" });
    assert.throws(() => approveProjectGate(root, "package-approval"), /active gate|current stage/i);
    assert.throws(() => approveProjectGate(root, "voice-approval"), /pending/i);

    const project = readProject(root);
    project.gates["voice-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    approveProjectGate(root, "voice-approval");
    const approved = readProject(root);
    assert.equal(approved.current_stage, "series-planning");
    assert.equal(approved.approvals.length, 1);
    assert.equal(approved.approvals[0]?.gate, "voice-approval");
    assert.throws(() => approveProjectGate(root, "voice-approval"), /active gate|already/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("direct drafting is blocked outside the drafting stage", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "No Draft", projectType: "standalone", profile: "romantasy" });
    const decision = directDraftDecision(root);
    assert.equal(decision.action, "blocked");
    assert.match(decision.message, /drafting stage/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

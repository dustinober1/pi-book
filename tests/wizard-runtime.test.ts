import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWizardRegistry } from "../src/application/wizard.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-wizard-runtime-")); }

test("wizard snapshots expose decisions without physical project paths", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Sanitized", projectType: "standalone", profile: "thriller" });
    const registry = createWizardRegistry(root);
    const snapshot = await registry.snapshot("adoption") as any;
    assert.equal(snapshot.project.name, "Sanitized");
    assert.equal(snapshot.project.root, undefined);
    assert.equal(snapshot.project_root, undefined);
    assert.equal(snapshot.project.state_hash, projectStateHash(root));
    assert.equal(snapshot.workflow.eligible, true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("wizard apply rejects stale stage and hash before handler execution", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Freshness", projectType: "standalone", profile: "thriller" });
    let called = false;
    const registry = createWizardRegistry(root, {
      adoption: { apply() { called = true; return { ok: true }; } },
    });
    await assert.rejects(() => registry.apply({ proposal_id: "p1", workflow: "adoption", action: "apply", expected_stage: "drafting", expected_project_hash: projectStateHash(root), payload: {} }), /stale.*stage/i);
    await assert.rejects(() => registry.apply({ proposal_id: "p2", workflow: "adoption", action: "apply", expected_stage: readProject(root).current_stage, expected_project_hash: "bad", payload: {} }), /stale.*hash/i);
    assert.equal(called, false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

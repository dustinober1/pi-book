import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackagingWizardHandler } from "../src/application/packaging/wizard.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-package-wizard-")); }

test("packaging wizard previews checklist and canonical metadata", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package Wizard", projectType: "standalone", profile: "thriller" });
    const handler = createPackagingWizardHandler(root);
    const checklist = await handler.preview!("checklist", {}) as any;
    assert.ok(Array.isArray(checklist.items));
    assert.ok(checklist.items.some((item: any) => item.id === "publishing-metadata"));
    const metadata = await handler.preview!("metadata", {}) as any;
    assert.equal(metadata.publishing.schema_version, "1.0.0");
    assert.equal(metadata.marketing.schema_version, "1.0.0");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("packaging wizard rejects unknown apply actions", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Package Wizard", projectType: "standalone", profile: "thriller" });
    const handler = createPackagingWizardHandler(root);
    await assert.rejects(Promise.resolve().then(() => handler.apply!({ proposal_id: "p1", workflow: "packaging", action: "unknown", expected_stage: "voice-intake", expected_project_hash: "hash", payload: {} })), /unknown packaging apply action/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeNovelWizard, launchNovelWizard } from "../src/application/wizard-launch.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-wizard-launch-")); }

test("launcher wires all four workflow handlers into one local session", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Wizard Launch", projectType: "standalone", profile: "thriller" });
    const handle = await launchNovelWizard(root, "adoption", { openBrowser: false });
    const origin = new URL(handle.url).origin;
    const response = await fetch(`${origin}/api/snapshot`, { method: "POST", headers: { Authorization: `Bearer ${handle.token}`, Origin: origin, "content-type": "application/json" }, body: JSON.stringify({ workflow: "readers" }) });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.workflow.id, "readers");
    await closeNovelWizard(root);
    await assert.rejects(() => fetch(`${origin}/api/session`));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

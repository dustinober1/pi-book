import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createResearchWizardHandler } from "../../src/application/research/wizard.js";
import { createWizardRegistry } from "../../src/application/wizard.js";
import { initializeProject } from "../../src/project/store.js";
import { startWizardSession } from "../../src/wizard/session.js";

async function request(url: string, token: string, path: string, body?: unknown) {
  const origin = new URL(url).origin;
  return fetch(`${origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Novel-Forge-Origin": origin, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("research workflow is available only through an authenticated loopback session", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-http-"));
  let session: Awaited<ReturnType<typeof startWizardSession>> | null = null;
  try {
    const root = initializeProject(parent, { projectName: "Research HTTP", projectType: "standalone", profile: "thriller" });
    session = await startWizardSession({ projectRoot: root, workflow: "research", registry: createWizardRegistry(root, { research: createResearchWizardHandler(root) }), openBrowser: false, idleTimeoutMs: 60_000 });
    assert.equal(new URL(session.url).hostname, "127.0.0.1");
    const unauthorized = await fetch(`${new URL(session.url).origin}/api/session`);
    assert.equal(unauthorized.status, 401);
    const snapshot = await request(session.url, session.token, "/api/snapshot", { workflow: "research" });
    assert.equal(snapshot.status, 200);
    const value = await snapshot.json() as any;
    assert.equal(value.workflow.id, "research");
    assert.equal(value.project.root, undefined);
    const stale = await request(session.url, session.token, "/api/apply", { proposal_id: "stale", workflow: "research", action: "save-influence", expected_stage: value.project.stage, expected_project_hash: "stale", payload: { preview_id: "missing" } });
    assert.ok(stale.status >= 400);
  } finally {
    await session?.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

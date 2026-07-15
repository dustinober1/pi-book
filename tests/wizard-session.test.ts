import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWizardSession } from "../src/wizard/session.js";
import type { WizardActionRegistry } from "../src/wizard/types.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-wizard-")); }

const registry: WizardActionRegistry = {
  snapshot: async () => ({ project: "safe" }),
  preview: async (_workflow, action) => ({ action }),
  apply: async (envelope) => ({ applied: envelope.action }),
};

async function api(handle: Awaited<ReturnType<typeof startWizardSession>>, path: string, init: RequestInit = {}) {
  const origin = new URL(handle.url).origin;
  return fetch(`${origin}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${handle.token}`, Origin: origin, "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("wizard binds to loopback and requires token plus exact origin", async () => {
  const root = temp();
  const handle = await startWizardSession({ projectRoot: root, registry, openBrowser: false });
  try {
    assert.equal(new URL(handle.url).hostname, "127.0.0.1");
    const origin = new URL(handle.url).origin;
    assert.equal((await fetch(`${origin}/api/session`, { headers: { Origin: origin } })).status, 401);
    assert.equal((await fetch(`${origin}/api/session`, { headers: { Authorization: `Bearer ${handle.token}`, Origin: "http://localhost" } })).status, 403);
    const response = await api(handle, "/api/session");
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.project_root, undefined);
    assert.equal(body.token, undefined);
  } finally {
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("wizard routes snapshots previews and guarded apply envelopes", async () => {
  const root = temp();
  const handle = await startWizardSession({ projectRoot: root, registry, openBrowser: false });
  try {
    const snapshot = await api(handle, "/api/snapshot", { method: "POST", body: JSON.stringify({ workflow: "packaging" }) });
    assert.deepEqual(await snapshot.json(), { project: "safe" });
    const preview = await api(handle, "/api/preview", { method: "POST", body: JSON.stringify({ workflow: "readers", action: "kit", payload: {} }) });
    assert.deepEqual(await preview.json(), { action: "kit" });
    const apply = await api(handle, "/api/apply", { method: "POST", body: JSON.stringify({ proposal_id: "p1", workflow: "next-book", action: "create", expected_stage: "complete", expected_project_hash: "hash", payload: {} }) });
    assert.deepEqual(await apply.json(), { applied: "create" });
  } finally {
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("wizard close and idle expiration stop the server", async () => {
  const root = temp();
  const handle = await startWizardSession({ projectRoot: root, registry, openBrowser: false, idleTimeoutMs: 30 });
  const origin = new URL(handle.url).origin;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await assert.rejects(() => fetch(`${origin}/api/session`));
  await handle.close();
  rmSync(root, { recursive: true, force: true });
});

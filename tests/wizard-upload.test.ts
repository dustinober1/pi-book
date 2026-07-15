import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWizardSession } from "../src/wizard/session.js";
import type { WizardActionRegistry } from "../src/wizard/types.js";

const registry: WizardActionRegistry = {
  snapshot: async () => ({}),
  preview: async () => ({}),
  apply: async () => ({}),
};

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-upload-")); }

test("uploads use opaque source IDs and session-owned storage", async () => {
  const root = temp();
  const handle = await startWizardSession({ projectRoot: root, registry, openBrowser: false, uploadLimitBytes: 1024 });
  const origin = new URL(handle.url).origin;
  try {
    const form = new FormData();
    form.set("file", new File(["# Chapter 1\n\nText"], "../unsafe manuscript.md", { type: "text/markdown" }));
    const response = await fetch(`${origin}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${handle.token}`, Origin: origin }, body: form });
    assert.equal(response.status, 201);
    const body = await response.json() as any;
    assert.match(body.source_id, /^source_[a-zA-Z0-9_-]+$/);
    assert.equal(body.path, undefined);
    assert.equal(body.original_name, "unsafe manuscript.md");
    assert.equal(handle.resolveSource(body.source_id)?.originalName, "unsafe manuscript.md");
    assert.equal(existsSync(handle.uploadRoot), true);
    assert.equal(readdirSync(handle.uploadRoot).length, 1);
  } finally {
    const uploadRoot = handle.uploadRoot;
    await handle.close();
    assert.equal(existsSync(uploadRoot), false);
    rmSync(root, { recursive: true, force: true });
  }
});

test("uploads reject unsupported extensions and byte-limit overflow", async () => {
  const root = temp();
  const handle = await startWizardSession({ projectRoot: root, registry, openBrowser: false, uploadLimitBytes: 8 });
  const origin = new URL(handle.url).origin;
  try {
    const unsupported = new FormData();
    unsupported.set("file", new File(["x"], "payload.exe"));
    assert.equal((await fetch(`${origin}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${handle.token}`, Origin: origin }, body: unsupported })).status, 415);
    const tooLarge = new FormData();
    tooLarge.set("file", new File(["0123456789"], "book.txt"));
    assert.equal((await fetch(`${origin}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${handle.token}`, Origin: origin }, body: tooLarge })).status, 413);
  } finally {
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});

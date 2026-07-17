import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextCacheKey, readContextCache, writeContextCache } from "../src/infrastructure/context-cache.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-context-cache-")); }

const keyInput = {
  projectHash: "project-hash",
  sourceHashes: { "PROJECT.yaml": "a", "series/canon.yaml": "b" },
  runtimeProfile: "local" as const,
  distillerVersion: "1",
  sectionPolicyVersion: "1",
};

test("cache keys are stable across source-hash insertion order", () => {
  const first = contextCacheKey(keyInput);
  const second = contextCacheKey({ ...keyInput, sourceHashes: { "series/canon.yaml": "b", "PROJECT.yaml": "a" } });
  assert.equal(first, second);
});

test("cache writes atomically and reads only matching entries", () => {
  const root = temp();
  try {
    const key = contextCacheKey(keyInput);
    writeContextCache(root, key, { text: "rendered deterministic context", report: { schemaVersion: "1.0.0" } });
    assert.deepEqual(readContextCache(root, key), { text: "rendered deterministic context", report: { schemaVersion: "1.0.0" } });
    assert.equal(readContextCache(root, "wrong-key"), null);
    const path = join(root, ".pi-book", "cache", "v1", `${key}.json`);
    assert.doesNotThrow(() => JSON.parse(readFileSync(path, "utf8")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("corrupt cache entries are ignored", () => {
  const root = temp();
  try {
    const key = contextCacheKey(keyInput);
    writeContextCache(root, key, { text: "valid", report: { schemaVersion: "1.0.0" } });
    const path = join(root, ".pi-book", "cache", "v1", `${key}.json`);
    writeFileSync(path, "not-json", "utf8");
    assert.equal(readContextCache(root, key), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

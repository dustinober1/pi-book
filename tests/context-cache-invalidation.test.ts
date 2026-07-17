import test from "node:test";
import assert from "node:assert/strict";
import { contextCacheKey } from "../src/infrastructure/context-cache.js";

const base = {
  projectHash: "project-a",
  sourceHashes: { "chapter-queue.yaml": "queue-a", "series/canon.yaml": "canon-a" },
  runtimeProfile: "tiny-local" as const,
  distillerVersion: "1",
  sectionPolicyVersion: "1",
};

test("relevant source changes invalidate the cache key", () => {
  assert.notEqual(contextCacheKey(base), contextCacheKey({ ...base, sourceHashes: { ...base.sourceHashes, "series/canon.yaml": "canon-b" } }));
});

test("unrelated files do not affect a key unless supplied as relevant sources", () => {
  const first = contextCacheKey(base);
  const unrelatedProjectState = { ...base, unrelatedFileHash: "marketing-change" } as typeof base & { unrelatedFileHash: string };
  assert.equal(first, contextCacheKey(unrelatedProjectState));
});

test("profile and policy versions isolate cache products", () => {
  assert.notEqual(contextCacheKey(base), contextCacheKey({ ...base, runtimeProfile: "local" }));
  assert.notEqual(contextCacheKey(base), contextCacheKey({ ...base, distillerVersion: "2" }));
  assert.notEqual(contextCacheKey(base), contextCacheKey({ ...base, sectionPolicyVersion: "2" }));
});

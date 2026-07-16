import test from "node:test";
import assert from "node:assert/strict";
import { verifyV13ReleaseTree } from "../scripts/verify-v1-3-release.js";

test("the repository tree satisfies the Novel Forge 1.3 release contract", () => {
  const checks = verifyV13ReleaseTree(process.cwd());
  assert.ok(checks.length >= 10);
  assert.deepEqual(checks.filter((check) => !check.passed), []);
  assert.equal(new Set(checks.map((check) => check.id)).size, checks.length);
});

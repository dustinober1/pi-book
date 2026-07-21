import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { verifyV17ReleaseTree } from "../scripts/verify-v1-7-release.js";

test("Novel Forge 1.7.0 release tree is complete and paid evaluation is excluded from CI", () => {
  const checks = verifyV17ReleaseTree(resolve(process.cwd()));
  const failures = checks.filter((item) => !item.passed);
  assert.deepEqual(failures, [], failures.map((item) => `${item.id}: ${item.detail}`).join("\n"));
  assert.ok(checks.length >= 18);
});

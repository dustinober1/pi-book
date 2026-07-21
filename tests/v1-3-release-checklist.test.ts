import test from "node:test";
import assert from "node:assert/strict";
import { verifyV13ReleaseTree } from "../scripts/verify-v1-3-release.js";

test("the historical 1.3 release checker rejects current 1.7 release metadata", () => {
  const checks = verifyV13ReleaseTree(process.cwd());
  assert.ok(checks.length >= 10);
  assert.deepEqual(checks.filter((check) => !check.passed).map((check) => check.id), [
    "package-version",
    "lock-version",
    "release-script",
    "packed-file-contract",
  ]);
  assert.equal(new Set(checks.map((check) => check.id)).size, checks.length);
});

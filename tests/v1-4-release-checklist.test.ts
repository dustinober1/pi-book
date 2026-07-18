import test from "node:test";
import assert from "node:assert/strict";
import { verifyV14ReleaseTree } from "../scripts/verify-v1-4-release.js";

test("the historical 1.4 checker rejects current 1.5 release metadata", () => {
  const root = process.cwd();
  const failed = new Set(verifyV14ReleaseTree(root).filter((item) => !item.passed).map((item) => item.id));
  assert.ok(failed.has("package-version"));
  assert.ok(failed.has("lock-version"));
  assert.ok(failed.has("release-script"));
});

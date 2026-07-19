import assert from "node:assert/strict";
import test from "node:test";
import { verifyV162ReleaseTree } from "../scripts/verify-v1-6-2-release.js";

test("package, runtime, documentation, and release automation agree on v1.6.2", () => {
  assert.deepEqual(verifyV162ReleaseTree(process.cwd()).filter((item) => !item.passed), []);
});

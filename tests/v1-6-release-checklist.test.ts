import assert from "node:assert/strict";
import test from "node:test";
import { verifyV16ReleaseTree } from "../scripts/verify-v1-6-release.js";

test("package, runtime, documentation, and release automation agree on v1.6.0", () => {
  assert.deepEqual(verifyV16ReleaseTree(process.cwd()).filter((item) => !item.passed), []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { verifyV161ReleaseTree } from "../scripts/verify-v1-6-1-release.js";

test("package, runtime, documentation, and release automation agree on v1.6.1", () => {
  assert.deepEqual(verifyV161ReleaseTree(process.cwd()).filter((item) => !item.passed), []);
});

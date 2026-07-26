import assert from "node:assert/strict";
import test from "node:test";
import { verifyV174ReleaseTree } from "../scripts/verify-v1-7-4-release.js";

test("the historical v1.7.4 release checker rejects current v1.8.0 metadata", () => {
  assert.ok(verifyV174ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

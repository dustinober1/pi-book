import assert from "node:assert/strict";
import test from "node:test";
import { verifyV173ReleaseTree } from "../scripts/verify-v1-7-3-release.js";

test("the historical v1.7.3 release checker rejects current v1.9.0 metadata", () => {
  assert.ok(verifyV173ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

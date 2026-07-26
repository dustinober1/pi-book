import assert from "node:assert/strict";
import test from "node:test";
import { verifyV172ReleaseTree } from "../scripts/verify-v1-7-2-release.js";

test("the historical v1.7.2 release checker rejects current v1.7.3 metadata", () => {
  assert.ok(verifyV172ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

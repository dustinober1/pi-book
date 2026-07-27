import assert from "node:assert/strict";
import test from "node:test";
import { verifyV180ReleaseTree } from "../scripts/verify-v1-8-0-release.js";

test("the historical v1.8.0 release checker rejects current v1.9.0 metadata", () => {
  assert.ok(verifyV180ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

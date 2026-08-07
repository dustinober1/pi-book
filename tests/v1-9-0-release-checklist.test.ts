import assert from "node:assert/strict";
import test from "node:test";
import { verifyV190ReleaseTree } from "../scripts/verify-v1-9-0-release.js";

test("the historical v1.9.0 release checker rejects current v2.1.0 metadata", () => {
  assert.ok(verifyV190ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

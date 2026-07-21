import assert from "node:assert/strict";
import test from "node:test";
import { verifyV162ReleaseTree } from "../scripts/verify-v1-6-2-release.js";

test("the historical v1.6.2 release checker rejects current v1.7 metadata", () => {
  assert.ok(verifyV162ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

import assert from "node:assert/strict";
import test from "node:test";
import { verifyV200ReleaseTree } from "../scripts/verify-v2-0-0-release.js";

test("the historical v2.0.0 release checker rejects current v2.2.0 metadata", () => {
  assert.ok(verifyV200ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

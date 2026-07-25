import assert from "node:assert/strict";
import test from "node:test";
import { verifyV17ReleaseTree } from "../scripts/verify-v1-7-release.js";

test("the historical v1.7 release checker rejects current v1.7.1 metadata", () => {
  assert.ok(verifyV17ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

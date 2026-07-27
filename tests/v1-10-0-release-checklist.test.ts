import assert from "node:assert/strict";
import test from "node:test";
import { verifyV1100ReleaseTree } from "../scripts/verify-v1-10-0-release.js";

test("the historical v1.10.0 release checker rejects current v2.0.0 metadata", () => {
  assert.ok(verifyV1100ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

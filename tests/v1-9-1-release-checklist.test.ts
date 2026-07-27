import assert from "node:assert/strict";
import test from "node:test";
import { verifyV191ReleaseTree } from "../scripts/verify-v1-9-1-release.js";

test("the historical v1.9.1 release checker rejects current v1.10.0 metadata", () => {
  assert.ok(verifyV191ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

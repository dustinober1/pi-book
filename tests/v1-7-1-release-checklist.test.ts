import assert from "node:assert/strict";
import test from "node:test";
import { verifyV171ReleaseTree } from "../scripts/verify-v1-7-1-release.js";

test("the historical v1.7.1 release checker rejects current v1.7.2 metadata", () => {
  assert.ok(verifyV171ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

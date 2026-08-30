import assert from "node:assert/strict";
import test from "node:test";
import { verifyV201ReleaseTree } from "../scripts/verify-v2-0-1-release.js";

test("the historical v2.0.1 release checker rejects current v2.2.0 metadata", () => {
  assert.ok(verifyV201ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

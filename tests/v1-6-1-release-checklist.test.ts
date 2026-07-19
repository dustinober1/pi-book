import assert from "node:assert/strict";
import test from "node:test";
import { verifyV161ReleaseTree } from "../scripts/verify-v1-6-1-release.js";

test("the historical v1.6.1 release checker rejects current v1.6.2 metadata", () => {
  assert.ok(verifyV161ReleaseTree(process.cwd()).some((item) => item.id === "package-version" && !item.passed));
});

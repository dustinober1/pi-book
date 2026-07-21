import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyV15ReleaseTree } from "../scripts/verify-v1-5-release.js";
import { NOVEL_FORGE_VERSION } from "../src/application/version-core.js";

test("the historical v1.5 release checker rejects current v1.7 metadata", () => {
  const root = process.cwd();
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(packageJson.version, "1.7.0");
  assert.equal(lock.version, "1.7.0");
  assert.equal(lock.packages[""].version, "1.7.0");
  assert.equal(NOVEL_FORGE_VERSION, "1.7.0");
  assert.ok(verifyV15ReleaseTree(root).some((item) => item.id === "package-version" && !item.passed));
});

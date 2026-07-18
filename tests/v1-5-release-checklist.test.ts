import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyV15ReleaseTree } from "../scripts/verify-v1-5-release.js";
import { NOVEL_FORGE_VERSION } from "../src/application/version-core.js";

test("package lock runtime documentation and release tree agree on 1.5.0", () => {
  const root = process.cwd();
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(packageJson.version, "1.5.0");
  assert.equal(lock.version, "1.5.0");
  assert.equal(lock.packages[""].version, "1.5.0");
  assert.equal(NOVEL_FORGE_VERSION, "1.5.0");
  assert.deepEqual(verifyV15ReleaseTree(root).filter((item) => !item.passed), []);
});

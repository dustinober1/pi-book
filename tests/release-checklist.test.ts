import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_REGISTRY } from "../scripts/lib/release-registry.js";
import { verifyCurrentRelease } from "../scripts/verify-release.js";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string; scripts: Record<string, string> };

test(`Novel Forge ${packageJson.version} release assets exist and package metadata is aligned`, () => {
  const checks = verifyCurrentRelease(root);
  for (const item of checks) assert.ok(item.passed, `${item.id}: ${item.detail}`);
});

// Each historical entry is a frozen record of what that release asserted.
// It is not expected to pass against a later tree — it is expected to
// correctly notice it has been superseded, the same way it always could.
test("every historical release's frozen checker still correctly reports itself superseded", () => {
  for (const entry of RELEASE_REGISTRY) {
    if (entry.version === packageJson.version) continue;
    const checks = entry.verify(root);
    const packageVersionCheck = checks.find((item) => item.id === "package-version");
    assert.ok(packageVersionCheck, `${entry.version}: no package-version check found`);
    assert.equal(packageVersionCheck!.passed, false, `${entry.version}'s package-version check unexpectedly passes against the current tree.`);
  }
});

// The whole point of this file: adding a release is one entry in
// scripts/lib/release-registry.ts, and these two script names never change.
test("verify:release and test:release target the consolidated, version-independent scripts", () => {
  assert.equal(packageJson.scripts["verify:release"], "node --import tsx scripts/verify-release.ts");
  assert.match(packageJson.scripts["test:release"] ?? "", /tests\/release-checklist\.test\.ts/);
});

test("release docs still describe authority, budgets, privacy, and evaluation limits", () => {
  const joined = ["README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md", "docs/quality-and-cost.md", `docs/releases/v${packageJson.version}.md`]
    .map((path) => readFileSync(join(root, path), "utf8"))
    .join("\n");
  for (const phrase of [packageJson.version, "economy", "balanced", "premium", "editorial", "guarded", "budget", "telemetry", "paid evaluation", "human review"]) {
    assert.match(joined.toLowerCase(), new RegExp(phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("normal CI never runs paid quality evaluation", () => {
  const workflow = readFileSync(join(root, ".github/workflows/test.yml"), "utf8");
  assert.doesNotMatch(workflow, /npm run eval:quality/);
  assert.doesNotMatch(workflow, /NOVEL_FORGE_RUN_PAID_EVAL:\s*["']?1/);
});

test("operational and paid-evaluation outputs remain excluded", () => {
  const ignore = readFileSync(join(root, ".gitignore"), "utf8");
  assert.match(ignore, /\.pi-book\//);
  assert.match(ignore, /evals\/quality\/runs\//);
});

test("the release workflow is a single file shared across versions", () => {
  assert.equal(existsSync(join(root, ".github/workflows/release.yml")), true);
});

test("the changelog carries no unreleased sections", () => {
  assert.doesNotMatch(readFileSync(join(root, "CHANGELOG.md"), "utf8"), /## Unreleased/);
});

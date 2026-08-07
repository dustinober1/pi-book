import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyV210ReleaseTree } from "../scripts/verify-v2-1-0-release.js";

const root = process.cwd();

test("Novel Forge 2.1.0 release assets exist and package metadata is aligned", () => {
  const checks = verifyV210ReleaseTree(root);
  for (const item of checks) assert.ok(item.passed, `${item.id}: ${item.detail}`);
});

test("release docs still describe authority, budgets, privacy, and evaluation limits", () => {
  const joined = ["README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md", "docs/quality-and-cost.md", "docs/releases/v2.1.0.md"]
    .map((path) => readFileSync(join(root, path), "utf8"))
    .join("\n");
  for (const phrase of ["2.1.0", "economy", "balanced", "premium", "editorial", "guarded", "budget", "telemetry", "paid evaluation", "human review"]) {
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

// The 2.1.0 feature commit bumped package.json and the changelog but left the
// runtime constant, release notes, install examples and release checker behind,
// which is what made the default branch red. Assert the whole set together so a
// partial release cut fails here rather than in four unrelated tests.
test("every part of the release set reports the same version", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version: string;
    scripts: Record<string, string>;
  };
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as {
    version: string;
    packages: Record<string, { version?: string }>;
  };
  assert.equal(packageJson.version, "2.1.0");
  assert.equal(lock.version, "2.1.0");
  assert.equal(lock.packages[""]?.version, "2.1.0");
  assert.match(readFileSync(join(root, "src/application/version-core.ts"), "utf8"), /NOVEL_FORGE_VERSION\s*=\s*"2\.1\.0"/);
  assert.equal(packageJson.scripts["verify:release"], "node --import tsx scripts/verify-v2-1-0-release.ts");
  assert.match(packageJson.scripts["test:release"] ?? "", /tests\/v2-1-0-release-checklist\.test\.ts/);
  assert.equal(existsSync(join(root, "docs/releases/v2.1.0.md")), true);
  assert.match(readFileSync(join(root, "README.md"), "utf8"), /@v2\.1\.0/);
  assert.match(readFileSync(join(root, "RELEASE.md"), "utf8"), /## Current verified release: v2\.1\.0/);
});

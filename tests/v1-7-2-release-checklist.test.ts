import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyV172ReleaseTree } from "../scripts/verify-v1-7-2-release.js";

const root = process.cwd();

test("Novel Forge 1.7.2 release assets exist and package metadata is aligned", () => {
  const checks = verifyV172ReleaseTree(root);
  for (const item of checks) assert.ok(item.passed, `${item.id}: ${item.detail}`);
});

test("release docs still describe authority, budgets, privacy, and evaluation limits", () => {
  const joined = ["README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md", "docs/quality-and-cost.md", "docs/releases/v1.7.2.md"]
    .map((path) => readFileSync(join(root, path), "utf8"))
    .join("\n");
  for (const phrase of ["1.7.2", "economy", "balanced", "premium", "editorial", "guarded", "budget", "telemetry", "paid evaluation", "human review"]) {
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

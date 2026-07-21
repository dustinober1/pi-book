import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "src/evaluation/quality-eval.ts",
  "src/evaluation/quality-eval-report.ts",
  "scripts/evaluate-quality.ts",
  "scripts/verify-v1-7-release.ts",
  "evals/quality/README.md",
  "evals/quality/fixtures/thriller-key-scene.yaml",
  "evals/quality/fixtures/romantasy-key-scene.yaml",
  "evals/quality/fixtures/historical-high-risk-scene.yaml",
  "evals/quality/rubrics/automated-diagnostic.md",
  "docs/quality-and-cost.md",
  "docs/grounded-accuracy.md",
  "docs/releases/v1.7.0.md",
];

const packagedQualityAssets = [
  "evals/quality/README.md",
  "evals/quality/fixtures/",
  "evals/quality/rubrics/",
];

test("Novel Forge 1.7 release assets exist and package metadata is aligned", () => {
  for (const path of required) assert.equal(existsSync(join(root, path)), true, `missing ${path}`);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string; scripts: Record<string, string>; files: string[] };
  assert.equal(pkg.version, "1.7.0");
  assert.match(pkg.scripts["eval:quality"] ?? "", /evaluate-quality/);
  assert.match(pkg.scripts["verify:release"] ?? "", /verify-v1-7-release/);
  assert.match(pkg.scripts["test:release"] ?? "", /v1-7-release-checklist/);
  for (const path of packagedQualityAssets) assert.ok(pkg.files.includes(path), path);
  assert.equal(pkg.files.includes("evals/quality/"), false);
  assert.ok(pkg.files.includes("docs/"));
});

test("release docs and skill describe authority, budgets, privacy, and evaluation limits", () => {
  const joined = ["README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md", "docs/quality-and-cost.md", "docs/releases/v1.7.0.md"]
    .map((path) => readFileSync(join(root, path), "utf8"))
    .join("\n");
  for (const phrase of ["1.7.0", "economy", "balanced", "premium", "editorial", "guarded", "budget", "telemetry", "paid evaluation", "human review"]) {
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

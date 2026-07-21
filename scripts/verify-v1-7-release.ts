import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V17ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string { return readFileSync(join(root, path), "utf8"); }
function check(id: string, passed: boolean, detail: string): V17ReleaseCheck { return { id, passed, detail }; }

export function verifyV17ReleaseTree(root: string): V17ReleaseCheck[] {
  const pkg = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const version = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const skill = text(root, "SKILL.md");
  const changelog = text(root, "CHANGELOG.md");
  const release = text(root, "RELEASE.md");
  const notes = text(root, "docs/releases/v1.7.0.md");
  const workflow = text(root, ".github/workflows/test.yml");
  const ignore = text(root, ".gitignore");
  const required = [
    "src/evaluation/quality-eval.ts",
    "src/evaluation/quality-eval-report.ts",
    "scripts/evaluate-quality.ts",
    "scripts/verify-v1-7-release.ts",
    "tests/quality-eval.test.ts",
    "tests/quality-eval-privacy.test.ts",
    "tests/v1-7-release-checklist.test.ts",
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
  return [
    check("package-version", pkg.version === "1.7.0", `package.json version is ${pkg.version}.`),
    check("lock-version", lock.version === "1.7.0" && lock.packages[""]?.version === "1.7.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.0"/.test(version), "Runtime version constant reports 1.7.0."),
    check("required-files", required.every((path) => existsSync(join(root, path))), "All quality evaluation and release assets exist."),
    check("quality-script", /evaluate-quality\.ts/.test(pkg.scripts["eval:quality"] ?? ""), "eval:quality targets the opt-in runner."),
    check("release-script", pkg.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-release.ts", "verify:release targets the 1.7 checker."),
    check("release-test", /v1-7-release-checklist\.test\.ts/.test(pkg.scripts["test:release"] ?? ""), "test:release includes the 1.7 checklist."),
    check("package-assets", ["src/", "scripts/", "docs/", "SKILL.md", "README.md", ...packagedQualityAssets].every((path) => pkg.files.includes(path)), "Package allowlist includes runtime, focused docs, and only frozen evaluation assets."),
    check("paid-output-excluded", /evals\/quality\/runs\//.test(ignore) && !pkg.files.some((path) => path === "evals/quality/" || path.startsWith("evals/quality/runs")), "Paid evaluation outputs are ignored and outside the package allowlist."),
    check("paid-ci-excluded", !/npm run eval:quality/.test(workflow) && !/NOVEL_FORGE_RUN_PAID_EVAL:\s*["']?1/.test(workflow), "Normal CI does not run paid evaluation."),
    check("node-matrix", /22\.19\.0/.test(workflow) && /['"]24['"]/.test(workflow), "CI qualifies Node 22.19.0 and Node 24."),
    check("readme-install", /@v1\.7\.0/.test(readme), "README pins v1.7.0 installation."),
    check("skill-authority", /economy/i.test(skill) && /isolated/i.test(skill) && /guarded/i.test(skill) && /budget/i.test(skill), "Skill documents compatibility, isolation, budgets, and guarded authority."),
    check("changelog", /## 1\.7\.0/.test(changelog), "Changelog contains 1.7.0."),
    check("release-status", /Current verified release: v1\.7\.0/.test(release), "Release status identifies v1.7.0."),
    check("release-boundaries", /paid evaluation/i.test(notes) && /human reader evidence/i.test(notes) && /one validated `applyNovelEvent`/.test(notes), "Release notes document evaluation and authority boundaries."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV17ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

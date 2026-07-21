import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V17ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V17ReleaseCheck {
  return { id, passed, detail };
}

function existsAll(root: string, paths: readonly string[]): boolean {
  return paths.every((path) => existsSync(join(root, path)));
}

export function verifyV17ReleaseTree(root: string): V17ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const skill = text(root, "SKILL.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const qualityDoc = text(root, "docs/quality-and-cost.md");
  const groundedDoc = text(root, "docs/grounded-accuracy.md");
  const notes = text(root, "docs/releases/v1.7.0.md");
  const testWorkflow = text(root, ".github/workflows/test.yml");
  const releaseWorkflow = text(root, ".github/workflows/release-v1-7.yml");
  const gitignore = text(root, ".gitignore");
  const evalReadme = text(root, "evals/quality/README.md");

  const requiredRuntime = [
    "src/evaluation/quality-eval.ts",
    "src/evaluation/quality-eval-report.ts",
    "scripts/evaluate-quality.ts",
    "src/pi/pi-print-worker.ts",
    "src/application/quality-orchestrator.ts",
    "src/application/budget-ledger.ts",
    "src/application/claim-audit.ts",
  ];
  const requiredTests = [
    "tests/quality-eval.test.ts",
    "tests/quality-eval-privacy.test.ts",
    "tests/v1-7-release-checklist.test.ts",
    "tests/model-budget.test.ts",
    "tests/context-budget.test.ts",
    "tests/quality-orchestrator.test.ts",
    "tests/claim-audit.test.ts",
  ];
  const requiredEval = [
    "evals/quality/README.md",
    "evals/quality/rubrics/automated-diagnostic.md",
    "evals/quality/fixtures/thriller-key-scene.yaml",
    "evals/quality/fixtures/romantasy-key-scene.yaml",
    "evals/quality/fixtures/historical-high-risk-scene.yaml",
  ];
  const requiredRelease = [
    "docs/releases/v1.7.0.md",
    "scripts/verify-v1-7-release.ts",
    "tests/v1-7-release-checklist.test.ts",
    ".github/workflows/release-v1-7.yml",
  ];

  const paidMarker = /NOVEL_FORGE_RUN_PAID_EVAL|npm run (?:--silent )?eval:quality/;
  const packageAssets = [
    "src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md",
    "docs/quality-and-cost.md", "docs/grounded-accuracy.md", "docs/releases/v1.7.0.md", "evals/quality/",
  ];

  return [
    check("package-version", packageJson.version === "1.7.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.7.0" && lock.packages[""]?.version === "1.7.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.0"/.test(versionSource), "Runtime version constant reports 1.7.0."),
    check("quality-eval-script", packageJson.scripts["eval:quality"] === "node --import tsx scripts/evaluate-quality.ts", "eval:quality targets the gated evaluator."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-release.ts", "verify:release targets the v1.7.0 checker."),
    check("release-test-script", /v1-7-release-checklist\.test\.ts/.test(packageJson.scripts["test:release"] ?? ""), "test:release includes the v1.7.0 checklist."),
    check("runtime-files", existsAll(root, requiredRuntime), "All quality, budget, worker, and claim-audit runtime modules exist."),
    check("test-files", existsAll(root, requiredTests), "All representative budget, orchestration, claim, evaluation, and release tests exist."),
    check("evaluation-files", existsAll(root, requiredEval), "All frozen quality fixtures and evaluation guidance exist."),
    check("release-files", existsAll(root, requiredRelease), "All v1.7.0 release files exist."),
    check("package-assets", packageAssets.every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime, focused guidance, release notes, and frozen quality fixtures."),
    check("operational-ignore", /(^|\n)\.pi-book\/evals\/(\n|$)/.test(gitignore) && /(^|\n)\.pi-book\/cache\/(\n|$)/.test(gitignore), ".pi-book evaluation and cache outputs are ignored."),
    check("readme-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.7\.0/.test(readme) && /@v1\.7\.0/.test(readme), "README pins v1.7.0 installation."),
    check("readme-focused-docs", /docs\/quality-and-cost\.md/.test(readme) && /docs\/grounded-accuracy\.md/.test(readme), "README links focused quality and grounding guidance."),
    check("quality-documentation", ["Genre profile", "Runtime profile", "Quality tier", "maximum_calls_per_chapter", "on_exhaustion", "delete-on-success", "claim audit", "blinded", "eval:quality", ".pi-book/evals/quality"].every((term) => qualityDoc.toLowerCase().includes(term.toLowerCase())), "Quality documentation covers controls, privacy, grounding, and blinded evaluation."),
    check("grounded-documentation", /evidence anchor/i.test(groundedDoc) && /targeted/i.test(groundedDoc) && /guarded/i.test(groundedDoc), "Grounded-accuracy guidance documents anchors, repair, and canonical authority."),
    check("skill-authority", /economy/i.test(skill) && /isolated/i.test(skill) && /pre-call|before inference/i.test(skill) && /cache.*non-canonical|non-canonical.*cache/i.test(skill) && /guarded.*event/i.test(skill), "SKILL.md records compatibility, isolation, budgeting, cache non-authority, and guarded-event authority."),
    check("changelog", /## 1\.7\.0 — Quality Budgets and Grounded Orchestration/.test(changelog), "Changelog contains the v1.7.0 heading."),
    check("release-status", /Current verified release: v1\.7\.0/.test(release) && /@v1\.7\.0/.test(release), "Release status pins v1.7.0."),
    check("release-notes", /isolated/i.test(notes) && /evidence anchors/i.test(notes) && /blinded/i.test(notes) && /paid evaluation/i.test(notes), "Release notes cover orchestration, grounding, and opt-in evaluation."),
    check("test-node-matrix", /node:\s*\['22\.19\.0', '24'\]/.test(testWorkflow), "Normal CI covers Node 22.19.0 and Node 24."),
    check("test-release-gate", /npm run test:release/.test(testWorkflow), "Normal CI runs the release checklist."),
    check("normal-ci-no-paid-eval", !paidMarker.test(testWorkflow), "Normal CI never invokes paid evaluation or its opt-in flag."),
    check("release-node-matrix", /node:\s*\['22\.19\.0', '24'\]/.test(releaseWorkflow), "Release CI covers Node 22.19.0 and Node 24."),
    check("release-full-verification", ["npm ci", "npm run typecheck", "npm test", "npm run eval", "benchmark:constrained-runtime", "benchmark:prompts", "npm run verify:release", "npm run test:release", "npm pack --dry-run"].every((term) => releaseWorkflow.includes(term)), "Release workflow runs the complete qualification sequence."),
    check("release-ci-no-paid-eval", !paidMarker.test(releaseWorkflow), "Release CI never invokes paid evaluation or its opt-in flag."),
    check("evaluation-boundary", /not human reader evidence/i.test(evalReadme) && /requires NOVEL_FORGE_RUN_PAID_EVAL=1/i.test(evalReadme), "Evaluation guidance preserves the human-evidence and explicit-opt-in boundaries."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV17ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

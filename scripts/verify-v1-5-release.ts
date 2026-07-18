import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V15ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V15ReleaseCheck {
  return { id, passed, detail };
}

function allFiles(root: string, path = root): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules"].includes(entry.name)) continue;
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) output.push(...allFiles(root, absolute));
    else output.push(relative(root, absolute).replace(/\\/g, "/"));
  }
  return output.sort();
}

export function verifyV15ReleaseTree(root: string): V15ReleaseCheck[] {
  const checks: V15ReleaseCheck[] = [];
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; description: string; keywords: string[]; files: string[]; scripts: Record<string, string> };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");

  checks.push(check("package-version", packageJson.version === "1.5.0", `package.json version is ${packageJson.version}.`));
  checks.push(check("lock-version", lock.version === "1.5.0" && lock.packages[""]?.version === "1.5.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`));
  checks.push(check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.5\.0"/.test(versionSource), "Runtime version constant reports 1.5.0."));
  checks.push(check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-5-release.ts", `verify:release is ${packageJson.scripts["verify:release"] ?? "missing"}.`));
  checks.push(check("release-test-script", /v1-5-release-checklist\.test\.ts/.test(packageJson.scripts["test:release"] ?? "") && /v1-5-release-journey\.test\.ts/.test(packageJson.scripts["test:release"] ?? ""), "test:release includes the v1.5 checklist and journey."));
  checks.push(check("package-metadata", /historical-fiction/i.test(packageJson.description) && packageJson.keywords.includes("historical-fiction"), "Package metadata names historical fiction."));

  const required = [
    "src/profiles/historical-fiction.ts",
    "src/domain/historical-fiction.ts",
    "src/domain/v1-5-schema-registry.ts",
    "src/application/historical-integrity.ts",
    "profiles/historical-fiction.yaml",
    "references/templates/novel/historical-context.yaml",
    "references/templates/novel/invention-ledger.yaml",
    "docs/releases/v1.5.0.md",
    "scripts/verify-v1-5-release.ts",
    "tests/v1-5-release-checklist.test.ts",
    "tests/e2e/v1-5-release-journey.test.ts",
    "README.md",
    "SKILL.md",
    "CHANGELOG.md",
    "RELEASE.md",
  ];
  const missing = required.filter((path) => !existsSync(join(root, path)));
  checks.push(check("required-files", missing.length === 0, missing.length ? `Missing: ${missing.join(", ")}.` : "All required 1.5 files exist."));

  const files = allFiles(root);
  const temporary = files.filter((path) => /^docs\/\.|^scripts\/(?:apply|fix)-v1-5|^\.github\/workflows\/apply-v1-5|\.tgz$/i.test(path));
  checks.push(check("no-temporary-files", temporary.length === 0, temporary.length ? `Temporary files: ${temporary.join(", ")}.` : "No temporary files remain."));

  const readme = text(root, "README.md");
  const releaseStatus = text(root, "RELEASE.md");
  const releaseNotes = text(root, "docs/releases/v1.5.0.md");
  const changelog = text(root, "CHANGELOG.md");
  checks.push(check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.5\.0/.test(readme) && /@v1\.5\.0/.test(releaseStatus), "README and release status pin v1.5.0."));
  checks.push(check("changelog-version", /## 1\.5\.0 — Historical Fiction/.test(changelog), "Changelog contains the 1.5.0 release heading."));

  const boundaries = [
    /historical-context\.yaml/,
    /invention-ledger\.yaml/,
    /Historical scene contract/,
    /Historical Note/,
    /writer decision|writer approval/i,
    /does not.*browse|does not.*add.*automatic browsing|no.*scrap/i,
    /thriller and romantasy.*remain|Existing thriller and romantasy/i,
    /not proof of historical truth|not.*historical truth/i,
  ];
  checks.push(check("release-note-boundaries", boundaries.every((pattern) => pattern.test(releaseNotes)), "Release notes document historical evidence, approval, compatibility, automation, and verification boundaries."));

  const allowlist = new Set(packageJson.files ?? []);
  const requiredAllowlist = ["SKILL.md", "README.md", "CHANGELOG.md", "RELEASE.md", "agents/", "extensions/", "src/", "profiles/", "references/", "scripts/", "wizard/"];
  const allowlistValid = requiredAllowlist.every((path) => allowlist.has(path)) && !allowlist.has("tests/") && !allowlist.has("evals/") && !allowlist.has(".github/");
  checks.push(check("package-allowlist", allowlistValid, "Package allowlist includes runtime assets and excludes tests, evaluations, and workflows."));

  const ci = text(root, ".github/workflows/test.yml");
  const releaseWorkflowPath = join(root, ".github/workflows/release-v1-5.yml");
  const releaseWorkflow = existsSync(releaseWorkflowPath) ? readFileSync(releaseWorkflowPath, "utf8") : "";
  checks.push(check("ci-release-verification", /npm run verify:release/.test(ci) && /npm pack --dry-run/.test(ci), "Main CI runs the canonical release verifier and package dry run."));
  checks.push(check("release-workflow", /Node 22\.19\.0|22\.19\.0/.test(releaseWorkflow) && /'24'/.test(releaseWorkflow) && /v1\.5\.0/.test(releaseWorkflow), "Release workflow verifies Node 22.19.0 and 24 before creating v1.5.0."));

  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV15ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

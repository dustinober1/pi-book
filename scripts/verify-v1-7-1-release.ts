import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

const retiredWorkflows = [
  ".github/workflows/release-v1.3.yml",
  ".github/workflows/release-v1-4.yml",
  ".github/workflows/release-v1-6-1.yml",
  ".github/workflows/release-v1-6-2.yml",
  ".github/workflows/release-v1-7.yml",
];

export function verifyV171ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.7.1.md");
  const workflow = text(root, ".github/workflows/release.yml");

  return [
    check("package-version", packageJson.version === "1.7.1", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.7.1" && lock.packages[""]?.version === "1.7.1", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.1"/.test(versionSource), "Runtime version constant reports 1.7.1."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-1-release.ts", "verify:release targets the v1.7.1 checker."),
    check("release-files", ["docs/releases/v1.7.1.md", "scripts/verify-v1-7-1-release.ts", "tests/v1-7-1-release-checklist.test.ts", ".github/workflows/release.yml"].every((path) => existsSync(join(root, path))), "All v1.7.1 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.7\.1/.test(readme) && /@v1\.7\.1/.test(release), "README and release status pin v1.7.1."),
    check("changelog", /## 1\.7\.1 — Release Workflow Consolidation/.test(changelog), "Changelog contains the v1.7.1 heading."),
    check("release-notes", /release-v1-6-1\.yml/.test(notes) && /reads the package version from `package\.json` at run time/.test(notes), "Release notes describe the workflow consolidation."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
    check("release-workflow-consolidated", /require\(['"]\.\/package\.json['"]\)\.version/.test(workflow) && /npm run verify:release/.test(workflow) && /npm pack --dry-run/.test(workflow), "The single release workflow reads the package version at run time and still verifies and packages the release."),
    check("retired-workflows-removed", retiredWorkflows.every((path) => !existsSync(join(root, path))), "The version-pinned per-release workflow files no longer exist."),
  ];
}

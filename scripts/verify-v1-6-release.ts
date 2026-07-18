import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V16ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V16ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV16ReleaseTree(root: string): V16ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.6.0.md");
  const workflow = text(root, ".github/workflows/release-v1-6.yml");

  return [
    check("package-version", packageJson.version === "1.6.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.6.0" && lock.packages[""]?.version === "1.6.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.6\.0"/.test(versionSource), "Runtime version constant reports 1.6.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-6-release.ts", "verify:release targets the v1.6 checker."),
    check("release-files", ["docs/releases/v1.6.0.md", "scripts/verify-v1-6-release.ts", "tests/v1-6-release-checklist.test.ts", ".github/workflows/release-v1-6.yml"].every((path) => existsSync(join(root, path))), "All v1.6 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.6\.0/.test(readme) && /@v1\.6\.0/.test(release), "README and release status pin v1.6.0."),
    check("changelog", /## 1\.6\.0 — Deterministic Prose Lint/.test(changelog), "Changelog contains the v1.6.0 heading."),
    check("release-notes", /deterministic prose lint/i.test(notes) && /does not detect or establish authorship/i.test(notes), "Release notes preserve the deterministic-lint boundary."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
    check("release-workflow", /v1\.6\.0/.test(workflow) && /npm run verify:release/.test(workflow) && /npm pack --dry-run/.test(workflow), "Release workflow verifies and packages v1.6.0."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV16ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

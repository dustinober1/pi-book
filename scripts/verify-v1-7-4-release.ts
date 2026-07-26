import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V174ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V174ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV174ReleaseTree(root: string): V174ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.7.4.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.7.4", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.7.4" && lock.packages[""]?.version === "1.7.4", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.4"/.test(versionSource), "Runtime version constant reports 1.7.4."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-4-release.ts", "verify:release targets the v1.7.4 checker."),
    check("release-files", ["docs/releases/v1.7.4.md", "scripts/verify-v1-7-4-release.ts", "tests/v1-7-4-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.7.4 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.7\.4/.test(readme) && /@v1\.7\.4/.test(release), "README and release status pin v1.7.4."),
    check("changelog", /## 1\.7\.4 — Registered Source Provenance Guidance/.test(changelog), "Changelog contains the v1.7.4 heading."),
    check("release-notes", /references missing source series\/series-bible\.md/.test(notes) && /register a source entry/.test(notes), "Release notes describe the registered-source-provenance fix."),
    check("skill-source-provenance-rule", /never a raw file path or the name of an existing project document/.test(skill), "SKILL.md requires source_ids to resolve to a registered source-register entry."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV174ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

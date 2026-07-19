import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V162ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V162ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV162ReleaseTree(root: string): V162ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.6.2.md");
  const workflow = text(root, ".github/workflows/release-v1-6-2.yml");
  const events = text(root, "src/application/events.ts");
  const gateMetadata = text(root, "src/application/gate-metadata.ts");

  return [
    check("package-version", packageJson.version === "1.6.2", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.6.2" && lock.packages[""]?.version === "1.6.2", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.6\.2"/.test(versionSource), "Runtime version constant reports 1.6.2."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-6-2-release.ts", "verify:release targets the v1.6.2 checker."),
    check("release-files", ["docs/releases/v1.6.2.md", "scripts/verify-v1-6-2-release.ts", "tests/v1-6-2-release-checklist.test.ts", ".github/workflows/release-v1-6-2.yml"].every((path) => existsSync(join(root, path))), "All v1.6.2 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.6\.2/.test(readme) && /@v1\.6\.2/.test(release), "README and release status pin v1.6.2."),
    check("changelog", /## 1\.6\.2 — Complete Manuscript Approval Evidence/.test(changelog), "Changelog contains the v1.6.2 heading."),
    check("release-notes", /delivery\/manuscript\.md/.test(notes) && /before setting `manuscript-approval` to pending/.test(notes), "Release notes describe pre-approval manuscript compilation."),
    check("approval-compilation", /setChange\(changes, "delivery\/manuscript\.md", manuscript\.content\)/.test(events), "Manuscript review transaction writes the compiled manuscript."),
    check("approval-evidence", /return \["delivery\/manuscript\.md"/.test(gateMetadata), "Manuscript approval evidence includes the compiled manuscript."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
    check("release-workflow", /v1\.6\.2/.test(workflow) && /npm run verify:release/.test(workflow) && /npm pack --dry-run/.test(workflow), "Release workflow verifies and packages v1.6.2."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV162ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

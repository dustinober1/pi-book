import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

export function verifyV162ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.6.2.md");
  const workflowPath = existsSync(join(root, ".github/workflows/release-v1-6-2.yml"))
    ? ".github/workflows/release-v1-6-2.yml"
    : ".github/workflows/release.yml";
  const workflow = text(root, workflowPath);
  const events = text(root, "src/application/events.ts");
  const gateMetadata = text(root, "src/application/gate-metadata.ts");

  return [
    check("package-version", packageJson.version === "1.6.2", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.6.2" && lock.packages[""]?.version === "1.6.2", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.6\.2"/.test(versionSource), "Runtime version constant reports 1.6.2."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-6-2-release.ts", "verify:release targets the v1.6.2 checker."),
    check("release-files", ["docs/releases/v1.6.2.md", "scripts/verify-v1-6-2-release.ts", "tests/v1-6-2-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.6.2 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.6\.2/.test(readme) && /@v1\.6\.2/.test(release), "README and release status pin v1.6.2."),
    check("changelog", /## 1\.6\.2 — Complete Manuscript Approval Evidence/.test(changelog), "Changelog contains the v1.6.2 heading."),
    check("release-notes", /delivery\/manuscript\.md/.test(notes) && /before setting `manuscript-approval` to pending/.test(notes), "Release notes describe pre-approval manuscript compilation."),
    check("approval-compilation", /setChange\(changes, "delivery\/manuscript\.md", manuscript\.content\)/.test(events), "Manuscript review transaction writes the compiled manuscript."),
    check("approval-evidence", /return \["delivery\/manuscript\.md"/.test(gateMetadata), "Manuscript approval evidence includes the compiled manuscript."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
    check("release-workflow", /npm run verify:release/.test(workflow) && /npm pack --dry-run/.test(workflow), "The active release workflow verifies and packages the release."),
  ];
}

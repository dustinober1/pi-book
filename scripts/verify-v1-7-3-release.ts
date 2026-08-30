import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

export function verifyV173ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.7.3.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.7.3", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.7.3" && lock.packages[""]?.version === "1.7.3", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.3"/.test(versionSource), "Runtime version constant reports 1.7.3."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-3-release.ts", "verify:release targets the v1.7.3 checker."),
    check("release-files", ["docs/releases/v1.7.3.md", "scripts/verify-v1-7-3-release.ts", "tests/v1-7-3-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.7.3 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.7\.3/.test(readme) && /@v1\.7\.3/.test(release), "README and release status pin v1.7.3."),
    check("changelog", /## 1\.7\.3 — Decision-Ledger Event Boundary Guidance/.test(changelog), "Changelog contains the v1.7.3 heading."),
    check("release-notes", /allowlist-violation/.test(notes) && /never an allowed file for a `book-plan` event/.test(notes), "Release notes describe the decision-ledger allowlist fix."),
    check("skill-decision-ledger-boundary", /`series\/decision-ledger\.yaml` is never an allowed file for a `book-plan` event/.test(skill), "SKILL.md states the decision-ledger/book-plan boundary explicitly."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
  ];
}

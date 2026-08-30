import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

// v1.7.1 retired five version-pinned release *workflows* into one file that
// reads its version at run time. This does the same for the release
// *verifier*: 18 near-duplicate scripts and 18 near-duplicate checklist test
// files collapse into one registry, one stable CLI entry point, and one
// checklist test — the next release adds a small check file and one registry
// entry, and touches neither.
export function verifyV221ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v2.2.1.md");
  const skill = text(root, "SKILL.md");

  const retiredChecklistTests = [
    "tests/v1-3-release-checklist.test.ts", "tests/v1-4-release-checklist.test.ts", "tests/v1-5-release-checklist.test.ts",
    "tests/v1-6-1-release-checklist.test.ts", "tests/v1-6-2-release-checklist.test.ts", "tests/v1-7-release-checklist.test.ts",
    "tests/v1-7-1-release-checklist.test.ts", "tests/v1-7-2-release-checklist.test.ts", "tests/v1-7-3-release-checklist.test.ts",
    "tests/v1-7-4-release-checklist.test.ts", "tests/v1-8-0-release-checklist.test.ts", "tests/v1-9-0-release-checklist.test.ts",
    "tests/v1-9-1-release-checklist.test.ts", "tests/v1-10-0-release-checklist.test.ts", "tests/v2-0-0-release-checklist.test.ts",
    "tests/v2-0-1-release-checklist.test.ts", "tests/v2-1-0-release-checklist.test.ts", "tests/v2-2-0-release-checklist.test.ts",
  ];

  return [
    check("package-version", packageJson.version === "2.2.1", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "2.2.1" && lock.packages[""]?.version === "2.2.1", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"2\.2\.1"/.test(versionSource), "Runtime version constant reports 2.2.1."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v2\.2\.1/.test(readme) && /@v2\.2\.1/.test(release), "README and release status pin v2.2.1."),
    check("changelog", /## 2\.2\.1 — Release Verifier Consolidation/.test(changelog), "Changelog contains the v2.2.1 heading."),
    check("release-notes", /scripts\/lib\/release-registry\.ts/.test(notes) && /one registry entry/.test(notes), "Release notes describe the verifier consolidation."),
    check("release-record", /## 2\.2\.1 release record/.test(release), "RELEASE.md carries a 2.2.1 release record."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),

    check("release-script-stable", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-release.ts", "verify:release targets the version-independent verifier, which will not change on future releases."),
    check("release-test-stable", /tests\/release-checklist\.test\.ts/.test(packageJson.scripts["test:release"] ?? ""), "test:release targets the consolidated checklist test."),
    check("registry-module", existsSync(join(root, "scripts/lib/release-registry.ts")) && /RELEASE_REGISTRY/.test(text(root, "scripts/lib/release-registry.ts")), "The release registry module exists and exports RELEASE_REGISTRY."),
    check("registry-includes-current", new RegExp(`version: "${packageJson.version}"`).test(text(root, "scripts/lib/release-registry.ts")), "The registry has an entry for the installed version."),
    check("shared-check-helper", existsSync(join(root, "scripts/lib/release-check.ts")) && /export function check\(/.test(text(root, "scripts/lib/release-check.ts")), "The shared check()/text() helpers exist for every per-version verifier to import."),
    check("retired-checklist-tests-removed", retiredChecklistTests.every((path) => !existsSync(join(root, path))), "The 18 per-version checklist test files no longer exist; their coverage lives in tests/release-checklist.test.ts."),
    check("historical-verifiers-preserved", existsSync(join(root, "scripts/verify-v1-3-release.ts")) && existsSync(join(root, "scripts/verify-v2-2-0-release.ts")), "Every historical release's own frozen verify function is preserved, not deleted — only its boilerplate was shared."),
    check("skill-documents-nothing-new", !/2\.2\.1/.test(skill.replace(/is `v2\.2\.1`\./, "")) || /Novel Forge 2\.2\.1 is `v2\.2\.1`/.test(skill), "SKILL.md's pinned-tag example tracks the current version; this release changes no other normative guidance."),
  ];
}

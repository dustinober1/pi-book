import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V180ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V180ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV180ReleaseTree(root: string): V180ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.8.0.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.8.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.8.0" && lock.packages[""]?.version === "1.8.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.8\.0"/.test(versionSource), "Runtime version constant reports 1.8.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-8-0-release.ts", "verify:release targets the v1.8.0 checker."),
    check("release-files", ["docs/releases/v1.8.0.md", "scripts/verify-v1-8-0-release.ts", "tests/v1-8-0-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.8.0 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.8\.0/.test(readme) && /@v1\.8\.0/.test(release), "README and release status pin v1.8.0."),
    check("changelog", /## 1\.8\.0 — Aggregated Event Validation/.test(changelog), "Changelog contains the v1.8.0 heading."),
    check("release-notes", /reports every validation problem at once/.test(notes) && /no longer contradicts the required-file rule/.test(notes), "Release notes describe the aggregated-validation fix."),
    check("aggregator-module", existsSync(join(root, "src/application/validation-aggregate.ts")) && /validation problems must all be fixed/.test(text(root, "src/application/validation-aggregate.ts")), "The validation aggregator reports every problem in one rejection."),
    check("retry-instruction", /resubmit the complete required file set/.test(text(root, "src/application/event-rejection.ts")) && !/Correct only the rejected payload/.test(text(root, "src/application/event-rejection.ts")), "The retryable instruction requires the complete file set."),
    check("skill-required-sets", /An event is validated as a complete set, not file by file/.test(skill) && /invention-ledger\.yaml\s+\(historical-fiction only\)/.test(skill), "SKILL.md lists the required output set for each event type."),
    check("skill-source-provenance-rule", /never a raw file path or the name of an existing project document/.test(skill), "SKILL.md requires source_ids to resolve to a registered source-register entry."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV180ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

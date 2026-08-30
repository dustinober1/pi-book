import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

export function verifyV190ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.9.0.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.9.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.9.0" && lock.packages[""]?.version === "1.9.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.9\.0"/.test(versionSource), "Runtime version constant reports 1.9.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-9-0-release.ts", "verify:release targets the v1.9.0 checker."),
    check("release-files", ["docs/releases/v1.9.0.md", "scripts/verify-v1-9-0-release.ts", "tests/v1-9-0-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.9.0 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.9\.0/.test(readme) && /@v1\.9\.0/.test(release), "README and release status pin v1.9.0."),
    check("changelog", /## 1\.9\.0 — Actionable Rejections and Dry-Run Validation/.test(changelog), "Changelog contains the v1.9.0 heading."),
    check("release-notes", /novel_validate_event/.test(notes) && /Schema failures name the field/.test(notes), "Release notes describe the dry-run tool and schema diagnostics."),
    check("dry-run-tool", /name: "novel_validate_event"/.test(text(root, "src/pi/extension.ts")) && /export function validateNovelEvent/.test(text(root, "src/application/events.ts")), "novel_validate_event is registered and backed by a non-writing validator."),
    check("schema-diagnostics", existsSync(join(root, "src/domain/schema-errors.ts")) && /closest of \$\{options\.length\} allowed shapes/.test(text(root, "src/domain/schema-errors.ts")), "Schema errors expand unions against the closest matching shape."),
    check("payload-rejection-code", /"payload-validation"/.test(text(root, "src/application/event-rejection.ts")) && /PAYLOAD_BLOCKERS/.test(text(root, "src/application/event-rejection.ts")), "Payload-fixable blockers classify as a retryable rejection code."),
    check("skill-dry-run", /Call `novel_validate_event` before `novel_apply_event`/.test(skill), "SKILL.md directs agents to validate before applying."),
    check("aggregator-module", existsSync(join(root, "src/application/validation-aggregate.ts")) && /validation problems must all be fixed/.test(text(root, "src/application/validation-aggregate.ts")), "The validation aggregator reports every problem in one rejection."),
    check("retry-instruction", /resubmit the complete required file set/.test(text(root, "src/application/event-rejection.ts")) && !/Correct only the rejected payload/.test(text(root, "src/application/event-rejection.ts")), "The retryable instruction requires the complete file set."),
    check("skill-required-sets", /An event is validated as a complete set, not file by file/.test(skill) && /invention-ledger\.yaml\s+\(historical-fiction only\)/.test(skill), "SKILL.md lists the required output set for each event type."),
    check("skill-source-provenance-rule", /never a raw file path or the name of an existing project document/.test(skill), "SKILL.md requires source_ids to resolve to a registered source-register entry."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
  ];
}

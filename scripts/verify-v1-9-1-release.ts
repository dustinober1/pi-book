import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V191ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V191ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV191ReleaseTree(root: string): V191ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.9.1.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.9.1", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.9.1" && lock.packages[""]?.version === "1.9.1", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.9\.1"/.test(versionSource), "Runtime version constant reports 1.9.1."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-9-1-release.ts", "verify:release targets the v1.9.1 checker."),
    check("release-files", ["docs/releases/v1.9.1.md", "scripts/verify-v1-9-1-release.ts", "tests/v1-9-1-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.9.1 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.9\.1/.test(readme) && /@v1\.9\.1/.test(release), "README and release status pin v1.9.1."),
    check("changelog", /## 1\.9\.1 — Drafting Boundary and Path Diagnostics/.test(changelog), "Changelog contains the v1.9.1 heading."),
    check("release-notes", /begins with the chapter number/.test(notes) && /forbids touching the project root outside an event/.test(notes), "Release notes describe the drafting boundary and path diagnostics."),
    check("manuscript-path-hint", /must begin with the chapter number/.test(text(root, "src/application/events.ts")), "A rejected manuscript path states the naming rule."),
    check("chapter-contract-remedy", /authored, not generated/.test(text(root, "src/application/chapter-execution-preparation.ts")) && /draft-chapter event instead/.test(text(root, "src/application/chapter-execution-preparation.ts")), "A missing chapter contract explains how to author one."),
    check("critic-enum", /Type\.Literal\("character-intent"\)/.test(text(root, "src/pi/chapter-step-command.ts")), "novel_advance_chapter_step enumerates its critics."),
    check("skill-project-root-boundary", /Never create, move, rename, or delete any file inside the project root/.test(skill) && /`rm -rf` inside the project root/.test(skill), "SKILL.md forbids filesystem changes outside a guarded event."),
    check("skill-no-source-reading", /Do not go looking for the implementation's source/.test(skill) && !/Check the relevant `Type\.Object\(\.\.\.\)` schema in `src\/domain\/schemas\.ts`/.test(skill), "SKILL.md points at the installed skill instead of the implementation source."),
    check("skill-chapter-naming", /must \*\*begin with the chapter number\*\*/.test(skill) && /Never silently substitute hand-drafting for the guarded path/.test(skill), "SKILL.md documents chapter output paths and the guarded drafting path."),
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV191ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

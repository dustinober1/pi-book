import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

export function verifyV1100ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.10.0.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "1.10.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.10.0" && lock.packages[""]?.version === "1.10.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.10\.0"/.test(versionSource), "Runtime version constant reports 1.10.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-10-0-release.ts", "verify:release targets the v1.10.0 checker."),
    check("release-files", ["docs/releases/v1.10.0.md", "scripts/verify-v1-10-0-release.ts", "tests/v1-10-0-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.10.0 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.10\.0/.test(readme) && /@v1\.10\.0/.test(release), "README and release status pin v1.10.0."),
    check("changelog", /## 1\.10\.0 — Chapter Length and Working-Tree Enforcement/.test(changelog), "Changelog contains the v1.10.0 heading."),
    check("release-notes", /target_words/.test(notes) && /out of band/i.test(notes), "Release notes describe chapter-length and working-tree enforcement."),
    check("draft-length-module", existsSync(join(root, "src/application/draft-length.ts")) && /DRAFT_LENGTH_BLOCKING_FLOOR/.test(text(root, "src/application/draft-length.ts")), "Chapter drafts are measured against their packet target."),
    check("draft-length-wired", /Draft-length validation blocked draft-chapter/.test(text(root, "src/application/events.ts")), "A draft far from its packet target is rejected."),
    check("working-tree-guard", existsSync(join(root, "src/application/working-tree-guard.ts")) && /would discard that work/.test(text(root, "src/application/working-tree-guard.ts")), "An out-of-band write to a submitted path is detected through Git."),
    check("working-tree-wired", /Working-tree validation blocked/.test(text(root, "src/application/events.ts")) && /gitDirtyPaths/.test(text(root, "src/infrastructure/git.ts")), "The working-tree guard runs inside event validation."),
    check("guarded-execution-disclosure", /without guarded scene execution/.test(text(root, "src/application/events.ts")) && /guardedExecutionSkipReason/.test(text(root, "src/application/events.ts")), "A draft-chapter event discloses that critics and repair did not run."),
    check("advisory-surface", /Report these to the writer in your summary/.test(text(root, "src/pi/extension.ts")), "Advisories are rendered in the tool result the agent must read."),
    check("new-blocker-codes", /draft-length validation blocked/.test(text(root, "src/application/event-rejection.ts")) && /working-tree validation blocked/.test(text(root, "src/application/event-rejection.ts")), "Both new blockers classify as retryable payload rejections."),
    check("skill-chapter-length", /Between 85% and 110% of target it passes silently/.test(skill) && /Below 60% or above 150% the event is \*\*rejected\*\*/.test(skill), "SKILL.md documents the chapter-length bands."),
    check("skill-enforced-boundary", /This is enforced, not merely asked/.test(skill) && /Do not stage your work by writing the project tree first/.test(skill), "SKILL.md states that the project-root boundary is enforced through Git."),
    check("skill-advisories", /Reproduce each one in your summary/.test(skill) && /state which claims the tool checked and which are your own judgment/.test(skill), "SKILL.md requires advisories to reach the writer and forbids mixing verified and self-graded claims."),
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

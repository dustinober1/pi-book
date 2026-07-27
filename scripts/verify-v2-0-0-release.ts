import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V200ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V200ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV200ReleaseTree(root: string): V200ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v2.0.0.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "2.0.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "2.0.0" && lock.packages[""]?.version === "2.0.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"2\.0\.0"/.test(versionSource), "Runtime version constant reports 2.0.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v2-0-0-release.ts", "verify:release targets the v2.0.0 checker."),
    check("release-files", ["docs/releases/v1.10.0.md", "scripts/verify-v2-0-0-release.ts", "tests/v1-10-0-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v2.0.0 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v2\.0\.0/.test(readme) && /@v2\.0\.0/.test(release), "README and release status pin v2.0.0."),
    check("changelog", /## 2\.0\.0 — Making the Quality Path the Default Path/.test(changelog), "Changelog contains the v2.0.0 heading."),
    check("release-notes", /unreachable|could be reached/i.test(notes) && /reference band/i.test(notes), "Release notes describe reaching the quality path and the reference bands."),
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

    check(
      "reference-bands",
      existsSync(join(root, "src/application/prose-lint/reference-bands.ts"))
        && /em_dash_rate_per_1000/.test(text(root, "src/application/prose-lint/reference-bands.ts"))
        && /ABSOLUTE_BAND_MINIMUM_WORDS/.test(text(root, "src/application/prose-lint/reference-bands.ts")),
      "Absolute published-fiction reference bands ship with the runtime.",
    ),
    check(
      "reference-bands-wired",
      /bandBreach\(definition\.baselineKey, corpus\.rate\)/.test(text(root, "src/application/prose-lint/rules/style-patterns.ts")),
      "Style rules evaluate an absolute band before either relative comparison.",
    ),
    check(
      "draft-lint-module",
      existsSync(join(root, "src/application/draft-lint.ts"))
        && /No accepted voice baseline exists/.test(text(root, "src/application/draft-lint.ts")),
      "Draft lint runs on submitted text and reports a missing voice baseline.",
    ),
    check(
      "draft-lint-wired",
      /draftLintReport\(root, input\.chapter, draft\.path, draft\.content\)/.test(text(root, "src/application/events.ts")),
      "Every draft-chapter event lints the submitted chapter.",
    ),
    check(
      "dialogue-voice",
      existsSync(join(root, "src/application/dialogue-voice.ts"))
        && /not distinguishable by their dialogue/.test(text(root, "src/application/dialogue-voice.ts"))
        && /MINIMUM_SPEAKER_WORDS/.test(text(root, "src/application/dialogue-voice.ts")),
      "Dialogue is measured per named speaker with a sample floor.",
    ),
    check(
      "dialogue-voice-wired",
      /style-pattern\/character-voice-uniformity/.test(text(root, "src/application/prose-lint/rules/dialogue-voice.ts"))
        && /dialogueVoiceRules/.test(text(root, "src/application/draft-lint.ts")),
      "Character-voice uniformity reaches draft events and review through the rule pipeline.",
    ),
    check(
      "contract-skeletons",
      existsSync(join(root, "src/application/chapter-contract-skeletons.ts"))
        && /are deliberately NOT invented/.test(text(root, "src/application/chapter-contract-skeletons.ts")),
      "Chapter contract skeletons compile the derivable fields and never invent judgement fields.",
    ),
    check(
      "contract-skeletons-wired",
      /appendChapterContractSkeletons\(root, changes, book\.book_id, queue\)/.test(text(root, "src/application/events.ts"))
        && /chapterContractReadinessAdvisories/.test(text(root, "src/application/events.ts")),
      "A chapter-queue event compiles skeletons and reports incomplete contracts.",
    ),
    check(
      "structural-rhythm",
      existsSync(join(root, "src/application/structural-rhythm.ts"))
        && /uniform-chapter-length/.test(text(root, "src/application/structural-rhythm.ts"))
        && /periodic-pov-rotation/.test(text(root, "src/application/structural-rhythm.ts")),
      "Structural rhythm checks cover chapter length, POV rotation, causality, and endings.",
    ),
    check(
      "structural-rhythm-wired",
      /structuralRhythmFindings\(queue, plot\)/.test(text(root, "src/application/book-strategy.ts"))
        && /structuralRhythmFindings\(queue, plot\)/.test(text(root, "src/application/events.ts")),
      "Uniform chapter targets block a book plan and rhythm warnings reach the writer.",
    ),
    check(
      "reader-checkpoint",
      existsSync(join(root, "src/application/reader-checkpoint.ts"))
        && /no-human-reader-evidence/.test(text(root, "src/application/reader-checkpoint.ts"))
        && /they are not readers/.test(text(root, "src/application/reader-checkpoint.ts")),
      "A package event requires recorded human reader evidence.",
    ),
    check(
      "reader-checkpoint-wired",
      /Reader-checkpoint validation blocked package/.test(text(root, "src/application/events.ts"))
        && /reader-checkpoint validation blocked/.test(text(root, "src/application/event-rejection.ts")),
      "The reader checkpoint classifies as a non-retryable human gate.",
    ),
    check(
      "no-authorship-claims",
      !/AI-written|AI probability|machine-generated/i.test(text(root, "src/application/prose-lint/reference-bands.ts"))
        && !/AI-written|AI probability|machine-generated/i.test(text(root, "src/application/dialogue-voice.ts"))
        && /review evidence, not authorship detection/.test(text(root, "src/application/draft-lint.ts")),
      "No style finding claims authorship detection.",
    ),
    check(
      "skill-reference-bands",
      /review evidence, not authorship detection\*\*/.test(skill) && /absolute published-fiction reference bands/.test(skill),
      "SKILL.md documents the reference bands as review evidence.",
    ),
    check(
      "skill-character-voice",
      /### Character voice/.test(skill) && /a single writing voice wearing different names/.test(skill),
      "SKILL.md documents per-character dialogue measurement.",
    ),
    check(
      "skill-structural-rhythm",
      /## Structural rhythm/.test(skill) && /enforces uniform pacing on the finished book/.test(skill),
      "SKILL.md documents the structural rhythm checks.",
    ),
    check(
      "skill-reader-checkpoint",
      /requires\*\* that at least one human has responded/.test(skill) && /`human-gate-required` and is not retryable/.test(skill),
      "SKILL.md documents the human reader checkpoint.",
    ),
    check(
      "skill-contract-skeletons",
      /compiles a contract skeleton for every ready packet/.test(skill) && /would make guarded execution appear available/.test(skill),
      "SKILL.md documents the contract-skeleton workflow.",
    ),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV200ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}

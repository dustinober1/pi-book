import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

export function verifyV210ReleaseTree(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v2.1.0.md");
  const skill = text(root, "SKILL.md");

  return [
    check("package-version", packageJson.version === "2.1.0", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "2.1.0" && lock.packages[""]?.version === "2.1.0", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"2\.1\.0"/.test(versionSource), "Runtime version constant reports 2.1.0."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v2-1-0-release.ts", "verify:release targets the v2.1.0 checker."),
    check("release-files", ["docs/releases/v2.1.0.md", "scripts/verify-v2-1-0-release.ts", "tests/v2-1-0-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v2.1.0 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v2\.1\.0/.test(readme) && /@v2\.1\.0/.test(release), "README and release status pin v2.1.0."),
    check("changelog", /## 2\.1\.0 — Relationship Inheritance and Ending-Contract Evidence/.test(changelog), "Changelog contains the v2.1.0 heading."),
    check("release-notes", /inherited_relationship_ids/.test(notes) && /delivered_ending/.test(notes), "Release notes describe relationship inheritance and the delivered-ending declaration."),
    check("release-record", /## 2\.1\.0 release record/.test(release), "RELEASE.md carries a 2.1.0 release record."),
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
        && /Nothing semantic is invented here/.test(text(root, "src/application/chapter-contract-skeletons.ts"))
        && /stay with the author/.test(text(root, "src/application/chapter-contract-skeletons.ts")),
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

    check(
      "child-project-roots-helper",
      /export function childProjectRoots/.test(text(root, "src/infrastructure/files.ts")),
      "A narrow, read-only sibling-project lookup exists in the infrastructure layer.",
    ),
    check(
      "require-project-root-fallback",
      /const children = childProjectRoots\(cwd\)/.test(text(root, "src/project/store.ts"))
        && /children\.length === 1/.test(text(root, "src/project/store.ts")),
      "requireProjectRoot resolves the sole sibling project novel-start just created.",
    ),
    check(
      "require-project-root-ambiguity",
      /Multiple Novel Forge projects exist directly under/.test(text(root, "src/project/store.ts")),
      "Two or more sibling projects produce a named, actionable ambiguity error.",
    ),
    check(
      "fallback-scoped-away-from-find-project-root",
      !/childProjectRoots/.test(text(root, "src/infrastructure/files.ts").split("export function childProjectRoots")[0] ?? "")
        && !text(root, "src/application/organizer/scan.ts").includes("childProjectRoots"),
      "The sibling-project fallback is not used by the organizer's ancestor-nesting guard.",
    ),

    check(
      "relationship-inheritance",
      /relationships: canon\.relationships\.filter/.test(text(root, "src/application/next-book.ts"))
        && /inherited_relationship_ids: inheritedRelationshipIds/.test(text(root, "src/application/next-book.ts")),
      "Locked canon relationships are proposed for inheritance and written to inherited-context.yaml.",
    ),
    check(
      "relationship-inheritance-validated",
      /Inherited relationship ID is not locked and available/.test(text(root, "src/application/next-book.ts")),
      "An unlocked or unknown relationship ID is rejected exactly as an inherited canon ID is.",
    ),
    check(
      "relationship-inheritance-optional",
      /inherited_relationship_ids/.test(text(root, "src/domain/v1-2-schemas.ts"))
        && /Type\.Optional\(/.test(text(root, "src/domain/v1-2-schemas.ts")),
      "inherited_relationship_ids is optional, so earlier inherited-context.yaml files remain readable.",
    ),
    check(
      "ending-contract",
      existsSync(join(root, "src/application/ending-contract.ts"))
        && /no-delivered-ending-declared/.test(text(root, "src/application/ending-contract.ts"))
        && /ending-contract-mismatch/.test(text(root, "src/application/ending-contract.ts")),
      "A declared romantasy ending contract requires a matching recorded delivered ending.",
    ),
    check(
      "ending-contract-wired",
      /endingContractFindings/.test(text(root, "src/application/package-checklist.ts")),
      "The ending-contract check runs as a blocking packaging checklist item.",
    ),
    check(
      "ending-contract-scoped",
      /genre\.profile !== "romantasy"/.test(text(root, "src/application/ending-contract.ts")),
      "Thriller and historical-fiction packaging is unaffected by the ending-contract check.",
    ),
    check(
      "ending-contract-reads-no-manuscript",
      /not an automated read of the manuscript/.test(text(root, "src/application/ending-contract.ts"))
        && !/listChapterFiles|manuscript\//.test(text(root, "src/application/ending-contract.ts")),
      "The ending-contract check never reads manuscript prose or infers a disposition.",
    ),
    check(
      "guide-actions-dispatched",
      /id === "plan-change"/.test(text(root, "src/pi/extension.ts")),
      "Every guide action the screen can emit has a handler, including plan-change.",
    ),

    check(
      "model-profile-threaded",
      /parseSelectableModelExecutionProfileId/.test(text(root, "src/pi/extension.ts"))
        && /draft\.modelExecutionProfile/.test(text(root, "src/pi/recalibration-extension.ts"))
        && /parsed\.modelExecutionProfile/.test(text(root, "src/pi/recalibration-extension.ts")),
      "--model-profile reaches project creation and both the draft and run paths.",
    ),
    check(
      "prompt-compile-matrix",
      existsSync(join(root, "src/evaluation/prompt-compile-matrix.ts"))
        && /runPromptCompileMatrix/.test(text(root, "scripts/benchmark-prompts.ts")),
      "Every stage spec compiles under every runtime and genre profile in CI.",
    ),
    check(
      "book-plan-phase-split",
      existsSync(join(root, "src/application/book-plan-prompt-plan.ts"))
        && /bookPlanStagePhases/.test(text(root, "src/application/stage-specs/index.ts"))
        && /omitting an architecture file is itself a rejection/.test(text(root, "src/application/stage-specs/index.ts")),
      "A compact instruction budget splits book planning into two phases feeding one guarded event.",
    ),
    check(
      "repair-cycle-bounded",
      /repairLimitBlocker/.test(text(root, "src/application/chapter-execution-stepper.ts"))
        && /maxRepairAttempts/.test(text(root, "src/application/chapter-execution-stepper.ts"))
        && /code: "repair-limit"/.test(text(root, "src/application/chapter-execution-stepper.ts")),
      "The deterministic-validation and span-repair cycle is bounded by the runtime profile.",
    ),
    check(
      "chapter-execution-driver",
      existsSync(join(root, "src/application/chapter-execution-run.ts"))
        && /awaiting-critic-selection/.test(text(root, "src/application/chapter-execution-run.ts"))
        && /assertNoActiveWriterGate/.test(text(root, "src/application/chapter-execution-run.ts")),
      "A driver loop advances chapter execution, stops at every single-step boundary, and never crosses a writer gate.",
    ),
    check(
      "guarded-path-is-the-automated-path",
      /chapterExecutionReadiness/.test(text(root, "src/application/quality-persistent-run.ts"))
        && /runChapterExecution/.test(text(root, "src/application/quality-persistent-run.ts"))
        && /guarded-scene-execution/.test(text(root, "src/application/quality-persistent-run.ts")),
      "Persistent runs take the guarded scene path whenever an executable contract exists and disclose when they do not.",
    ),
    check(
      "chapter-count-not-capped-by-profile",
      !/maxChaptersPerRun: 1,/.test(text(root, "src/domain/runtime-profile.ts")),
      "No runtime profile clamps a persistent run to a single chapter.",
    ),

    check(
      "run-targets-reach-the-end",
      /"packaging", "complete"/.test(text(root, "src/pi/arguments.ts"))
        && /project\.current_stage === target/.test(text(root, "src/application/autopilot.ts")),
      "A run can be aimed at packaging or completion, and a stage target is reached on arrival.",
    ),
    check(
      "headless-packaging",
      /applyPackageArtifacts/.test(text(root, "src/pi/extension.ts"))
        && /items\.includes\("--apply"\)/.test(text(root, "src/pi/extension.ts")),
      "The complete package can be produced without starting a browser wizard.",
    ),
    check(
      "reader-checkpoint-visible-early",
      /readerCheckpointProgress/.test(text(root, "src/application/status.ts"))
        && /readerCheckpointItem/.test(text(root, "src/application/package-checklist.ts")),
      "The human reader requirement is reported from drafting onward, not only at the last gate.",
    ),
    check(
      "reader-waiver-is-a-recorded-decision",
      /PACKAGE_WITHOUT_READERS_SUBJECT/.test(text(root, "src/application/reader-checkpoint.ts"))
        && /packageWithoutReadersDecision/.test(text(root, "src/application/reader-checkpoint.ts"))
        && /reader-evidence-waived/.test(text(root, "src/application/reader-checkpoint.ts")),
      "Packaging without reader evidence requires an explicit recorded writer decision, not a flag.",
    ),
    check(
      "reader-waiver-recorded-in-the-package",
      /No human reader has read this book/.test(text(root, "src/application/packaging/export.ts")),
      "A package built under the reader waiver states the absence in its own manifest and report.",
    ),
    check(
      "reader-waiver-never-becomes-evidence",
      // The reader-checkpoint module is read-only by construction: it reports,
      // it never records. If it ever gained a write, a waiver could start
      // manufacturing the evidence it is explicitly not.
      !/writeFileSync|applyGuidedProjectEvent|applyTransaction/.test(text(root, "src/application/reader-checkpoint.ts"))
        && /Do not describe it as reader-tested/.test(text(root, "src/application/reader-checkpoint.ts")),
      "The reader checkpoint only reads state, and a waived package is never described as reader-tested.",
    ),

    check(
      "capacity-derived-defaults",
      existsSync(join(root, "src/application/capacity-profile-advisor.ts"))
        && /recommendProfilesForCapacity/.test(text(root, "src/pi/extension.ts"))
        && /hostContextWindow/.test(text(root, "src/pi/extension.ts")),
      "New projects choose a runtime profile from the host model's detected context window.",
    ),
    check(
      "capacity-thresholds-derived-from-profiles",
      /RUNTIME_PROFILES\[id\]/.test(text(root, "src/application/capacity-profile-advisor.ts"))
        && !/16_?384|32_?768|65_?536/.test(text(root, "src/application/capacity-profile-advisor.ts")),
      "Affordability thresholds come from each profile's own budget rather than hardcoded window sizes.",
    ),
    check(
      "exact-model-profile-needs-a-fingerprint",
      /hasExplicitWorkerModel/.test(text(root, "src/application/capacity-profile-advisor.ts"))
        && /requires an exact model to fingerprint/.test(text(root, "src/application/capacity-profile-advisor.ts")),
      "An exact-model execution profile is only recommended when a model exists to fingerprint.",
    ),
    check(
      "local-model-documented",
      /NOVEL_FORGE_QUALITY_MODEL/.test(readme) && /Running on a local model/.test(readme),
      "The README documents running on a local model with a local example.",
    ),

    check(
      "journey-traces-recorded-from-real-runs",
      existsSync(join(root, "src/infrastructure/journey-trace-store.ts"))
        && /recordGuardedEvent/.test(text(root, "src/application/events.ts"))
        && /recordWriterApproval/.test(text(root, "src/application/run.ts")),
      "Author-journey events are emitted by the real guarded-event and run paths.",
    ),
    check(
      "journey-traces-are-privacy-safe",
      /assertPrivacySafe/.test(text(root, "src/infrastructure/journey-trace-store.ts"))
        && /outside its privacy-safe shape/.test(text(root, "src/infrastructure/journey-trace-store.ts")),
      "A journey event carrying a field outside its declared shape is refused rather than written.",
    ),
    check(
      "journey-traces-are-operational-only",
      /\.pi-book/.test(text(root, "src/infrastructure/journey-trace-store.ts"))
        && /\.pi-book\//.test(text(root, "src/project/templates.ts")),
      "Traces live in the ignored operational tree and new projects ignore it.",
    ),
    check(
      "contract-fields-derived-from-the-graph",
      existsSync(join(root, "src/application/contracts/contract-field-derivation.ts"))
        && /establishedStateRecords/.test(text(root, "src/application/contracts/contract-field-derivation.ts"))
        && /establishedKnowledgeRecords/.test(text(root, "src/application/contracts/contract-field-derivation.ts")),
      "start_state_ids and knowledge_boundary_ids are resolved from the story ledgers rather than asked of the model.",
    ),
    check(
      "typed-contract-completion",
      existsSync(join(root, "src/application/contracts/complete-chapter-contract.ts"))
        && /name: "novel_complete_chapter_contract"/.test(text(root, "src/pi/complete-contract-command.ts"))
        && /stringifyYaml\(contract\)/.test(text(root, "src/application/contracts/complete-chapter-contract.ts")),
      "A chapter contract is completed from typed values that the tool serialises, not hand-authored YAML.",
    ),
    check(
      "typed-completion-still-refuses-invention",
      /assertKnownIds/.test(text(root, "src/application/contracts/complete-chapter-contract.ts"))
        && /well-formed nonsense/.test(text(root, "src/application/contracts/complete-chapter-contract.ts")),
      "Typed completion rejects record IDs that do not exist rather than serialising them.",
    ),
    check(
      "typed-completion-uses-the-guarded-event",
      /applyNovelEvent/.test(text(root, "src/pi/complete-contract-command.ts"))
        && /eventType: "chapter-queue"/.test(text(root, "src/pi/complete-contract-command.ts")),
      "Typed completion applies through the existing guarded chapter-queue event.",
    ),
    check(
      "skill-documents-typed-completion",
      /novel_complete_chapter_contract/.test(skill) && /rather than hand-authoring the contract file/.test(skill),
      "SKILL.md directs agents to the typed contract tool instead of hand-authored YAML.",
    ),

    check(
      "hand-authored-fixtures-are-not-the-baseline",
      /evaluator regression/.test(text(root, "scripts/evaluate-fixtures.ts"))
        && /verify the evaluator, not author velocity/.test(text(root, "scripts/evaluate-fixtures.ts")),
      "Hand-authored journey fixtures are described as evaluator regression cases, not a velocity baseline.",
    ),
  ];
}

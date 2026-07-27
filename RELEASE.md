# Novel Forge Release Status and Checklist

## Current verified release: v2.0.1

Novel Forge 2.0.1 is the pinned release for installation and supervised live-book pilots.

```bash
pi install git:github.com/dustinober1/pi-book@v2.0.1
```

For one Pi session without changing persistent package settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v2.0.1
```

Use a copied or backed-up manuscript for the first pilot. Install the tag rather than an unpinned branch: `main` may contain unreleased work after the 2.0.1 release commit.

## 2.0.1 release record

- [x] Package metadata, package lock, runtime version, and new-project metadata report 2.0.1.
- [x] `requireProjectRoot` resolves the project `novel-start` just created when the following command runs from the same, unmoved cwd — the exact sequence the README quick start documents.
- [x] Two or more Novel Forge projects directly under cwd produce a named, actionable ambiguity error instead of a generic "no project found" message.
- [x] The cwd-fallback lookup is scoped to `requireProjectRoot` and does not affect `findProjectRoot`'s use in the repository organizer's ancestor-nesting guard; a sibling project cannot block organizing an unrelated directory.
- [x] A cwd with no project above it and no sibling project below it still fails with the original message.

## 2.0.0 release record

- [x] Package metadata, package lock, runtime version, and new-project metadata reported 2.0.0 at that release.
- [x] A `chapter-queue` event compiles a chapter contract skeleton for every ready packet, leaving the four judgement fields empty and named in `missing_small_model_fields`.
- [x] An authored chapter contract, on disk or submitted with the event, is never overwritten by a skeleton.
- [x] A `chapter-queue` event reports which ready packets still lack an executable contract, in both a dry run and a real apply.
- [x] Style-pattern rules evaluate absolute published-fiction reference bands before either relative comparison, and a band breach reports its limit, direction, and scope word count.
- [x] A single chapter with no accepted baseline and no sibling documents is still measured, and a scope below the minimum word count is not.
- [x] Every `draft-chapter` event lints the submitted text — not the copy on disk — and returns findings as advisories.
- [x] A `draft-chapter` event reports when no accepted voice baseline exists, so disabled rules are distinguishable from silence.
- [x] Dialogue is measured per named speaker, and indistinguishable pairs are reported only when sentence length, contraction rate, question rate, word length, and vocabulary range all agree.
- [x] A speaker below the sample floor is never characterised, and prose with no attributed dialogue never throws.
- [x] A book plan whose chapters all carry the same `target_words` is rejected and the message names the 85%–110% draft band.
- [x] Low chapter-length variance, periodic POV rotation, dominant causality, and repeated ending beats apply as advisories.
- [x] A `package` event without a recorded human reader response is rejected as `human-gate-required` and is not retryable.
- [x] Thin and delayed-response reader limitations apply as advisories rather than rejections.
- [x] No style finding claims authorship detection; every one carries `review` confidence and a manuscript-context review action.
- [x] `SKILL.md` documents the reference bands, character voice, structural rhythm, the reader checkpoint, and the contract-skeleton workflow.

## 1.10.0 release record

- [x] Package metadata, package lock, runtime version, and new-project metadata reported 1.10.0 at that release.
- [x] A `draft-chapter` event measures the submitted chapter against its packet `target_words`: silent inside 85%–110%, advisory outside it, rejected below 60% or above 150%.
- [x] Every event checks its submitted paths against Git and rejects a path holding uncommitted changes that differ from the submission.
- [x] A submitted path written out of band with matching content applies with an advisory rather than a rejection.
- [x] `novel_apply_event` and `novel_validate_event` render advisories in the tool result text, not only in structured details.
- [x] A `draft-chapter` event without an executable chapter contract discloses that no scene critics, targeted repair, or ordered acceptance ran, and names the missing contract path.
- [x] Both new blockers classify as retryable `payload-validation` and name their remedy, including `plan-change` for a wrong `target_words`.
- [x] `SKILL.md` documents the chapter-length bands, states that the project-root boundary is enforced through Git, requires advisories to reach the writer, and requires summaries to separate tool-verified claims from the agent's own assessment.
- [x] `SKILL.md` forbids creating, moving, renaming, or deleting any file inside the project root by any means other than a guarded event.
- [x] `SKILL.md` directs agents to the installed skill and `novel_validate_event` instead of the implementation source.
- [x] A rejected manuscript path states the required directory and the leading-chapter-number file naming rule.
- [x] A missing or non-executable chapter contract explains how to author one and what to do meanwhile.
- [x] `novel_advance_chapter_step` enumerates its critics so an invalid critic cannot be sent.
- [x] `novel_validate_event` runs the complete event contract without writing, checkpointing, advancing a stage or gate, or consuming retry budget.
- [x] Schema failures report real instance paths, expand unions against the closest matching shape, and list allowed values for literal unions.
- [x] Profile packet findings name the chapter they came from.
- [x] Profile, remarkability, reader-evidence, book-strategy, packet-window, research-friction, and missing-output blockers classify as retryable `payload-validation` instead of stopping automatic work.
- [x] A rejected event reports every validation problem across all layers in one numbered rejection; a single problem still reads as one plain message.
- [x] Structural pre-checks — wrong stage, stale stage, stale project hash, duplicate path, allowlist violation — still stop immediately instead of aggregating.
- [x] The retryable rejection instruction requires resubmitting the complete required file set, not only the corrected payload.
- [x] `SKILL.md` lists the required output set for `voice-profile`, `series-plan`, and `book-plan`, including the historical-fiction additions.
- [x] Validation strictness changed only in the two ways recorded above; every other event is accepted and rejected as before, and no project schema, workflow state, or evidence content changed.
- [x] `SKILL.md` states explicitly that `series/decision-ledger.yaml` is never an allowed file for a `book-plan` event, and that decision-ledger evidence must go through its own prior `intake-update` (or historical-fiction `research-update`) event.
- [x] `SKILL.md` requires quoting YAML scalars containing `: ` and using only schema-exact field names for guarded event payloads.
- [x] The `remarkability.yaml` template documents the exact allowed keys for `signature_moments`, `productive_disagreements`, and `recurring_motifs`.
- [x] Existing projects without quality state resolve to economy behavior.
- [x] Balanced, premium, and editorial drafting use isolated Pi workers and preserve one final guarded event as canonical authority.
- [x] Token and call budgets reserve before inference and settle afterward.
- [x] Telemetry excludes raw prompts, prose, outputs, source excerpts, reasoning, and credentials.
- [x] High-risk research uses bounded evidence anchors; unsupported high-risk chapter claims stop before canonical mutation.
- [x] Eligible factual repairs are limited to one targeted pass followed by re-extraction and re-audit.
- [x] Paid cost-versus-quality evaluation requires explicit opt-in and never runs in normal CI.
- [x] The release workflow reads the package version at run time instead of a hardcoded per-tag workflow file.
- [x] Node 22.19.0 and Node 24 pass type, unit, integration, end-to-end, evaluation, benchmark, release, and package checks.

Maintained release notes are in `docs/releases/v2.0.1.md`. Focused operating guidance is in `docs/quality-and-cost.md`, `docs/grounded-accuracy.md`, and `evals/quality/README.md`. Earlier release notes and tags remain immutable.

## Verify the current development tree

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run benchmark:constrained-runtime
npm run benchmark:prompts
npm run verify:release
npm run test:release
npm pack --dry-run
```

The repository's **Novel Forge tests** workflow is authoritative for the Node 22.19.0 and Node 24 matrix. A release candidate must pass both jobs on the exact commit that will be tagged.

Paid evaluation is separate:

```bash
NOVEL_FORGE_RUN_PAID_EVAL=1 npm run eval:quality -- \
  --fixture evals/quality/fixtures/thriller-key-scene.yaml \
  --provider <provider> --model <model> \
  --tiers economy,balanced,premium,editorial --seed study-001
```

Do not run this command in normal CI. Keep the label seal closed until human review is complete.

## Evidence boundaries

A green release check demonstrates workflow contracts, compatibility, package boundaries, and deterministic safety behavior. It does not prove factual completeness, expert or sensitivity review, literary quality, publication success, or real-reader validation. Automated diagnostics are not human reader evidence.

For a first live pilot, work from a copy, keep the project Git worktree clean, set explicit quality and budget controls, inspect high-risk evidence anchors and invention decisions, exercise pause/resume/recovery, and retain expert and human editorial judgment.

## Checklist for the next release

- [ ] Choose a new semantic version; never move or rewrite an existing tag.
- [ ] Update package metadata, lock metadata, runtime constants, compatibility tests, changelog, release notes, and install examples together.
- [ ] Preserve historical release notes and project compatibility.
- [ ] Run the complete Node 22.19.0 and Node 24 matrix on the exact candidate commit.
- [ ] Confirm paid evaluation remains opt-in and outside normal CI.
- [ ] Confirm `npm pack --dry-run` excludes operational state and generated evaluation runs.
- [ ] Create an annotated tag only after the verified commit is merged.
- [ ] Smoke-test the pinned tag with a disposable project.

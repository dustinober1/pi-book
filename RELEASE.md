# Novel Forge Release Status and Checklist

## Current verified release: v1.7.0

Novel Forge 1.7.0 is the pinned release for installation and supervised live-book pilots.

```bash
pi install git:github.com/dustinober1/pi-book@v1.7.0
```

For one Pi session without changing persistent package settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v1.7.0
```

Use a copied or backed-up manuscript for the first pilot. Install the tag rather than an unpinned branch: `main` may contain unreleased work after the 1.7.0 release commit.

## 1.7.0 release record

- [x] Package metadata, package lock, runtime version, and new-project metadata report 1.7.0.
- [x] Existing projects without quality state resolve to economy behavior.
- [x] Balanced, premium, and editorial drafting use isolated Pi workers and preserve one final guarded event as canonical authority.
- [x] Token and call budgets reserve before inference and settle afterward.
- [x] Telemetry excludes raw prompts, prose, outputs, source excerpts, reasoning, and credentials.
- [x] High-risk research uses bounded evidence anchors; unsupported high-risk chapter claims stop before canonical mutation.
- [x] Eligible factual repairs are limited to one targeted pass followed by re-extraction and re-audit.
- [x] Paid cost-versus-quality evaluation requires explicit opt-in and never runs in normal CI.
- [x] Node 22.19.0 and Node 24 pass type, unit, integration, end-to-end, evaluation, benchmark, release, and package checks.

Maintained release notes are in `docs/releases/v1.7.0.md`. Focused operating guidance is in `docs/quality-and-cost.md`, `docs/grounded-accuracy.md`, and `evals/quality/README.md`. Earlier release notes and tags remain immutable.

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

# Novel Forge Release Status and Checklist

## Current verified release: v1.4.1

Novel Forge 1.4.1 is the pinned release for installation and supervised live-book pilots.

```bash
pi install git:github.com/dustinober1/pi-book@v1.4.1
```

To test it for one Pi session without changing persistent package settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v1.4.1
```

Use a copied or backed-up manuscript for the first pilot. Install the tag rather than an unpinned branch: `main` may contain unreleased work after the 1.4.1 release commit.

## 1.4.1 release record

- [x] `package.json`, `package-lock.json`, installed-version metadata, and new-project metadata report `1.4.1`.
- [x] The exact release commit is tagged `v1.4.1`.
- [x] Node 22.19.0 and Node 24 run `npm ci`, type checking, tests, evaluations, release verification, and package dry-run checks.
- [x] Brief bootstrap preserves the supplied brief as read-only evidence and distinguishes explicit details from inference.
- [x] Premise comparison leaves final selection to the writer.
- [x] Persistent runs support bounded targets, pause, resume, cancellation, and stale-state protection.
- [x] Rolling packet windows preserve completed work and avoid duplicate chapter preparation.
- [x] Structured rejection envelopes enforce one corrected schema/reference retry, reload on stale state, and no automatic retry for unsafe failures.
- [x] Existing 1.3 projects remain readable without invented evidence or silent manuscript changes.
- [x] Packed-extension install, import, registration, and clean-start tests pass.
- [x] Runtime package assets are allowlisted while tests, evaluations, workflows, and generated artifacts are excluded.
- [x] Release notes state the writer-control, compatibility, and evaluation boundaries.

The maintained 1.4.1 release notes are in `docs/releases/v1.4.1.md`. This local release is intentionally verified without GitHub Actions or remote publishing. The prior `v1.4.0` tag remains immutable. Historical 1.3 release notes remain in `docs/releases/v1.3.0.md`; historical implementation plans under `docs/superpowers/` are records and should not be treated as current installation instructions.

## Verify the current development tree

Run the complete local qualification sequence:

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

## Live-book pilot boundaries

A green release check demonstrates workflow contracts, compatibility, package boundaries, and deterministic safety behavior. It does not prove:

- full-book model performance;
- literary or editorial quality;
- publication success;
- real-reader validation;
- a specific completion time.

For the first live pilot:

1. Work from a copy or verified backup.
2. Pin the package tag.
3. Keep the Novel Forge Git worktree clean before guarded operations.
4. Verify `/novel-start` and `/novel` before importing valuable material.
5. For an existing manuscript, preview adoption before applying it.
6. Exercise pause/resume, recovery, revision, and export before relying on the package for production work.
7. Retain human editorial review and real-reader judgment.

`npm audit --omit=dev` currently reports moderate advisories in the transitive `exceljs` → `uuid` dependency path. Reassess this before broad use with untrusted inputs or before the next release; do not apply a forced breaking dependency downgrade without regression testing package and spreadsheet exports.

## Checklist for the next release

- [ ] Choose a new semantic version; never move or rewrite an existing release tag.
- [ ] Update `package.json`, `package-lock.json`, installed-version constants, project compatibility, `CHANGELOG.md`, release notes, and install examples together.
- [ ] Preserve historical release notes and migration compatibility.
- [ ] Run the complete Node 22.19.0 and Node 24 matrix on the exact candidate commit.
- [ ] Run deterministic architecture, release, author-journey, constrained-runtime, and prompt-compiler evaluations.
- [ ] Run packed-extension import/registration and clean-project tests.
- [ ] Review production dependency advisories and document unresolved risk.
- [ ] Confirm `npm pack --dry-run` contains every required runtime asset and no tests, local artifacts, imported corpora, generated books, or package tarballs.
- [ ] Confirm the release notes preserve writer approval, premise selection, privacy, compatibility, and evaluation boundaries.
- [ ] Create an annotated tag and GitHub release only after the verified commit is merged.
- [ ] Smoke-test the pinned tag with a temporary Pi session and a disposable project.

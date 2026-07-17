# Novel Forge Release Status and Checklist

## Current verified release: v1.4.2

Novel Forge 1.4.2 is the pinned release for installation and supervised live-book pilots.

```bash
pi install git:github.com/dustinober1/pi-book@v1.4.2
```

To test it for one Pi session without changing persistent package settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v1.4.2
```

Use a copied or backed-up manuscript for the first pilot. Install the tag rather than an unpinned branch: `main` may contain unreleased work after the 1.4.2 release commit.

## 1.4.2 release record

- [x] `package.json`, `package-lock.json`, installed-version metadata, and new-project metadata report `1.4.2`.
- [x] Mixed writing repositories can be scanned read-only with deterministic provisional classifications.
- [x] `/novel-organize` requires separate structure, provisional-classification, and exact archive confirmations.
- [x] Confirmed sources are copied and hash-verified before originals move into a timestamped `.archive` directory.
- [x] Archive manifests retain original, canonical, and archive paths with hashes and classification reasons.
- [x] Symlinks, nested Git repositories, ignored/config/generated files, stale previews, canonical collisions, and pre-existing staged work are blocked.
- [x] Organizer commits use literal, path-only Git checkpoints and do not include unrelated work.
- [x] Imported content remains at voice intake/book planning and creates no canon, approval, research, review, or reader claims.
- [x] Existing 1.3 and 1.4 projects remain readable without invented evidence or silent manuscript changes.
- [x] Packed-extension install, import, registration, clean-start, type, unit, integration, and release checks pass.
- [x] Release notes preserve writer-control, compatibility, privacy, and evaluation boundaries.

The maintained 1.4.2 release notes are in `docs/releases/v1.4.2.md`. Tags `v1.4.0` and `v1.4.1` remain immutable. Historical 1.3 release notes remain in `docs/releases/v1.3.0.md`; historical implementation plans under `docs/superpowers/` are records and should not be treated as current installation instructions.

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
4. Run `/novel-organize --dry-run` before organizing a mixed existing repository.
5. Review every proposed mapping and the exact archive list before confirmation.
6. Verify `/novel-start` and `/novel` before importing valuable material.
7. Exercise pause/resume, recovery, revision, and export before relying on the package for production work.
8. Retain human editorial review and real-reader judgment.

`npm audit --omit=dev` currently reports moderate advisories in the transitive `exceljs` → `uuid` dependency path. Reassess this before broad use with untrusted inputs or before the next release; do not apply a forced breaking dependency downgrade without regression testing package and spreadsheet exports.

## Checklist for the next release

- [ ] Choose a new semantic version; never move or rewrite an existing release tag.
- [ ] Update package metadata, installed-version constants, compatibility tests, changelog, release notes, and install examples together.
- [ ] Preserve historical release notes and migration compatibility.
- [ ] Run the complete Node 22.19.0 and Node 24 matrix on the exact candidate commit.
- [ ] Run deterministic architecture, release, author-journey, constrained-runtime, and prompt-compiler evaluations.
- [ ] Run packed-extension import/registration and clean-project tests.
- [ ] Review production dependency advisories and document unresolved risk.
- [ ] Confirm `npm pack --dry-run` contains every required runtime asset and no tests, local artifacts, imported corpora, generated books, or package tarballs.
- [ ] Confirm the release notes preserve writer approval, premise selection, privacy, compatibility, and evaluation boundaries.
- [ ] Create an annotated tag only after the verified commit is merged.
- [ ] Smoke-test the pinned tag with a temporary Pi session and a disposable project.

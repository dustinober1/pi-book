# Novel Forge Release Status and Checklist

## Current verified release: v1.6.2

Novel Forge 1.6.2 is the pinned release for installation and supervised live-book pilots.

```bash
pi install git:github.com/dustinober1/pi-book@v1.6.2
```

To test it for one Pi session without changing persistent package settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v1.6.2
```

Use a copied or backed-up manuscript for the first pilot. Install the tag rather than an unpinned branch: `main` may contain unreleased work after the 1.6.2 release commit.

## 1.6.2 release record

- [x] `package.json`, `package-lock.json`, installed-version metadata, and new-project metadata report `1.6.2`.
- [x] Manuscript review generates `delivery/manuscript.md` from every ordered chapter before requesting writer approval.
- [x] The compiled manuscript participates in the manuscript-approval evidence hash.
- [x] Missing or duplicate numbered chapters block compilation instead of producing incomplete approval evidence.
- [x] Manuscript-review scaffolding checks reject craft-process leakage before approval.
- [x] Packed-extension install, import, registration, clean-start, type, unit, integration, end-to-end, evaluation, and release checks pass.

The maintained release notes are in `docs/releases/v1.6.2.md`. Earlier release notes, including `docs/releases/v1.5.0.md`, `docs/releases/v1.6.0.md`, and `docs/releases/v1.6.1.md`, and existing tags remain immutable. Historical implementation plans under `docs/superpowers/` are records and are not current installation instructions.

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

## Pilot and evidence boundaries

A green release check demonstrates workflow contracts, compatibility, package boundaries, and deterministic safety behavior. It does not prove:

- historical truth or completeness;
- expert, archival, or sensitivity review;
- full-book model performance;
- literary or editorial quality;
- publication success;
- real-reader validation.

For a first live pilot, work from a copy, keep the project Git worktree clean, inspect every high-risk source and invention decision, review the Historical Note, exercise recovery and export, and retain expert/human editorial judgment.

`npm audit --omit=dev` currently reports moderate advisories in the transitive `exceljs` → `uuid` dependency path. Reassess before broad use with untrusted inputs; do not apply a forced breaking dependency change without packaging and spreadsheet-export regression testing.

## Checklist for the next release

- [ ] Choose a new semantic version; never move or rewrite an existing release tag.
- [ ] Update package metadata, runtime constants, compatibility tests, changelog, release notes, and install examples together.
- [ ] Preserve historical release notes and project compatibility.
- [ ] Run the complete Node 22.19.0 and Node 24 matrix on the exact candidate commit.
- [ ] Run deterministic architecture, release, author-journey, constrained-runtime, and prompt-compiler evaluations.
- [ ] Run packed-extension import/registration and clean-project tests.
- [ ] Review production dependency advisories and document unresolved risk.
- [ ] Confirm `npm pack --dry-run` includes every runtime asset and no tests, local artifacts, imported corpora, generated books, or tarballs.
- [ ] Create an annotated tag only after the verified commit is merged.
- [ ] Smoke-test the pinned tag with a disposable project.

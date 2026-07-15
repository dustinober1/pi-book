# Novel Forge Release Checklist

## Version 1.2.0

Do not create the `v1.2.0` tag until the feature pull request is merged and the resulting `main` commit passes the complete Node 22.19.0 and Node 24 verification matrix.

### Version and compatibility

- [ ] `package.json` reports `1.2.0`.
- [ ] `package-lock.json` reports `1.2.0` in the root package metadata.
- [ ] New projects write `novel_forge_version: 1.2.0`.
- [ ] New books contain `publishing.yaml`, `marketing.yaml`, and `reader-kits/index.yaml`.
- [ ] Version 1.1 projects remain readable without immediate migration.
- [ ] Projects written by a newer package version are blocked safely.
- [ ] Legacy reader migration preserves response fields, metrics, verdicts, timestamps, source claims, and original files.

### Wizard and transaction safety

- [ ] The wizard binds only to `127.0.0.1` on an ephemeral port.
- [ ] Every API request requires the session credential and exact origin.
- [ ] Sessions expire and delete their upload directories.
- [ ] The browser has no direct filesystem-write or arbitrary-command route.
- [ ] Confirmed actions enforce expected stage and project hash.
- [ ] Binary files preserve exact bytes and participate in transaction rollback.
- [ ] The public `novel_apply_event` tool remains UTF-8 text-only.
- [ ] Every accepted workflow refreshes `STATUS.md` and `HANDOFF.md` in the same Git checkpoint.

### Adoption acceptance

- [ ] DOCX, EPUB, Markdown, text, and chapter-directory sources can be previewed.
- [ ] Pandoc is preferred when available and Node fallbacks remain usable without it.
- [ ] Path traversal, archive symlinks, encryption, XML external declarations, remote resources, size limits, and compression-ratio limits are enforced before mutation.
- [ ] Chapter and asset mapping supports reorder, rename, renumber, split, combine, classify, exclude, caption, alt text, and placement edits.
- [ ] Source manuscripts remain unchanged.
- [ ] Occupied manuscript destinations are rejected.
- [ ] Chapters, assets, metadata candidates, reports, counts, status, handoff, and Git checkpoint apply atomically.

### Reader acceptance

- [ ] Reader kits are isolated under `reader-kits/RE-NNN/`.
- [ ] Kit scope supports first page, first chapter, selected chapters, act, excerpt, and full manuscript.
- [ ] CSV imports preview schema, mapping, invalid rows, duplicates, conflicts, non-human sources, questionnaire mismatches, and unmatched delayed rows.
- [ ] Conflict decisions are explicit: keep existing, use imported, or exclude.
- [ ] Existing accepted evidence is preserved by default.
- [ ] Metrics are recomputed from accepted human responses only.
- [ ] Reader Markdown, CSV, and XLSX reports are generated reproducibly.

### Packaging acceptance

- [ ] Checklist items show status, blocking/advisory classification, evidence paths, and exact repair actions.
- [ ] `publishing.yaml` and `marketing.yaml` are the canonical sources.
- [ ] Required metadata is never invented.
- [ ] The package contains manuscript Markdown, DOCX, EPUB, publishing CSV/XLSX, reader CSV/XLSX, retailer copy, launch copy, social posts, ads, audiobook metadata, series-page copy, a manifest, and a report.
- [ ] Outputs are staged in memory and committed atomically.
- [ ] Source hashes prevent silent overwrite of stale approved outputs.
- [ ] Generated marketing remains draft material unless approved in `marketing.yaml`.

### Next-book acceptance

- [ ] Creation requires the current book to be canon-locked or packaged unless force is explicitly selected.
- [ ] The proposal previews locked canon, unresolved threads, prior profile/length, and reader limitations.
- [ ] The author supplies title, role, relationship, profile, target length, protagonist, continuing/deferred threads, immutable facts, optional context, and exclusions.
- [ ] Selected IDs are validated against the locked source files.
- [ ] `inherited-context.yaml` and `inheritance-report.md` distinguish inherited, continuing, deferred, optional, excluded, and unresolved material.
- [ ] No plot solution, character outcome, reader result, or new canon is invented.

### Verification

- [ ] `npm ci` passes.
- [ ] `npm run typecheck` passes on Node 22.19.0 and Node 24.
- [ ] `npm test` passes on Node 22.19.0 and Node 24.
- [ ] `npm run eval` passes.
- [ ] Real Pi command/tool lifecycle tests pass.
- [ ] Packed-extension install/import/registration smoke tests pass.
- [ ] `npm pack --dry-run` includes `wizard/index.html`, `wizard/app.js`, and `wizard/styles.css`.
- [ ] The final PR diff contains no temporary lockfile workflow, generated diagnostics, local artifacts, or generated book outputs.

### Publish

1. Merge the verified pull request to `main` only after explicit author approval.
2. Confirm the merge commit's `Novel Forge tests` workflow is green on both Node versions.
3. Create annotated tag `v1.2.0` on that merge commit.
4. Confirm installation with:

   ```bash
   pi install git:github.com/dustinober1/pi-book@v1.2.0
   ```

5. Run a clean `/novel-start` and `/novel` smoke test from the tagged package.
6. Run one DOCX adoption, reader CSV merge, packaging export, and next-book creation smoke test from the tagged package.

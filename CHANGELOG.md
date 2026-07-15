# Changelog

## 1.2.0 — Existing-project and reader usability

### Added

- Temporary browser wizard launched from `/novel` or `/novel-wizard`, bound only to `127.0.0.1` with a random session credential, exact-origin checks, idle expiration, and session-owned uploads.
- Read/propose/apply browser boundary: the browser never writes project files directly; confirmed actions return through Novel Forge validation, rollback, Git checkpoints, `STATUS.md`, and `HANDOFF.md`.
- High-fidelity adoption previews for DOCX, EPUB, Markdown, text, and chapter directories.
- Optional Pandoc conversion with Node DOCX/EPUB fallbacks.
- Author-controlled section mapping: reorder, rename, renumber, split, combine, classify, exclude, edit asset placement, and accept/edit/ignore discovered metadata.
- Binary-safe guarded transactions for embedded manuscript assets, DOCX, EPUB, and XLSX files.
- Experiment-isolated reader kits under `reader-kits/RE-NNN/`.
- Previewed CSV column mapping, row diagnostics, conflict decisions, merge-safe imports, and reader summary CSV/XLSX files.
- Canonical `publishing.yaml` and `marketing.yaml` for reproducible production and promotional outputs.
- Browser packaging checklist with evidence paths, blocking/advisory status, and exact repair actions.
- Complete package generation: manuscript Markdown, DOCX, EPUB, publishing CSV/XLSX, reader CSV/XLSX, retailer copy, launch copy, social posts, ad variants, audiobook metadata, series-page copy, manifest, and conversion report.
- Context-aware next-book proposals with locked canon, unresolved threads, reader limitations, author decisions, `inherited-context.yaml`, and `inheritance-report.md`.

### Changed

- Package version and new-project metadata are now `1.2.0`.
- `/novel-readers`, `/novel-package`, and `/novel-adopt` open the temporary wizard instead of applying first-pass workflows immediately.
- Empty manuscripts expose **Adopt an existing manuscript** directly in the guided `/novel` menu.
- Packaging source files are canonical YAML; generated documents are reproducible derivatives and do not become sources of truth.
- Existing package outputs are source-hashed and cannot be silently overwritten after manuscript or metadata changes.

### Compatibility

- Version 1.1 projects remain readable before migration.
- Legacy reader evidence can be copied into isolated v1.2 experiment directories without changing accepted response fields, metrics, verdicts, timestamps, or source claims.
- Legacy `reader-experiments.yaml`, `reader-kit/`, Markdown/text adoption, and all specialist planning/drafting/review commands remain supported.

### Safety retained

- Human gates cannot be skipped.
- `novel_apply_event` remains text-only and continues to enforce stage, hash, schema, reference, and file-allowlist rules.
- Binary assets are available only to trusted internal application services.
- Reader evidence requires accepted `source: human` rows; non-human rows never affect metrics or claims.
- Undo creates a revert commit and never rewrites history.
- Adoption never changes the source manuscript or overwrites occupied manuscript destinations.

## 1.1.0 — Guided author workflow

### Added

- `/novel` as the primary context-sensitive command.
- Friendly human-gate review cards with approve, request-changes, evidence, and repair paths.
- Decision-oriented `STATUS.md` and automatically regenerated `HANDOFF.md`.
- `START-HERE.md` for new projects.
- Package-version compatibility checks and guided metadata upgrades.
- Short, one-question-at-a-time planning interviews capped at four normal questions.
- Guarded `git revert` recovery, blocker explanation, integrity summaries, and guidance rebuilds.
- Non-destructive `/novel-adopt` manuscript import for Markdown and plain-text projects.
- Reader-kit generation and strict human-response CSV import.
- Packaging readiness checklist and contextual next-book creation.

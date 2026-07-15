# Changelog

## 1.3.0 — Author-taste and research foundation

### Added

- Strict typed contracts for author taste, voice guardrails, anonymous voice-experiment records, research ledgers, book strategy, and voice-audit evidence.
- A `research-update` workflow event that can save allowlisted evidence during active creative stages without changing project stage, gates, approvals, active-book state, or manuscript prose.
- New-project templates for `series/taste-profile.yaml`, `series/voice-guardrails.yaml`, and `series/voice-experiments/index.yaml`.
- New-book templates for `research-ledger.yaml`, `book-strategy.yaml`, and `voice-audits.yaml`.
- Transaction-level validation for every new 1.3 YAML artifact.
- One consolidated optional-backfill warning when an older project does not yet contain the 1.3 evidence files.

### Changed

- Package version and new-project metadata are now `1.3.0`.
- Rebuilding a voice profile requires the readable voice profile, taste profile, voice guardrails, and voice-experiment index in one guarded event.
- Rebuilding a book plan requires its research ledger and book strategy in the same guarded event as the existing architecture files.
- Voice and book planning prompts now request the complete evidence bundle and explicitly prohibit invented public-review evidence or named-author imitation instructions.
- Review events may write typed `voice-audits.yaml` evidence without making it mandatory during this foundation phase.

### Compatibility

- Existing 1.2 projects remain readable and unblocked when the new evidence files are absent.
- Metadata-only upgrades do not create evidence, change approvals, or hide the optional-backfill warning.
- Existing manuscript prose, reader experiments, publishing metadata, marketing metadata, and continuity-graph behavior remain unchanged.
- No dependency or external service is added.

### Safety retained

- `research-update` rejects manuscript, project-state, book-state, guidance, reader-evidence, publishing, marketing, and package-output paths.
- Every accepted evidence update still requires the current stage and project hash, schema validation, rollback, one Git checkpoint, and refreshed status and handoff files.
- Public market evidence remains separate from real human responses to the current manuscript.

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
- A deterministic, in-memory continuity graph derived from approved canon, story threads, chapter packets, plot entries, and research sources.
- Explainable graph-context reports with bounded paths, selected records, and policy-blocked provisional, inactive, or future-book candidates.

### Changed

- Package version and new-project metadata are now `1.2.0`.
- `/novel-readers`, `/novel-package`, and `/novel-adopt` open the temporary wizard instead of applying first-pass workflows immediately.
- Empty manuscripts expose **Adopt an existing manuscript** directly in the guided `/novel` menu.
- Packaging source files are canonical YAML; generated documents are reproducible derivatives and do not become sources of truth.
- Existing package outputs are source-hashed and cannot be silently overwritten after manuscript or metadata changes.
- Drafting context now follows at most two safe continuity links from explicit chapter references, while preserving direct provisional references and preventing unsafe automatic discoveries.

### Compatibility

- Version 1.1 projects remain readable before migration.
- Legacy reader evidence can be copied into isolated v1.2 experiment directories without changing accepted response fields, metrics, verdicts, timestamps, or source claims.
- Legacy `reader-experiments.yaml`, `reader-kit/`, Markdown/text adoption, and all specialist planning/drafting/review commands remain supported.
- The continuity graph requires no new project files, schema migration, external service, or runtime dependency.

### Safety retained

- Human gates cannot be skipped.
- `novel_apply_event` remains text-only and continues to enforce stage, hash, schema, reference, and file-allowlist rules.
- Binary assets are available only to trusted internal application services.
- Reader evidence requires accepted `source: human` rows; non-human rows never affect metrics or claims.
- Undo creates a revert commit and never rewrites history.
- Adoption never changes the source manuscript or overwrites occupied manuscript destinations.
- Canonical YAML remains authoritative; the continuity graph is rebuilt in memory and never mutates canon or story state.

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

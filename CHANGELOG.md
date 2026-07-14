# Changelog

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

### Changed

- The normal workflow is now `/novel-start` followed by repeated `/novel` commands.
- Existing specialist commands remain supported as power-user aliases.
- Guarded workflow events now commit `STATUS.md` and `HANDOFF.md` with the event.
- New projects no longer create empty review and package placeholders; those files appear when their workflows produce substantive content.

### Safety retained

- Human gates cannot be skipped.
- `novel_apply_event` continues to enforce stage, hash, schema, reference, and file-allowlist rules.
- Reader evidence still requires `source: human`, predeclared sample minimums, delayed follow-up, and recomputed metrics.
- Undo creates a revert commit and never rewrites history.
- Adoption never overwrites existing chapter files or changes the source manuscript.

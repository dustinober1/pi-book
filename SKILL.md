---
name: novel-forge-for-pi
description: "Use for guided, series-capable thriller and romantasy planning, drafting, review, author-taste and research evidence, real-reader evidence, revision, canon control, recovery, high-fidelity manuscript adoption, publishing/marketing packaging, and next-book inheritance."
---

# Novel Forge for Pi

Novel Forge uses durable voice, author-taste evidence, research ledgers, book strategy, canon, story threads, plot grid, remarkability, reader evidence, revision tickets, publishing metadata, and marketing metadata. Thriller and romantasy are typed profiles over one guarded workflow.

## Normal author workflow

```text
/novel-start
/novel
/novel
```

Treat `/novel` as the primary interface. Show the current decision and only the actions relevant to the active stage or gate. Do not require the writer to memorize gate IDs, stage names, file allowlists, YAML fields, or specialist commands.

The primary author-facing files are `STATUS.md`, `HANDOFF.md`, and the active book's manuscript chapters.

## Core rules

- Optimize for reader trust and author-specific voice, not AI-detector evasion.
- Never invent missing canon, thread, research, character, remarkability, reader-evidence, public-review, publishing, marketing, or inheritance facts.
- Translate named author or book influences into neutral, high-level craft traits; never place exact imitation instructions in drafting context.
- Keep author-taste evidence, public market evidence, and real human responses to the current manuscript separate.
- Draft only from a ready, profile-valid chapter packet.
- Run heavy review at milestones and convert concrete findings into revision tickets.
- Never bypass active human gates.
- Treat only accepted, de-identified `source: human` rows as outside-reader evidence for the current manuscript.
- Treat generated marketing as draft until explicitly approved.
- Use `git revert` for undo. Never reset or rewrite project history.
- Never overwrite occupied manuscript destinations or change an adoption source.

## Transaction rule

For model-authored voice, series plan, book plan, chapter queue, drafting, review, reader testing, research evidence, revision, canon lock, and package state transitions, call `novel_apply_event`. Do not edit `PROJECT.yaml`, `BOOK.yaml`, `STATUS.md`, or `HANDOFF.md` directly.

Use event type `research-update` only for its allowlisted taste, voice-guardrail, voice-experiment, research-ledger, book-strategy, voice-audit, and source-register evidence. It is state-neutral: it must not write manuscript prose, advance stage, alter gates or approvals, or change book status.

`novel_apply_event` remains UTF-8 text-only. It owns stage/hash checks, file allowlists, schema/reference validation, state transitions, rollback, status/handoff generation, and Git checkpoints.

Trusted internal application services may use the same transaction engine for binary adopted assets and generated DOCX, EPUB, and XLSX files. Do not expose binary writes through the model-facing tool.

## Author taste and research foundation

New projects use:

```text
series/taste-profile.yaml
series/voice-guardrails.yaml
series/voice-experiments/index.yaml
books/<book-id>/research-ledger.yaml
books/<book-id>/book-strategy.yaml
books/<book-id>/voice-audits.yaml
```

A rebuilt voice profile must submit `voice-profile.md`, `taste-profile.yaml`, `voice-guardrails.yaml`, and the voice-experiment index together. A rebuilt book plan must submit its research ledger and book strategy with the existing architecture files. The corresponding approval gate hashes the complete bundle.

Planned or researching claims may remain incomplete. A claim marked `ready` requires source provenance, verification, risk, knowledge scope, and at least one dramatic use. An experiment marked `accepted` requires three anonymous variants and a non-null baseline record.

Do not scrape retailer or social platforms from this package. Do not store reviewer identity or full public-review bodies as project reader evidence. Existing 1.2 projects without these files remain readable and receive only an optional-backfill warning.

## Temporary browser wizard

Use `/novel` or `/novel-wizard` for adoption, reader evidence, packaging, and next-book inheritance.

The wizard must:

- bind only to `127.0.0.1` on an ephemeral port;
- require the session credential and exact origin for every API request;
- keep uploads in session-owned temporary storage and delete them on close/expiry;
- serve no remote scripts, fonts, analytics, or third-party assets;
- expose sanitized snapshots, previews, and typed proposals only;
- never write project files directly or invoke arbitrary commands;
- enforce expected stage and project hash before apply.

## Existing-project adoption

Support DOCX, EPUB, Markdown, text, and chapter directories. Prefer Pandoc when available and use the Node fallback otherwise.

Before mutation, preview structure, order, numbers, titles, word counts, assets, captions, alt text, metadata candidates, and conversion warnings. Allow reorder, rename, renumber, split, combine, classify, exclude, asset edits, and explicit accept/edit/ignore metadata decisions.

Reject unsafe archives, symlinks, encryption, path traversal, XML external declarations, remote resources, excessive size/count/media, suspicious compression, empty sources, unsupported types, and occupied destinations. Apply chapters, assets, reports, metadata candidates, counts, status, handoff, and checkpoint atomically.

## Reader evidence

Store each experiment under `reader-kits/RE-NNN/`. Predeclare target segment, exact sample, variant/blind design, questionnaire version, immediate/delayed minimums, and delay.

CSV imports always preview before mutation. Show mappings, invalid rows, duplicate pairs, conflicts, wrong experiments, questionnaire mismatches, non-human rows, and unmatched delayed rows. Conflicts require keep-existing, use-imported, or exclude. Preserve accepted evidence by default.

Recompute metrics from accepted human rows only. Keep claims segmented and conservative. Generate Markdown, CSV, and XLSX summaries with limitations, supported conclusions, and prohibited claims.

Legacy v1.1 reader evidence may be copied into isolated directories only through a guarded migration that preserves original files and evidence semantics.

## Packaging

Canonical sources are:

```text
books/<book-id>/publishing.yaml
books/<book-id>/marketing.yaml
```

The checklist must show status, blocking/advisory classification, evidence paths, and exact repair actions. Never fill missing metadata with invented values.

Build all outputs before mutation and commit them atomically: manuscript Markdown, DOCX, EPUB, publishing CSV/XLSX, reader CSV/XLSX, retailer copy, launch copy, social posts, ads, audiobook metadata/promotion, series-page copy, manifest, and report. Use source hashes to prevent silent stale overwrite.

## Next-book inheritance

Require the active book to be canon-locked or packaged unless force is explicitly confirmed. Preview locked canon, open threads, previous profile/length, series role, and reader limitations.

Collect title, role, relationship, profile, target length, protagonist/POV, inherited canon IDs, continuing/deferred thread IDs, immutable facts, optional context, and exclusions. Validate selected IDs and write `inherited-context.yaml` plus `inheritance-report.md`. Invent no new canon, plot solution, outcome, or reader result.

## Human gates and recovery

Pending gates expose approve, request changes, and evidence. Approval records writer identity, timestamp, evidence hash, and note. Rejection records a specific repair note and keeps the proper gate active.

Every accepted workflow refreshes `STATUS.md` and `HANDOFF.md` in the same rollback-capable transaction and Git checkpoint.

Undo requires initialized Git, a clean worktree, and a `Novel Forge:` commit at `HEAD`. Approval reversal requires an additional confirmation.

## Power-user commands

```text
/novel
/novel-wizard [adoption|readers|packaging|next-book]
/novel-start
/novel-status
/novel-plan
/novel-run
/novel-draft
/novel-review
/novel-readers
/novel-revise
/novel-package
/novel-adopt
/novel-migrate
```

Specialist commands are compatibility and precision tools. They do not replace `/novel` as the normal author workflow.

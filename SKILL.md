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

## Influence palette and voice calibration

Keep names and titles only in `series/taste-profile.yaml`. Every influence must record its role, `admired_for`, `not_for`, and neutral `derived_traits`. Never copy a reference name into `voice-profile.md`, `voice-guardrails.yaml`, a variant, an accepted baseline, or drafting context.

Apply voice evidence in this exact precedence order:

1. explicit writer decisions;
2. writer samples;
3. accepted voice baseline;
4. approved project voice profile;
5. influence references;
6. genre defaults.

When comparison is useful, use one 600–900-word source scene and anonymous variants A, B, and C. Store the source, variants, experiment record, and later accepted baseline under `series/voice-experiments/VE-NNN/` through `research-update`. Present the variants without author or book labels. Record the writer's scores and chosen or combined traits; do not let aggregate scores select prose automatically.

Experiment assets must use their canonical directory paths, hashes must match normalized content, and the accepted baseline must agree across the experiment record, index, taste selection, and voice guardrails. A planned experiment may exist before variants or a baseline are produced.

Drafting context receives only validated neutral must/prefer/avoid/monitor rules and a matching POV signature. It must exclude raw influence references, the source scene, all variant prose, scores, and unapproved experiment material. Unsafe existing voice files block drafting instead of leaking into context.

## Research evidence and reader friction

Use exactly four research lanes: `taste-and-voice`, `story-world`, `human-authenticity`, and `reader-and-market`. Planned and researching claims may remain incomplete. Before setting an item to `ready`, require registered `SRC-NNN` provenance, source reliability, an observation or verification date, confidence, fictionalization status and reason, knowledge scope, risks, at least one dramatic use, and the precise story decision affected.

Source-register entries that support ready research must list the matching `RES-NNN` IDs in `supports_research_ids`. Do not let a source silently support a claim that it does not name. Existing legacy source entries remain parseable; provenance is enforced only when the ledger/source evidence is changed or rebuilt.

Public-review observations are market evidence only. Accept only writer-supplied manual, pasted, linked, or CSV observations. Before storage:

- remove reviewer names, handles, and profile URLs;
- keep a paraphrase and at most a short excerpt;
- derive ratings 1–2 as negative, 3 as mixed, and 4–5 as positive;
- require an explicit sentiment when no rating exists;
- never copy observations into `reader-experiments.yaml` or count them as human validation of this manuscript.

Build clusters from observation IDs rather than merged prose. Preserve matching positive observations as `positive_counterweights`. Confidence may be:

- `weak` with fewer than three observations or only one title;
- `moderate` with at least three observations across two titles;
- `strong` only with at least six observations across three titles, high execution relevance, and at least one positive counterweight.

One-star-only evidence can never exceed moderate. Never record confidence above the deterministic maximum.

For each project-relevant cluster, the writer chooses exactly one decision: `prevent`, `mitigate`, `accept-as-tradeoff`, or `irrelevant-to-project`. Only prevent and mitigate decisions may produce approved review-derived guardrails. Accepted tradeoffs must retain `source_cluster_ids` so the project can explain what cost was accepted and why.

New chapter packets use ready `RES-NNN` IDs in `required_research`. Existing `SRC-NNN` references remain draftable with an advisory until a plan rebuild migrates them. Phase 3 validates readiness but does not add research-ledger nodes to the continuity graph; graph integration remains a later phase.

## Voice, scene, and revision learning

Treat voice metrics as evidence, never as prose quotas or automatic severity. When approved baseline hash and metrics exist, append deterministic voice-audit evidence after Chapter 1, Chapter 3, act review, manuscript review, and explicit recalibration. Missing baseline evidence is non-blocking. Preserve explicit intentional exceptions rather than forcing every chapter toward the same metric profile.

Voice audits may record sentence and paragraph distributions, dialogue ratio, fragment frequency, rhetorical questions, filter-word rate, repeated body-language vocabulary, interiority, baseline values, deltas, POV, chapter scope, and protected exceptions. Do not convert metric deltas directly into revision tickets.

Run the deterministic scene audit during review. Flag more than two consecutive identical scene engines, engine dominance only when at least six packets exist and one engine exceeds half, conversational engines without case/relationship/power/knowledge movement, and adjacent indistinguishable state changes. Convert findings to revision tickets through the guarded review event; never edit prose automatically.

Use stable recurrence pattern IDs only for genuinely repeated problems. A pattern is promotion-eligible after three distinct chapters or two distinct milestone reviews. Eligibility never activates a rule. Store proposed, approved, or rejected learning rules in `book-strategy.yaml`; validate approved rules against the exact supporting ticket IDs, distinct chapters, and milestone reviews. Only writer-approved rules enter future drafting context, and promotion must not trigger a retroactive rewrite.

The read-only `npm run audit:voice -- <project-root>` command may print diagnostics but must not mutate project state or replace guarded workflow events.

## Guided research wizard

`/novel-wizard research` is an optional loopback-only review surface. `/novel` remains the normal interface and may offer **Review voice and research evidence** as a non-primary action.

The research wizard may expose only sanitized summaries for taste evidence, experiment metadata, public-market observations and clusters, research items and source summaries, and revision-learning candidates. Do not include manuscript prose, reader-response bodies, raw public-review bodies, reviewer names/handles/profile URLs, voice source-scene prose, or variant prose in the initial snapshot.

All research-wizard changes must follow preview before apply. Store preview candidates in session memory under opaque IDs. On apply, reload canonical state, use the stored candidate rather than trusting resubmitted creative data, enforce the proposal's expected stage and project hash, and call `novel_apply_event` / `applyNovelEvent` with `event_type: research-update`. Never write project files directly from browser handlers.

Influence references remain private in `taste-profile.yaml`; only neutral derived traits may become drafting rules. Voice comparison displays anonymous A/B/C labels only. Writer scores summarize evidence and never choose prose automatically. Accepting a baseline requires 600–900 words, originality validation, exact hashes, baseline metrics, and consistent experiment/index/taste/guardrail updates in one transaction.

Public-review imports must remove reviewer identity and remain market evidence only. Research items marked ready must pass the existing source/readiness validator. Revision-learning candidates may be displayed, but only exact evidence plus explicit writer approval may create an approved future guardrail. No wizard action may mutate manuscript paths, reader evidence, publishing metadata, package outputs, project stage, gates, or approvals.

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

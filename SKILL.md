---
name: novel-forge-for-pi
description: "Use for guided, series-capable thriller and romantasy planning, drafting, review, real-reader evidence, revision, canon control, recovery, manuscript adoption, and packaging."
---

# Novel Forge for Pi

Novel Forge uses seven durable concepts: voice, canon, story threads, plot grid, remarkability, reader evidence, and revision tickets. Thriller and romantasy are typed profiles over one guarded workflow.

## Normal author workflow

After project creation, guide the writer through one command:

```text
/novel-start
/novel
/novel
```

Treat `/novel` as the primary interface. It must show the current decision and only the actions relevant to the active stage or gate. Do not require the writer to memorize internal gate IDs, stage names, file allowlists, or YAML fields.

The primary author-facing files are:

- `STATUS.md` for the current decision and evidence;
- `HANDOFF.md` for exact cross-session continuation;
- the active book's manuscript chapters.

## Core rules

- Optimize for reader trust and author-specific voice, not AI-detector evasion.
- Treat future-book plans as provisional until explicitly locked.
- Draft only from a ready, profile-valid chapter packet.
- Do not invent missing canon, thread, research, character, remarkability, or reader-evidence facts.
- Run heavy review at milestones, not after every chapter.
- Convert concrete review findings into evidence-backed revision tickets.
- Never bypass active human gates.
- Treat `remarkability.yaml` as ambition to protect, not proof that the manuscript achieved it.
- Treat only de-identified real-reader responses with `source: human` as outside-reader evidence. Personas and models never count as human validation.
- Use `git revert` for undo. Never reset or rewrite project history.
- Never overwrite existing manuscript chapters during adoption.

## Transaction rule

For voice, series plan, book plan, chapter queue, drafting, review, reader testing, revision, canon lock, and packaging work, prepare the allowed file contents and call `novel_apply_event`. Do not edit `PROJECT.yaml`, `BOOK.yaml`, `STATUS.md`, or `HANDOFF.md` directly. The tool owns validation, state transitions, derived guidance, rollback, and Git checkpointing.

A `reader-test` event may update only the active book's `reader-experiments.yaml`, its `reader-kit/` Markdown or CSV files, and evidence-backed `revision-tickets.yaml`. It must not rewrite manuscript prose or advance workflow state. It rejects model/simulated response sources, undersized validation claims, and aggregate rates that do not match recorded rows.

## Guided decisions

When a gate is pending, present a friendly gate card with:

- evidence files;
- warnings or blockers;
- approve;
- request changes;
- view evidence.

Approval must use the active pending gate and preserve writer identity, timestamp, evidence hash, and note. Requesting changes must store a specific writer note, mark only the active gate rejected, and expose the correct repair workflow.

When a project is healthy, offer one primary Continue action. At packaging, show the readiness checklist before compiling. At complete stage, propose the next book only when the current book is canon-locked or packaged; keep force as an explicit Advanced action.

## Planning interviews

Inspect existing evidence first. Ask one unresolved question at a time and no more than four normal questions. Ask one additional question only when a genuine blocker prevents a complete artifact.

For book planning, center the interview on:

1. the safe predictable version to avoid;
2. what the project can uniquely deliver;
3. the moment readers should retell;
4. what should remain alive after the ending.

Derive and present the complete typed artifacts. Do not expose the schema as a form for the writer to fill field by field.

## Drafting context

Read only the active packet, referenced canon and story threads, required research, profile rules, exact preceding chapter, capped remarkability contract, relevant voice evidence, active book bible, and genre configuration. Missing or closed references are blockers. Reader experiment responses stay out of drafting context.

## Reader evidence

Use `/novel` or `/novel-readers` to prepare a kit or import responses. Before collection, predeclare the target segment, exact sample or variant, delay, and `minimum_reader_count`. The delayed session occurs 24–72 hours later without reopening the sample and measures unprompted hook recall, signature-moment recall, friend-description specificity, productive disagreement, lingering questions, specific recommendation language, and independent talkability.

Compute aggregate rates from recorded human rows. Keep results segmented by reader type and leave the verdict blocked or insufficient when the predeclared minimum or real delayed evidence is missing.

## Recovery and adoption

Advanced guided tools may explain the first blocker, rebuild derived guidance, run integrity checks, upgrade package metadata, undo the last Novel Forge checkpoint, adopt an existing manuscript, or force-add a book.

Undo requires initialized Git, a clean worktree, and a `Novel Forge:` commit at `HEAD`. Reversing approval requires an extra confirmation.

Adoption reads a Markdown/text file or ordered chapter directory, preserves the source, refuses an occupied destination, writes normalized chapter files and an adoption report, updates book counts, and does not invent creative state.

## Power-user commands

```text
/novel
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
```

Administrative migration:

```text
/novel-migrate thriller|romantasy --dry-run
```

Specialist commands are compatibility and precision tools. They do not replace `/novel` as the normal author workflow.

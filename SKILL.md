---
name: novel-forge-for-pi
description: "Use for series-capable thriller and romantasy planning, drafting, review, real-reader evidence, revision, canon control, and packaging through the compact Novel Forge workflow."
---

# Novel Forge for Pi

Novel Forge uses seven durable concepts: voice, canon, story threads, plot grid, remarkability, reader evidence, and revision tickets. Thriller and romantasy are typed profiles over one workflow.

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

## Transaction rule

For voice, series plan, book plan, chapter queue, drafting, review, reader testing, revision, canon lock, and packaging work, prepare the allowed file contents and call `novel_apply_event`. Do not edit `PROJECT.yaml`, `BOOK.yaml`, or `STATUS.md` directly. The tool owns validation, state transitions, rollback, and Git checkpointing.

A `reader-test` event may update only the active book's `reader-experiments.yaml` and evidence-backed `revision-tickets.yaml`. It must not rewrite manuscript prose or advance workflow state. It also rejects model/simulated response sources, undersized validation claims, and aggregate rates that do not match the recorded response rows.

## Normal commands

```text
/novel-start
/novel-status
/novel-plan
/novel-run
/novel-draft
/novel-review
/novel-readers
/novel-revise
/novel-package
```

Administrative migration:

```text
/novel-migrate thriller|romantasy --dry-run
```

## Drafting context

Read only the active packet, referenced canon and story threads, required research, profile rules, the exact preceding chapter, a capped remarkability contract, relevant voice evidence, active book bible, and genre configuration. Missing or closed references are blockers. Reader experiment responses stay out of drafting context.

## Remarkability contract

During book planning, define the safe obvious version to avoid, author-only advantage, productive discomfort, retellable hook, signature moments, productive disagreements, restrained motifs, lingering question, hand-sell reason, and accepted reader costs. Do not manufacture quotable lines or repeat the premise merely to make the contract visible.

## Reader evidence

Use `/novel-readers` to prepare or record blind immediate and delayed experiments. Before collection, predeclare the target segment, exact sample/variant, delay, and `minimum_reader_count`. The delayed session should occur 24–72 hours later without reopening the sample and should measure unprompted hook recall, signature-moment recall, friend-description specificity, productive disagreement, lingering questions, specific recommendation language, and whether the reader independently told someone. Compute aggregate rates from the recorded human rows. Keep results segmented by reader type and leave the verdict blocked or insufficient when the predeclared minimum or real delayed evidence is missing.

## Approval gates

Voice, book plan, first chapter, act/midpoint/pre-final review, manuscript, and package approvals are real gates. Approve only the active pending gate after reviewing its evidence. Reader testing may supply evidence while a gate is pending, but it cannot approve the gate.

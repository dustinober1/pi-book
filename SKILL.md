---
name: novel-forge-for-pi
description: "Use for series-capable thriller and romantasy planning, drafting, review, revision, canon control, and packaging through the compact Novel Forge workflow."
---

# Novel Forge for Pi

Novel Forge uses five durable concepts: voice, canon, story threads, plot grid, and revision tickets. Thriller and romantasy are typed profiles over one workflow.

## Core rules

- Optimize for reader trust and author-specific voice, not AI-detector evasion.
- Treat future-book plans as provisional until explicitly locked.
- Draft only from a ready, profile-valid chapter packet.
- Do not invent missing canon, thread, research, or character facts.
- Run heavy review at milestones, not after every chapter.
- Convert concrete review findings into evidence-backed revision tickets.
- Never bypass active human gates.

## Transaction rule

For voice, series plan, book plan, chapter queue, drafting, review, revision, canon lock, and packaging work, prepare the allowed file contents and call `novel_apply_event`. Do not edit `PROJECT.yaml`, `BOOK.yaml`, or `STATUS.md` directly. The tool owns validation, state transitions, rollback, and Git checkpointing.

## Normal commands

```text
/novel-start
/novel-status
/novel-plan
/novel-run
/novel-draft
/novel-review
/novel-revise
/novel-package
```

Administrative migration:

```text
/novel-migrate thriller|romantasy --dry-run
```

## Drafting context

Read only the active packet, referenced canon and story threads, required research, profile rules, the exact preceding chapter, relevant voice evidence, active book bible, and genre configuration. Missing or closed references are blockers.

## Approval gates

Voice, book plan, first chapter, act/midpoint/pre-final review, manuscript, and package approvals are real gates. Approve only the active pending gate after reviewing its evidence.

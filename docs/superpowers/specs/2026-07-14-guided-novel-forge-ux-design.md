# Guided Novel Forge Experience Design

## Purpose

Novel Forge already has a strict, trustworthy production engine. This change makes that engine easier to operate without weakening stage authorization, human gates, transactional file allowlists, schema validation, Git checkpoints, context limits, profile rules, or human-only reader evidence.

The normal author workflow becomes:

```text
/novel-start
/novel
/novel
/novel
```

The existing specialist commands remain supported as power-user aliases.

## Product principles

1. Hide internal gate identifiers and YAML concepts from the normal workflow.
2. Present one recommended action at a time.
3. Preserve every existing safety and evidence rule.
4. Keep all project state portable in ordinary files and Git.
5. Make stopping, resuming, repairing, and handing work to a new session explicit.
6. Do not add a web application, database, or UI framework.

## Command architecture

A new `/novel` root command acts as a guided shell over existing application functions. It reads current project state and presents context-sensitive actions through Pi's existing `ui.select`, `ui.confirm`, `ui.input`, and `ui.notify` APIs.

The command never bypasses authorization. It delegates to the same planning prompts, `decideNextRun`, review prompts, reader workflows, packaging functions, and guarded `novel_apply_event` tool used by specialist commands.

Primary choices are limited to the current stage:

- Continue recommended work
- Review or repair the active gate
- View status
- Reader evidence when appropriate
- Advanced tools

Advanced tools expose adoption, recovery, integrity, metadata upgrade, handoff refresh, and specialist commands without putting them in the normal path.

## Gate review cards

When a gate is pending, `/novel` displays a human-readable card with:

- friendly gate title;
- evidence files;
- relevant warnings and blockers;
- approve, request changes, and view evidence actions.

Approval still records `approved_by: writer`, timestamp, evidence hash, and note. Requesting changes marks only the active gate rejected and records a writer note in a durable gate-decision log. It does not automatically rewrite prose or planning files.

Rejected gates expose one repair action mapped to the gate owner:

- voice approval -> rebuild voice profile;
- book-plan approval -> repair book plan;
- first-chapter approval -> chapter review;
- act gates -> act review;
- manuscript approval -> manuscript review;
- package approval -> packaging repair.

## Decision-oriented status

`STATUS.md` becomes an author decision screen rather than a raw diagnostic list. It begins with:

1. What needs you
2. Recommended action
3. Why this stopped
4. Project snapshot

Detailed blockers, warnings, and recent files remain below the decision section. The status model also returns structured fields used by `/novel` and `HANDOFF.md`.

## Durable handoff

Every new project contains `HANDOFF.md`. Every guarded workflow event, gate decision, book addition, adoption, metadata upgrade, recovery operation, and explicit status refresh regenerates it.

The handoff records:

- project, active book, profile, and stage;
- Git branch at `HEAD` and current project-state hash;
- last completed action supplied by the caller;
- active gate or first blocker;
- manuscript chapter and word-count state;
- locked or protected facts summarized from current state;
- files the next session should read;
- files it should not edit directly;
- exact next command;
- a ready-to-paste continuation prompt.

A commit cannot safely contain its own final SHA. The file therefore records the stable Git reference `<branch> @ HEAD` plus the exact project-state hash, rather than a self-referential commit hash.

## Guided planning interviews

Planning prompts stop exposing the full schema as a questionnaire. They first use existing project evidence, then ask only unresolved author decisions one at a time.

Voice planning asks at most four concise questions about intended effect, positive evidence, unwanted tendencies, and lived-material boundaries.

Series planning asks at most four questions about recurring promise, escalation, cast pressure, and closure/carry rules.

Book planning asks at most four primary author questions:

1. What is the safe predictable version to avoid?
2. What can this project uniquely deliver?
3. What moment should readers retell?
4. What should remain alive after the ending?

The agent derives the full typed genre, architecture, and remarkability artifacts, then presents them for approval. It may ask a single additional blocking question only when required information cannot be inferred.

## Recovery and repair

Advanced guided actions include:

- Explain the first blocker with an exact recovery command.
- Rebuild `STATUS.md` and `HANDOFF.md` from authoritative files.
- Run the structured integrity scan.
- Upgrade project package metadata.
- Undo the last Novel Forge Git checkpoint.

Undo is guarded:

- Git must be initialized.
- The worktree must be clean.
- `HEAD` must have a `Novel Forge:` commit message.
- Reverting an approval checkpoint requires explicit confirmation.
- The implementation uses `git revert`, never history rewriting.

## Existing-manuscript adoption

`/novel-adopt <path>` and the advanced guided menu import an existing Markdown or plain-text manuscript without deleting or modifying the source.

A directory import treats numerically sorted `.md` and `.txt` files as chapters. A single-file import splits on Markdown or plain `Chapter N` headings; when no chapter headings exist, it becomes Chapter 1. Import is rejected when destination chapter files already exist.

The operation writes normalized chapter files, updates the active book's chapter and word counts, writes an adoption report, refreshes guidance files, and creates one Git checkpoint. It does not invent plot, canon, reader evidence, or approval state.

## Reader kit and CSV import

The guided reader workflow can prepare a kit under `books/<book-id>/reader-kit/`:

- `sample.md`
- `immediate-questions.md`
- `delayed-questions.md`
- `responses.csv`

Preparation predeclares the experiment ID, exact target segment, sample, delay, and minimum reader count. The kit is applied as a guarded `reader-test` event.

CSV import accepts one row per phase and reader. It rejects non-human sources, duplicate phase/reader pairs, malformed booleans, delayed responses without matching immediate readers, and unknown experiments. It computes aggregate metrics from rows, updates status, and leaves verdicts conservative unless the recorded evidence supports a stronger claim.

## Packaging and next-book guidance

At packaging, `/novel` displays a checklist covering manuscript approval, canon lock, blocking tickets, compiled manuscript availability, reader-evidence claim limits, and package fields. The author confirms before the package prompt is queued.

At complete stage, the primary action becomes context-aware book expansion. It shows the current book's lock/package state, proposes the next `book-NN` identifier, asks for target words, and calls the existing guarded `addBook` path. Forced expansion remains an advanced explicit override.

## Version and release compatibility

Package version advances to `1.1.0`.

`PROJECT.yaml` keeps `schema_version: 1.0.0` and gains optional `novel_forge_version`. New projects write `1.1.0`; older projects remain readable. Status reports:

- missing version as an upgrade warning;
- older supported version as an upgrade warning;
- newer-than-installed version as a blocker.

A metadata upgrade action writes the installed package version without changing creative state.

Release polish includes:

- `CHANGELOG.md`;
- two-minute README quick start;
- corrected tag-based installation instructions;
- generated `START-HERE.md`;
- explicit release checklist.

The `v1.1.0` tag is created only after the feature PR is merged and the merge commit passes CI.

## Testing strategy

All behavior uses the existing Node test runner and real temporary project fixtures.

Required coverage:

- version compatibility and upgrade;
- guided decision selection for every stage and gate state;
- real Pi registration and `/novel` interaction;
- friendly gate approval and rejection persistence;
- decision-oriented status and handoff generation;
- planning prompt question caps;
- undo guards and successful revert;
- adoption parsing and non-overwrite behavior;
- reader-kit creation, CSV validation, and metric calculation;
- packaging checklist and next-book recommendation;
- existing lifecycle, event, profile, migration, reader, package, evaluation, and packed-extension tests.

CI remains Node 22.19.0 and Node 24 with typecheck, full tests, evaluations, packed-extension smoke testing, and `npm pack --dry-run`.
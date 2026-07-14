# Novel Forge for Pi

Novel Forge is a guided, series-capable production workflow for high-quality **thriller** and **romantasy** novels. It protects author-specific voice, canon, story threads, causal architecture, memorable book identity, and evidence-backed revision without chasing AI-detector scores.

## Install

After the verified 1.1.0 release tag is published:

```bash
pi install git:github.com/dustinober1/pi-book@v1.1.0
```

## Two-minute quick start

Create the project:

```text
/novel-start My Novel --profile thriller --type planned-series --target-words 110000
```

Then use one command:

```text
/novel
```

Run `/novel` again whenever the current action finishes. It reads the workflow state and shows only the choices that matter now: continue, review a gate, request changes, inspect evidence, use reader testing, recover safely, package the book, or add the next installment.

You do not need to memorize stage names, gate identifiers, YAML fields, or specialist commands.

## The three author-facing locations

- `STATUS.md` — the current decision, reason, blockers, warnings, and progress.
- `HANDOFF.md` — the exact resume state and a ready-to-paste continuation prompt for another session.
- `books/<book-id>/manuscript/chapters/` — the accepted chapter files.

`START-HERE.md` in every new project points back to `/novel`.

## What `/novel` does

The guided command is a shell over the same strict engine used by the specialist commands.

At ordinary stages it offers one recommended Continue action. At a pending human gate it displays a friendly decision card:

```text
Voice Profile Ready for Decision

[Approve voice profile]
[Request changes]
[View evidence files]
[View full status]
[Advanced options]
```

Approval still records writer identity, time, evidence hash, and note. Requesting changes keeps the gate active, stores the writer's repair note, and provides an exact repair path.

At packaging, `/novel` checks manuscript availability, manuscript approval, canon lock, blocking tickets, reader-claim limits, and package state before continuing. At completion, it proposes the next book identifier, inherited profile, and target-word default.

## Automatic status and handoff

Every guarded planning, drafting, review, reader, revision, canon-lock, and package event refreshes `STATUS.md` and `HANDOFF.md` in the same Git checkpoint.

`HANDOFF.md` records:

- project, active book, profile, and stage;
- Git branch at `HEAD` and the exact project-state hash;
- last completed action;
- active gate or first blocker;
- manuscript chapter and word state;
- files to read first and files not to edit directly;
- the exact next command;
- a continuation prompt for a new context window.

The file uses `<branch> @ HEAD` rather than embedding a self-referential commit SHA. The project-state hash identifies the exact workflow state.

## Short planning interviews

Voice, series, and book planning inspect existing evidence first. The normal interview asks one unresolved question at a time and no more than four questions. A fifth question is allowed only when a genuine blocker prevents a complete artifact.

Book planning centers the interview on four author decisions:

1. What is the safe, predictable version to avoid?
2. What can this project uniquely deliver?
3. What moment should readers retell?
4. What should remain alive after the ending?

Novel Forge derives the complete typed genre, architecture, thread, and remarkability artifacts from those answers and existing evidence, then presents the result for approval.

## Safe recovery

Open `/novel`, choose **Advanced options**, and use:

- Explain current blocker
- Rebuild status and handoff
- Run integrity check
- Upgrade project metadata
- Undo last Novel Forge event
- Adopt an existing manuscript
- Force-add another book

Undo is deliberately conservative. Git must be initialized, the worktree must be clean, and `HEAD` must be a `Novel Forge:` checkpoint. It creates a normal `git revert` commit. Reversing a writer-approval checkpoint requires a second explicit confirmation. History is never reset or rewritten.

## Adopt an existing manuscript

Use the guided Advanced menu or:

```text
/novel-adopt /path/to/manuscript
```

Novel Forge accepts:

- a directory of numerically ordered `.md` or `.txt` chapter files;
- one Markdown or text manuscript split by `Chapter N` headings;
- one heading-free file as Chapter 1.

The source is read-only. Adoption refuses to run when the active book already contains chapter files. It writes normalized chapter files, updates chapter and word counts, creates `adoption-report.md`, refreshes guidance, and creates one Git checkpoint. It does not invent plot, canon, approval, queue, or reader evidence.

## Real-reader kits

Use `/novel`, choose Reader evidence, or use the specialist forms:

```text
/novel-readers kit first-page
/novel-readers kit first-chapter
/novel-readers import RE-001 books/book-01/reader-kit/responses.csv
```

A prepared kit contains:

```text
books/book-01/reader-kit/
  sample.md
  immediate-questions.md
  delayed-questions.md
  responses.csv
```

The experiment predeclares the exact target-reader segment, sample, variant, delay, and minimum reader count. CSV import accepts quoted fields and semicolon-separated list fields, but rejects:

- any source other than `human`;
- duplicate phase/reader rows;
- malformed boolean values;
- delayed responses without a matching immediate response;
- unknown experiment IDs.

Aggregate rates are recomputed from the recorded rows. Missing sample minimums or delayed evidence leave the verdict blocked or insufficient. Model and persona responses never count as outside-reader validation.

## Compact project model

```text
PROJECT.yaml
START-HERE.md
STATUS.md
HANDOFF.md
series/
  series-bible.md
  voice-profile.md
  series-arc.yaml
  canon.yaml
  story-threads.yaml
books/book-01/
  BOOK.yaml
  book-bible.md
  genre.yaml
  plot-grid.yaml
  chapter-queue.yaml
  continuity-delta.yaml
  remarkability.yaml
  reader-experiments.yaml
  revision-tickets.yaml
  manuscript/chapters/
research/
  source-register.yaml
  notes/
```

Review reports and package files are created when those workflows produce substantive content rather than as empty placeholders.

A standalone is a one-book project, not a different format. Normal next-book creation requires the current book to be canon-locked or packaged. Force remains an explicit Advanced action.

## Transactional agent changes

Planning, drafting, review, reader-evidence, revision, canon-lock, and packaging prompts do not ask the agent to write files directly. They require the `novel_apply_event` tool. The tool:

1. verifies the expected stage and project hash;
2. enforces an event-specific file allowlist;
3. validates YAML, profile values, canon/thread/research references, packet state, reader source, sample minimums, and aggregate reader metrics;
4. derives `PROJECT.yaml` and `BOOK.yaml` transitions in code;
5. applies the files as a rollback-capable transaction;
6. refreshes status and handoff;
7. creates one Git checkpoint for the complete workflow event.

Reader-test events can update only the active book's reader experiments, reader-kit files, and evidence-backed revision tickets. They cannot rewrite manuscript prose or advance creative workflow state.

## Power-user commands

The guided workflow is primary, but all specialist commands remain supported:

| Command | Purpose |
| --- | --- |
| `/novel` | Show the one recommended action and guided choices |
| `/novel-start` | Create a standalone or series-capable project |
| `/novel-status` | Rebuild and show status and handoff |
| `/novel-plan` | Build or repair voice, series, or active-book plans |
| `/novel-run` | Advance safe work until a gate, blocker, or limit |
| `/novel-draft` | Draft the next approved chapter packet |
| `/novel-review` | Review a chapter, act, manuscript, or series |
| `/novel-readers` | Prepare kits, import responses, or run evidence workflows |
| `/novel-revise` | Apply open revision tickets |
| `/novel-package` | Check readiness, compile, and prepare the package |
| `/novel-adopt` | Administratively import an existing manuscript |
| `/novel-migrate` | Administratively migrate a Genesis v0.4 project |

Administrative migration remains:

```text
/novel-migrate thriller --dry-run
```

Migration preserves legacy files, computes manuscript checksums, creates provisional structured candidates, and requires human reconciliation before candidates become locked truth.

## Version compatibility

New projects record both the stable project schema and the installed Novel Forge package version. The package version can evolve without forcing a schema migration.

- Missing or older `novel_forge_version`: project remains readable and `/novel` offers a metadata upgrade.
- Malformed version: warning and guided repair.
- Project written by a newer package: blocker until Novel Forge is upgraded.

A metadata upgrade changes only package metadata and derived guidance. It does not change creative stage, gates, or approvals.

## Profiles and context

Thriller validates typed threat, evidence, forecast, choice, causality, genre settings, and midpoint state change. Romantasy validates typed fantasy, romance, trust, desire, power, consent, ending contract, and dual-arc progression.

Chapter context includes the active packet, referenced canon and story threads, required research, profile rules, exact preceding chapter, a capped remarkability contract, relevant voice evidence, book bible, and genre configuration. Missing or closed references block drafting. Reader responses, non-adjacent chapters, future books, and packaging material stay out of drafting context.

## Deterministic audits

```bash
npm run audit:ngrams -- /path/to/project
npm run audit:rhetoric -- /path/to/project
npm run audit:continuity -- /path/to/project
npm run audit:integrity -- /path/to/project
npm run audit:structure -- /path/to/project
npm run audit:spelling -- /path/to/project
npm run audit:temporal -- /path/to/project
npm run audit:mechanics -- /path/to/project
```

Scanner findings are evidence, not final literary verdicts.

## Release

See `CHANGELOG.md` and `RELEASE.md`. The `v1.1.0` tag must be created only after the feature pull request is merged and the merge commit passes the full Node 22.19.0 and Node 24 verification matrix.

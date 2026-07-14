# Novel Forge for Pi

Novel Forge is a compact, series-capable production workflow for high-quality **thriller** and **romantasy** novels. It protects author-specific voice, canon, story threads, causal architecture, memorable book identity, and evidence-backed revision without chasing AI-detector scores.

## Install

```bash
pi install git:github.com/dustinober1/pi-book@novel-forge-v1
```

## Commands

| Command | Purpose |
| --- | --- |
| `/novel-start` | Create a standalone or series-capable project |
| `/novel-status` | Show gates, blockers, manuscript progress, and next action |
| `/novel-plan` | Build or repair voice, series, active-book, and remarkability plans |
| `/novel-run` | Advance safe work until a gate, blocker, or requested limit |
| `/novel-draft` | Draft the next approved chapter packet |
| `/novel-review` | Review a chapter, act, manuscript, or series |
| `/novel-readers` | Prepare or record immediate and delayed real-reader evidence |
| `/novel-revise` | Apply open revision tickets |
| `/novel-package` | Compile and prepare the editorial package |

Administrative migration: `/novel-migrate thriller|romantasy [--dry-run] [--force]`.

## Workflow

```text
/novel-start
/novel-plan voice
/novel-run --approve voice-approval
/novel-plan series
/novel-plan book
/novel-run --approve book-plan-approval
/novel-run --until first-chapter-approval
/novel-readers first-chapter
/novel-run --approve first-chapter-approval
/novel-run --until act-1-review
/novel-review act
/novel-revise
```

Approvals cannot skip stages. A gate must be the active `next_gate`, be `pending`, and belong to the current stage. Direct drafting, review, revision, packaging, and series expansion also enforce stage and handoff rules. Reader testing may run while a creative gate is pending because it supplies evidence for the writer; it never approves the gate itself.

## Transactional agent changes

Planning, drafting, review, reader-evidence, revision, canon lock, and packaging prompts do not ask the agent to write files directly. They require the `novel_apply_event` tool. The tool:

1. verifies the expected stage and project hash;
2. enforces an event-specific file allowlist;
3. validates YAML, profile values, canon/thread/research references, and packet state;
4. derives PROJECT.yaml and BOOK.yaml transitions in code;
5. applies the files as one rollback-capable transaction;
6. creates one Git checkpoint for the workflow event.

Reader-test events can update only the active book's `reader-experiments.yaml` and evidence-backed `revision-tickets.yaml`. They cannot rewrite manuscript prose or advance the workflow stage.

## Compact project model

```text
PROJECT.yaml
STATUS.md
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
  review-report.md
  package.md
  manuscript/chapters/
research/
  source-register.yaml
  notes/
```

A standalone is a one-book project, not a different format. Adding another book normally requires the current book to be canon-locked; `--force` is an explicit override.

## Remarkability contract

`remarkability.yaml` names the creative ambition that ordinary reliability checks cannot prove:

- the safe, obvious version to avoid;
- the author-only advantage;
- productive discomfort and accepted reader costs;
- the retellable hook;
- planned signature moments;
- productive reader disagreements;
- restrained recurring motifs;
- the lingering question and hand-sell reason.

The contract is created during book planning and included in drafting context only as a small capped section. It is not a demand for forced quotability, artificial controversy, or repeated restatement of the premise.

## Real-reader evidence

Use `/novel-readers first-page|first-chapter|sample|act|manuscript|record` to prepare or update `reader-experiments.yaml`.

A complete experiment separates:

- immediate continuation, purchase intent, confusion, trust breaks, and lines that worked;
- delayed recall 24–72 hours later without reopening the sample;
- unprompted hook and signature-moment recall;
- friend-description specificity;
- productive disagreement and lingering questions;
- a specific recommendation target and reason;
- whether the reader independently told someone about the sample.

Results remain segmented by reader type. Personas and model reviewers may prepare questions, but they never count as outside-reader evidence. Missing real or delayed responses leave the verdict `blocked` or `insufficient-signal`; Novel Forge does not fake validation.

## Context policy

Chapter context includes the approved packet, referenced canon and story threads, required research, the exact preceding chapter, a capped remarkability contract, relevant voice evidence, book bible, and genre settings. Missing references or paid-off/abandoned threads block drafting. Reader responses, non-adjacent chapters, future books, and packaging material stay out of drafting context. Context is budgeted by section priority instead of truncating the most local prose from the end.

## Profiles

Thriller validates typed threat/evidence/forecast/choice fields, genre settings, causality, and midpoint state change. Romantasy validates typed fantasy/romance/trust/desire/power/consent fields, declared ending contract, and fantasy/romance/rupture architecture.

## Legacy migration

Run a dry run first:

```text
/novel-migrate romantasy --dry-run
```

Migration detects multi-book Genesis workspaces, preserves legacy files, computes manuscript SHA256 checksums, creates provisional structured canon/story-thread/ticket candidates, and blocks repeat migration. Human review is still required before candidates become locked truth. Migrated projects receive empty typed remarkability and reader-experiment artifacts for deliberate reconstruction.

## Evaluations

Use `evals/rubrics/blinded-editorial-review.md` for randomized matched-passage comparisons and `evals/rubrics/delayed-reader-recall.md` for real-reader follow-up. Report reader-segment distributions rather than averaging all readers into a false universal quality score.

## Deterministic audits

```bash
npm run audit:ngrams -- /path/to/project
npm run audit:rhetoric -- /path/to/project
npm run audit:continuity -- /path/to/project
npm run audit:structure -- /path/to/project
npm run audit:spelling -- /path/to/project
npm run audit:temporal -- /path/to/project
npm run audit:mechanics -- /path/to/project
```

Scanner findings are evidence, not final literary verdicts.

# Novel Forge 1.4 Resumable Automation Runs

## Purpose

Persistent runs preserve the writer's requested automation target across pauses and context resets without bypassing any Novel Forge gate.

Start a persistent run with a target or chapter budget:

```text
/novel-run --until midpoint-review
/novel-run --max-chapters 6
```

Control the stored run with:

```text
/novel-run --pause
/novel-run --resume
/novel-run --cancel
```

## What is persisted

`PROJECT.yaml` records the run ID, status, target, starting stage, current action, chapter budget, completed deterministic event keys, creative-state hash, retry counts, refill count, stop reason, and timestamps.

`STATUS.md` and `HANDOFF.md` remain derived files. A paused handoff includes the exact resume command and completed-event count.

## Resume safety

Resume checks the stored stage and creative-state hash before returning another creative prompt. The creative hash covers canonical project, book, premise, research, strategy, voice, reader, and revision evidence while excluding the run record itself.

If creative state changed outside the run, Novel Forge records the run as stopped and returns no new prompt. The writer can inspect the changed state and begin a new run.

## Duplicate and retry rules

Every completed action has a deterministic event key such as `draft-chapter:4`. Completed keys persist across reloads and are never replayed.

Schema or reference rejection may receive one corrected resubmission for the same event key. A second retryable rejection stops the run. Human gates, unsafe paths, wrong stages, integrity failures, and other nonretryable errors stop immediately.

## Pause, cancel, and undo

Pause and cancel are state-neutral guided checkpoints. They do not modify manuscript prose, book state, gates, approvals, or completed creative work.

Cancelled and completed runs cannot resume. Existing Novel Forge undo remains Git-based: it creates a revert commit for one checkpoint and never rewrites history.

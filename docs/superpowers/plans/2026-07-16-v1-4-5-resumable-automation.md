# Novel Forge 1.4-5 — Persistent Resumable Automation

## Goal

Persist bounded-run intent across pauses, restarts, and safe failures without bypassing gates or replaying completed work.

## Design

- Add optional `automation.active_run` state to `PROJECT.yaml`.
- Existing projects without it remain valid; new projects initialize it to null.
- Store run ID, status, target, starting stage, current action, chapter budget, completed event keys, creative-state hash, refill count, retry counts, stop reason, and timestamps.
- Use a creative-state hash that excludes active-run bookkeeping, avoiding a self-referential hash while still detecting outside creative changes.
- Run-state changes are internal guided transactions that update `PROJECT.yaml` and regenerate the derived `STATUS.md` and `HANDOFF.md` files.
- Completed deterministic event keys are never replayed.
- One retryable schema/reference rejection is allowed per event key; a second stops the run.
- Human gates and nonretryable failures stop immediately.
- Pause and cancel are idempotent. Cancelled or completed runs cannot resume.
- Guarded undo means the existing Novel Forge undo command creates a new Git revert commit for one run-state checkpoint; it never rewrites history or silently reverses writer approvals.

## Implementation units

1. Extend the schema and add pure lifecycle/policy services.
2. Add creative-state hashing and guided persistence.
3. Integrate resume, pause, cancel, status, guide, handoff, prompts, and command parsing.
4. Verify reload, duplicate prevention, stale-state stopping, retry counting, gate stopping, and guarded undo.

## Verification

The exact branch head must pass install, TypeScript, all tests, evaluations, release-tree verification, and package dry-run on Node 22.19.0 and Node 24 before merge.

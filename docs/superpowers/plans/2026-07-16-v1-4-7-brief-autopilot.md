# Novel Forge 1.4-7 — Brief Bootstrap and Idea-to-Next-Gate Autopilot

## Goal

Allow an author to start from one idea or an authorized brief, persist the evidence, and advance through safe work one guarded action at a time until the next genuine writer decision.

## Design

- `--brief` authorizes one read-only Markdown or text source during initialization.
- Brief contents are not copied into the package or chapter context.
- Extracted idea/setup fields enter `series/intake.yaml` as author input.
- Missing setup fields remain visible assumptions or blockers; they never become confirmed facts automatically.
- `--auto-to` starts a persistent run after initialization.
- It reuses the existing `allowedUntilTargets` contract: `voice-approval`, `book-plan-approval`, `first-chapter-approval`, `act-1-review`, `midpoint-review`, `pre-final-act-review`, `manuscript-review`, and `next-milestone`.
- Autopilot uses the existing stage prompts and guarded events, reloading state after every accepted event.
- It stops at every human gate, unselected premise, nonretryable rejection, missing evidence, or requested target.
- It never approves a gate or selects a premise.

## Implementation units

1. Add a deterministic brief parser and intake bootstrap service.
2. Add target-aware autopilot stop/continue policy.
3. Extend `/novel-start` with `--brief` and `--auto-to`.
4. Extend run/status/handoff guidance for autopilot targets.
5. Add complete-brief, one-sentence idea, source immutability, restart, and stop-boundary tests.

## Verification

The final head must pass install, TypeScript, all tests, evaluations, release-tree verification, and package dry-run on the exact Node 22.19.0 and Node 24 matrix before merge.

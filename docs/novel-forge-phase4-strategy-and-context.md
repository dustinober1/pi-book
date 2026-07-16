# Novel Forge 1.3 Phase 4 — Strategy, Consequences, and Research Context

Phase 4 strengthens the existing `/novel` book-planning and drafting flow. It does not add a new command, stage, service, or approval shortcut.

## Book-plan approval contract

A rebuilt book plan now includes:

- a specific reader promise and approved expectation decisions;
- the existing research ledger, source register, reader-friction decisions, and accepted tradeoffs;
- a decision-and-consequence ledger in `plot-grid.yaml`;
- a ten-part plan stress test in `book-strategy.yaml`.

Each decision entry records:

- the chapter containing the choice;
- the choice itself;
- its immediate gain;
- its deferred cost;
- its irreversible effect;
- the planned payoff window;
- whether the choice is planned, made, paid off, or abandoned.

A payoff window must occur after the choice and remain inside planned chapters. Plot payoffs must have an earlier setup. Three consecutive ready packets may not use the same scene engine.

## Ten-part plan stress test

Before the book-plan approval gate becomes available, Novel Forge requires an evidence-backed decision for:

1. early genre promise;
2. middle repetition;
3. motivated risk;
4. fair information;
5. uneven alternatives, suspects, or rivals;
6. avoidable-silence conflict;
7. redundant characters;
8. the external ending contract;
9. the emotional ending contract;
10. reference similarity and intentional tradeoffs.

Each check must either pass or link to a recorded accepted tradeoff. Pending and blocked checks stop the event. Novel Forge validates the evidence but never records writer approval automatically.

## Ready research in chapter context

New chapter packets use ready `RES-NNN` research-ledger IDs. A ready claim must retain its Phase 3 provenance and dramatic-use requirements.

The in-memory continuity graph now includes `research-item` records. An explicitly required ready claim may discover only mutually registered supporting sources:

- the research item names the source in `source_ids`;
- the source names the item in `supports_research_ids`.

Research-source nodes remain terminal. A shared source cannot pull another claim, canon fact, or thread into the chapter prompt. Legacy `SRC-NNN` packet references retain their previous explicit-source behavior until a later plan rebuild migrates them.

## Drafting-context boundaries

The chapter context may include:

- the approved chapter packet;
- safe canon, relationships, and active threads;
- explicitly required ready research claims;
- their registered source provenance;
- approved neutral voice guardrails;
- approved review-derived book guardrails.

It excludes:

- raw public-review observations and excerpts;
- reviewer identity;
- unrequired research claims;
- unapproved book guardrails;
- raw influence references and voice-experiment prose;
- reader-experiment response bodies;
- graph-blocked provisional, inactive, future-book, or unready records.

## Compatibility

Existing plot grids and book strategies remain readable without `decisions` or `plan_stress_test`. New projects receive an empty decision ledger and the ten pending stress checks. The stronger fields become mandatory only when the writer intentionally rebuilds the book plan for approval.

No graph database, embeddings service, hosted runtime, telemetry, or new dependency is introduced. Canonical YAML remains authoritative; the graph remains deterministic, local, bounded, and disposable.

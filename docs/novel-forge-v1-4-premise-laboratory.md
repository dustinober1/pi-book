# Novel Forge 1.4 Premise Laboratory

## Purpose

The premise laboratory lets the writer compare several recognizable structural versions of a book idea before the architecture hardens.

Open it from the normal `/novel` guide by choosing **Compare and select a premise**, or launch it directly:

```text
/novel-wizard premise
```

## What a premise lab contains

A populated premise lab contains three to five variants. Variant 1 is the raw author idea or its closest faithful expansion. Every variant preserves the declared seed elements while exploring a different story engine.

Each variant records:

- a title and premise;
- the preserved seed elements;
- a unique story engine;
- the central final-page question;
- an immediate gain;
- a deferred cost;
- an irreversible effect;
- differentiation from the other versions;
- series potential;
- accepted tradeoffs;
- neutral diagnostic observations.

## No scoring or automatic winner

Novel Forge does not score, rank, recommend, or automatically choose a premise. There is no model-selected winner field in the schema.

The writer reviews the structural comparison and explicitly selects one `PV-NNN` variant. Novel Forge records that choice as an unreplaced writer decision in `series/decision-ledger.yaml` with:

- the active book as scope;
- `premise-selection` as subject;
- the chosen variant ID as the decision value;
- writer-supplied evidence for the choice.

The premise lab may hold an active selection only when that exact decision exists.

## Transaction boundary

Comparison and selection use the state-neutral `premise-update` event. It is allowed only during book planning and may write only:

- `books/<active-book>/premise-lab.yaml`;
- `series/decision-ledger.yaml`.

It cannot advance the stage, change gates or approvals, modify book/project state, write manuscript prose, alter reader evidence, or change publishing, marketing, package, status, or handoff files directly.

Every accepted update still uses the existing stage/hash checks, typed schemas, structured rejection envelope, rollback, Git checkpoint, and regenerated guidance.

## Context isolation

Only the explicitly selected premise and its structural consequences enter the book-planning prompt. Nonselected variants are excluded.

No premise-lab prose—selected or unselected—enters chapter drafting context. Chapter drafting continues to rely on the approved book architecture, chapter packet, voice guardrails, canon, threads, and required research.

The premise generator and wizard snapshot do not read or expose private taste-profile influence names.

## Compatibility

New books receive an empty strict premise lab. Existing approved Novel Forge 1.3 projects without `premise-lab.yaml` remain readable and retain their approvals. The premise lab becomes authoritative only when the writer intentionally uses it or rebuilds the book plan under the 1.4 workflow.

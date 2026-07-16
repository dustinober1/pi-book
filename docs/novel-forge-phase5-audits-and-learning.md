# Novel Forge Phase 5 — Audits and Revision Learning

## What Phase 5 adds

Phase 5 adds three bounded feedback loops without turning Novel Forge into an automatic rewriting system:

1. deterministic voice-drift evidence;
2. scene-engine and story-state diversity checks;
3. recurrence-based candidates for writer-approved future guardrails.

The author still controls every creative approval. Audit output is diagnostic evidence. It does not rewrite prose, approve a guardrail, or declare a book good or bad.

## Voice evidence

When `series/voice-guardrails.yaml` contains an accepted baseline content hash and baseline metrics, Novel Forge records a voice audit after Chapter 1, Chapter 3, an act review, manuscript review, or explicit recalibration. A missing baseline is not a failure; the workflow continues without creating an audit.

The extractor records word and sentence counts, average and median sentence length, average paragraph length, dialogue ratio, fragment ratio, rhetorical-question ratio, filter-word rate, repeated body-language vocabulary, and interiority rate. Deltas are current minus baseline and are rounded consistently.

These values are evidence, not targets. Novel Forge does not instruct the writer to hit a specific dialogue percentage or sentence average. Protected intentional exceptions can explain a purposeful variation, such as a question-heavy interrogation chapter.

```bash
npm run audit:voice -- /path/to/project
```

The command prints JSON and does not change project files.

## Scene and state-change evidence

During review, Novel Forge checks the approved chapter queue and plot grid for four deterministic patterns:

- three or more consecutive chapters with the same scene engine;
- one engine used in more than half of a plan containing at least six packets;
- conversation-driven scenes with no declared case, relationship, power, or knowledge movement;
- adjacent chapters with the same normalized state change.

A finding becomes a revision ticket with evidence and recurrence metadata. Multi-chapter findings remain book-level tickets with `chapter: null`; their full chapter list remains in the evidence. The review event never edits manuscript prose.

## Recurrence and learning rules

A ticket may record a stable `pattern_id` and a milestone review. Novel Forge groups tickets by pattern. A pattern becomes eligible after occurrences in three distinct chapters or two distinct milestone reviews. Multiple tickets from the same chapter or milestone count once.

Eligibility creates a candidate only. The author must approve a rule in `book-strategy.yaml`. An approved record must match the exact supporting ticket IDs, distinct chapters, and milestone reviews. Proposed and rejected records stay outside drafting context.

```yaml
revision_learning_guardrails:
  - id: LRN-001
    pattern_id: PAT-dialogue-loop
    rule: Every interview must change case, relationship, power, or knowledge state.
    source_ticket_ids: [B01-T001, B01-T002, B01-T003]
    distinct_chapters: [4, 9, 14]
    milestone_reviews: []
    status: approved
```

Approved rules affect future chapter prompts only. Phase 5 does not reopen or rewrite earlier unaffected prose.

## Compatibility and safety

- Legacy tickets, voice audits, and Phase 4 strategies remain readable.
- New Phase 5 fields are optional until used.
- Metrics do not create automatic severity.
- Scene findings create tickets, not prose edits.
- Candidates do not approve themselves.
- Only approved rules enter future context.
- All accepted changes still pass through stage/hash checks, typed schemas, path allowlists, rollback, Git checkpointing, `STATUS.md`, and `HANDOFF.md`.

from pathlib import Path

root = Path('.')


def insert_after(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor!r}')
    file.write_text(text.replace(anchor, anchor + addition, 1), encoding='utf-8')


def insert_before(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor!r}')
    file.write_text(text.replace(anchor, addition + anchor, 1), encoding='utf-8')


insert_after(
    'CHANGELOG.md',
    '- Bounded `Required ready research claims` and `Approved book guardrails` drafting-context sections that exclude public-review bodies, unrequired claims, and unapproved rules.\n',
    '- Deterministic voice-metric extraction for sentence and paragraph distribution, dialogue, fragments, rhetorical questions, filter words, repeated body-language vocabulary, and interiority.\n'
    '- Baseline- and POV-aware voice-audit evidence at Chapter 1, Chapter 3, act review, manuscript review, and explicit recalibration milestones when an accepted baseline exists.\n'
    '- Deterministic scene audits for more than two consecutive identical engines, whole-plan engine dominance, state-neutral conversations, and adjacent indistinguishable state changes.\n'
    '- Revision-ticket recurrence metadata and exact promotion eligibility after three distinct chapters or two distinct milestone reviews.\n'
    '- Writer-approved revision-learning guardrails that enter future drafting context without triggering retroactive prose changes.\n'
    '- A read-only `npm run audit:voice -- <project-root>` command that prints deterministic JSON evidence and never mutates project files.\n',
)
insert_after(
    'CHANGELOG.md',
    '- Review events may write typed `voice-audits.yaml` evidence without making it mandatory during this foundation phase.\n',
    '- Chapter 1 and Chapter 3 draft events append voice-audit evidence automatically when accepted baseline metrics exist; missing baselines remain non-blocking.\n'
    '- Act and manuscript review events append voice-audit evidence and synthesize deterministic scene findings into revision tickets rather than editing prose.\n'
    '- Approved learning rules are validated against exact recurrence evidence before `research-update` accepts them.\n',
)
insert_after(
    'CHANGELOG.md',
    '- Existing plot grids and book strategies without Phase 4 fields remain readable. New projects receive empty decision ledgers and pending stress-test templates; a deliberate book-plan rebuild must complete them before approval.\n',
    '- Legacy revision tickets, voice-audit records, and book strategies without Phase 5 fields remain readable; recurrence and learning fields are optional until used.\n'
    '- New books begin with an empty revision-learning guardrail list. No existing ticket, audit, approval, or manuscript is backfilled or rewritten.\n',
)
insert_after(
    'CHANGELOG.md',
    '- Raw review observations, raw influence references, unapproved guardrails, and unrelated research claims never enter drafting context.\n',
    '- Voice metrics never create automatic severity, prose quotas, or revision tickets by themselves.\n'
    '- Promotion eligibility never activates a rule; only a writer-approved guardrail enters future drafting context.\n'
    '- Audit and promotion workflows never rewrite earlier manuscript prose automatically.\n',
)

readme_section = '''## Voice, scene, and revision-learning audits

Novel Forge treats audits as evidence rather than scoring machinery. When an accepted voice baseline contains both a content hash and baseline metrics, the guarded workflow records deterministic voice evidence after Chapter 1, Chapter 3, act reviews, manuscript review, and explicit recalibration. Missing baseline evidence simply skips the audit; it never blocks drafting.

Voice evidence includes sentence and paragraph distributions, dialogue ratio, fragment and rhetorical-question frequency, filter-word rate, repeated body-language vocabulary, and interiority rate. The stored audit records current signals, baseline metrics, numeric deltas, POV and chapter scope when available, protected intentional exceptions, and an evidence-only assessment. These values are not prose quotas and do not create severity or revision tickets by themselves. A read-only diagnostic is also available:

```bash
npm run audit:voice -- /path/to/novel-project
```

The scene audit uses existing chapter packets and plot-grid state changes. It flags:

- more than two consecutive chapters with the same scene engine;
- one engine occupying more than half of a plan with at least six packets;
- interview, conversation, dialogue, meeting, debrief, or questioning scenes that do not change case, relationship, power, or knowledge state;
- adjacent chapters with indistinguishable normalized state changes.

Deterministic scene findings become revision tickets; they never edit manuscript prose. Tickets may carry a stable recurrence pattern and milestone-review identifier. A pattern becomes eligible for a reusable learning rule only after **three distinct chapters** or **two distinct milestone reviews**. Eligibility is not approval. The writer must explicitly approve the rule in `book-strategy.yaml`, and only approved rules enter future chapter context. Promotion never launches a retroactive rewrite of earlier chapters.

'''
insert_before('README.md', '## Graph-aware continuity context\n', readme_section)

skill_section = '''## Voice, scene, and revision learning

Treat voice metrics as evidence, never as prose quotas or automatic severity. When approved baseline hash and metrics exist, append deterministic voice-audit evidence after Chapter 1, Chapter 3, act review, manuscript review, and explicit recalibration. Missing baseline evidence is non-blocking. Preserve explicit intentional exceptions rather than forcing every chapter toward the same metric profile.

Voice audits may record sentence and paragraph distributions, dialogue ratio, fragment frequency, rhetorical questions, filter-word rate, repeated body-language vocabulary, interiority, baseline values, deltas, POV, chapter scope, and protected exceptions. Do not convert metric deltas directly into revision tickets.

Run the deterministic scene audit during review. Flag more than two consecutive identical scene engines, engine dominance only when at least six packets exist and one engine exceeds half, conversational engines without case/relationship/power/knowledge movement, and adjacent indistinguishable state changes. Convert findings to revision tickets through the guarded review event; never edit prose automatically.

Use stable recurrence pattern IDs only for genuinely repeated problems. A pattern is promotion-eligible after three distinct chapters or two distinct milestone reviews. Eligibility never activates a rule. Store proposed, approved, or rejected learning rules in `book-strategy.yaml`; validate approved rules against the exact supporting ticket IDs, distinct chapters, and milestone reviews. Only writer-approved rules enter future drafting context, and promotion must not trigger a retroactive rewrite.

The read-only `npm run audit:voice -- <project-root>` command may print diagnostics but must not mutate project state or replace guarded workflow events.

'''
insert_before('SKILL.md', '## Temporary browser wizard\n', skill_section)

insert_after(
    'RELEASE.md',
    '- [ ] Guardrail promotion requires writer approval and does not retroactively rewrite unrelated prose.\n',
    '- [ ] Chapter 1 and Chapter 3 create voice-audit evidence only when accepted baseline hash and metrics exist.\n'
    '- [ ] Missing baseline evidence skips voice auditing without blocking drafting.\n'
    '- [ ] Act and manuscript reviews append deterministic voice evidence without assigning automatic ticket severity.\n'
    '- [ ] Intentional voice exceptions remain recorded and protected.\n'
    '- [ ] Three distinct chapters or two distinct milestone reviews are the exact learning thresholds.\n'
    '- [ ] Duplicate tickets within one chapter count as one chapter occurrence.\n'
    '- [ ] Proposed and rejected learning rules never enter drafting context.\n'
    '- [ ] Approved learning rules match the exact ticket, chapter, and milestone evidence.\n'
    '- [ ] Audit and promotion paths do not modify existing manuscript files.\n',
)
insert_after(
    'RELEASE.md',
    '- [ ] `npm run eval` passes.\n',
    '- [ ] `npm run audit:voice -- <fixture-root>` returns deterministic JSON evidence or a clear non-mutating no-baseline result.\n',
)

(root / 'docs/novel-forge-phase5-audits-and-learning.md').write_text('''# Novel Forge Phase 5 — Audits and Revision Learning

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
''', encoding='utf-8')

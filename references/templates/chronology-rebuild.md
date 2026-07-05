# Chronology Rebuild

## Purpose

A per-scene timeline grid that catches the class of errors a reviewer can spot instantly (a child who is eleven, then thirteen, then twelve; a birth scene that lands after the dove and covering-off material it should precede). Build this in Phase 2 (Architecture) and verify it against `continuity-ledger.md` and the `continuity-scan` script in Phase 4.

## Per-scene chronology grid

| # | chapter / scene | day / week | elapsed time | weather / flood stage | ark / camp status | family location | POV character | who is alive / aboard | what has been decided | notes |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Columns to keep current:
- **day / week**: in-story clock anchor (e.g., "Day 1 of rain", "Week 14 of build", "Forty-day mark").
- **elapsed time**: cumulative time since the inciting commission, for cross-checking ages and durations.
- **weather / flood stage**: build season, drought, first rain, forty days, recession, grounding, covering off, dry land.
- **ark / camp status**: foundation laid, planking, pitch, roofed, provisioned, sealed, floating, grounded.
- **family location**: home, yard, camp, ramp, aboard, on land.
- **POV character**: who owns the interiority in this scene (see `point-of-view-ethics-audit.md`).
- **who is alive / aboard**: lock this against `continuity-ledger.md`. Deaths, births, and boarding events must be consistent in both directions.
- **what has been decided**: cumulative law / rule / count decisions — these become the moral spine of the book.

## Character age and duration track

For each character whose age or a multi-year arc is plot-relevant, lock the age at first appearance and verify every later mention.

| character | age at first appearance | age at climax | age at denouement | in-story time elapsed | continuity notes |
| --- | --- | --- | --- | --- | --- |

Rules:
- a character whose age changes by more than the elapsed in-story time is a continuity error. Fix the manuscript or fix the ledger — never both silently.
- births and deaths change who is alive / aboard. Update the grid and `continuity-ledger.md` in the same pass.
- if the chronology is intentionally non-linear, add framing (a date stamp, a POV marker, a section break) so the reader reads disorder as design, not drift.

## Out-of-order flags

List scenes whose current placement conflicts with the timeline grid.

| scene | currently placed | should occur | reason | repair |
| --- | --- | --- | --- | --- |

Repair values: **move** (relocate in chapter order), **reframe** (add in-scene time stamp to justify non-linearity), **rewrite** (adjust internal time references to match placement), **hold** (accepted risk).

## Verification

- [ ] every locked numerical fact in `continuity-ledger.md` matches the age / duration track above
- [ ] `npm run audit:continuity -- <project>` reports no `likely-continuity-error` findings
- [ ] bird sequence (raven → dove → olive leaf → no return) is in canonical order
- [ ] birth and quarantine scenes land in the rain-period block, not after the covering-off
- [ ] antagonist's last confirmed status is unambiguous before the climax

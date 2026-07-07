---
name: thriller-forge-for-pi
description: "Use for commercial thriller series planning, drafting, auditing, series continuity, and packaging."
---

# Thriller Forge for Pi

Thriller Forge for Pi is a narrow production contract for Pi agents working on commercial thriller series. It replaces the universal Book Genesis scope with one purpose: produce suspense-driven series books with strong hooks, clean continuity, controlled reveals, and commercial read-through.

## Scope

Use this skill for thriller series only. Do not use it for memoir, nonfiction, study guides, certification prep, sacred retellings, or generic book coaching.

## Approved files

Series root:

```text
SERIES_STATE.yaml
STATUS.md
series/series-bible.md
series/series-arc.md
series/cast-and-pressure-map.md
series/reveal-ledger.md
series/continuity-ledger.md
series/market-package.md
```

Per book:

```text
books/book-NN/BOOK_STATE.yaml
books/book-NN/book-bible.md
books/book-NN/plot-ladder.md
books/book-NN/threat-clock.md
books/book-NN/chapter-queue.md
books/book-NN/manuscript/chapters/
books/book-NN/audits/act-1-audit.md
books/book-NN/audits/midpoint-audit.md
books/book-NN/audits/final-act-audit.md
books/book-NN/audits/manuscript-audit.md
books/book-NN/audits/style-audit.md
books/book-NN/revision-tickets.md
books/book-NN/package.md
```

Do not create extra artifacts by default.

## Operating loop

1. Plan the series.
2. Plan the active book.
3. Build chapter packets.
4. Draft one chapter at a time.
5. After each chapter, update only reveal, continuity, chapter queue, and revision tickets.
6. Run larger audits only at act breaks, midpoint, pre-final-act, full manuscript, and series review.
7. Convert every audit problem into a concrete revision ticket.
8. Package only after blocker tickets are closed, deferred with rationale, or accepted as deliberate risk.

## Chapter standard

Each chapter must move threat, clue, false explanation, red herring, protagonist choice, relationship pressure, evidence, public cost, reader forecast, or ending hook. A chapter that only explains or repeats known information should be cut, merged, or rebuilt.

## Token policy

For chapter drafting, read only the series bible, reveal ledger, continuity ledger, book bible, plot ladder, threat clock, chapter queue, and previous chapter when needed.

For chapter updates, read only the new chapter, chapter packet, reveal ledger, continuity ledger, chapter queue, and revision tickets.

## Commands

```text
/thriller-start
/thriller-status
/thriller-series-plan
/thriller-book-plan
/thriller-chapter-queue
/thriller-draft-chapter
/thriller-update-chapter
/thriller-act-audit
/thriller-manuscript-audit
/thriller-series-audit
/thriller-package
```

## Deterministic scanners

Use scanner output before expensive audit passes:

```bash
npm run audit:ngrams -- <project>
npm run audit:rhetoric -- <project>
npm run audit:continuity -- <project>
npm run audit:structure -- <project>
npm run audit:spelling -- <project>
npm run audit:temporal -- <project>
npm run audit:mechanics -- <project>
```

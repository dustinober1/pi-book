# Thriller Forge for Pi

> Private Pi package for commercial thriller series production.

Thriller Forge for Pi is a narrow, series-first writing workflow for Pi coding agents. It replaces the broad Book Genesis operating system with one focused job: plan, draft, audit, revise, and package commercial thriller series.

It is intentionally not a universal book pipeline. It does not optimize for memoir, nonfiction, certification prep, sacred retellings, or general writing coaching. The product is built for thriller series where suspense, threat escalation, reveal control, continuity, and reader read-through matter more than maintaining dozens of generic artifacts.

## Core promise

Use Thriller Forge when you want to produce a thriller series with:

- a strong commercial hook
- a visible threat clock
- chapter-level suspense movement
- clean clues, red herrings, reveals, and twists
- protagonist agency instead of passive auditing or explaining
- recurring characters with pressure, secrets, leverage, and costly choices
- continuity across books
- endings that close one battle while making readers want the next book
- prose that avoids generic AI-smooth rhythm without chasing AI-detector games

## Install in Pi

From git:

```bash
pi install git:github.com/dustinober1/pi-book@main
```

From a local checkout:

```bash
pi install /path/to/pi-book
```

## Skill command

```text
/skill:thriller-forge-for-pi
```

You can also ask naturally:

```text
Start a Thriller Forge series project from this idea.
Continue the current thriller book.
Run the next thriller audit.
```

## Pi extension commands

| command | use it for |
| --- | --- |
| `/thriller-start` | create a new thriller series workspace with Book 1 scaffolded |
| `/thriller-status` | update and show series/book status |
| `/thriller-series-plan` | develop or repair the series premise, cast pressure, reveal ladder, and read-through engine |
| `/thriller-book-plan` | build or repair one book's thriller architecture |
| `/thriller-chapter-queue` | create draftable chapter packets |
| `/thriller-draft-chapter` | draft the next chapter from its packet |
| `/thriller-update-chapter` | update only the lean post-chapter ledgers |
| `/thriller-act-audit` | audit an act break, midpoint, or pre-final-act section |
| `/thriller-manuscript-audit` | run the full thriller manuscript audit |
| `/thriller-series-audit` | check cross-book continuity, escalation, reveals, and read-through |
| `/thriller-package` | prepare title/blurb/cover/metadata/series-hook packaging |

## Approved artifact set

Series-level files:

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

Book-level files:

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

Do not create extra artifacts unless the writer explicitly asks for them or a thriller-specific failure requires one.

## Token discipline

During chapter drafting, read only:

```text
series/series-bible.md
series/reveal-ledger.md
series/continuity-ledger.md
books/book-NN/book-bible.md
books/book-NN/plot-ladder.md
books/book-NN/threat-clock.md
books/book-NN/chapter-queue.md
the previous chapter, when needed
```

After each chapter, update only:

```text
series/reveal-ledger.md
series/continuity-ledger.md
books/book-NN/chapter-queue.md
books/book-NN/revision-tickets.md
```

Run heavier audits at act breaks, midpoint, pre-final-act, and full manuscript review. Do not run the whole audit stack after every chapter.

## Thriller quality checks

The engine prioritizes:

- opening disturbance
- threat visibility
- external clock
- protagonist agency
- scene-engine variety
- clue/reveal/red-herring control
- midpoint reversal
- false solution
- final confrontation clarity
- irreversible aftermath
- book-to-book escalation
- series read-through hook

Fast-fail triggers:

- the middle repeats discovery/call/dashboard/explanation scenes
- the protagonist withholds information more than twice without a major consequence
- important beats happen only on screens
- the opposition is wrong about everything
- major characters sound interchangeable under pressure
- the climax depends on a mechanism the reader cannot track
- the ending is thematically neat but commercially soft
- continuity on names, terms, injuries, permissions, dates, or clues is drifting

## Deterministic scanners

Keep these because they save tokens and catch repeatable issues before an LLM audit:

```bash
npm run audit:ngrams -- /path/to/project
npm run audit:rhetoric -- /path/to/project
npm run audit:continuity -- /path/to/project
npm run audit:structure -- /path/to/project
npm run audit:spelling -- /path/to/project
npm run audit:temporal -- /path/to/project
npm run audit:mechanics -- /path/to/project
```

Use scanner output as evidence for revision tickets. The scanners are diagnostics, not final editorial judgment.

## Recommended workflow

```text
/thriller-start
/thriller-series-plan
/thriller-book-plan
/thriller-chapter-queue
/thriller-draft-chapter
/thriller-update-chapter
```

Repeat chapter drafting/update until an act break, then run:

```text
/thriller-act-audit
```

Before publication packaging:

```text
/thriller-manuscript-audit
/thriller-series-audit
/thriller-package
```

## Design rule

Thriller Forge protects quality by tracking only what thriller series need: threat, suspense, reveals, pressure, agency, continuity, prose fatigue, and series escalation.

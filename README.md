# Novel Forge for Pi

Novel Forge is a compact, series-capable production workflow for high-quality novels. Version 1 supports two profiles:

- **Thriller** — threat, evidence, reveals, agency, procedural plausibility, and escalation.
- **Romantasy** — romance/fantasy balance, chemistry, trust, consent, power, magic cost, and emotional payoff.

Novel Forge optimizes for reader trust and author-specific voice. It does not chase AI-detector scores or disguise provenance through cosmetic word replacement.

## Install

```bash
pi install git:github.com/dustinober1/pi-book@novel-forge-v1
```

## Commands

| Command | Purpose |
| --- | --- |
| `/novel-start` | Create a standalone or series-capable project |
| `/novel-status` | Show gates, blockers, manuscript progress, and the next safe action |
| `/novel-plan` | Build or repair voice, series, and active-book plans |
| `/novel-run` | Advance safe work until a gate, blocker, or requested limit |
| `/novel-draft` | Draft the next approved chapter packet |
| `/novel-review` | Review a chapter, act, manuscript, or series |
| `/novel-revise` | Apply open revision tickets with protected constraints |
| `/novel-package` | Compile the manuscript and prepare an editorial package |

Administrative migration command:

```text
/novel-migrate
```

## Typical workflow

```text
/novel-start
/novel-plan voice
/novel-run --approve voice-approval
/novel-plan book
/novel-run --approve book-plan-approval
/novel-run --until first-chapter-gate
/novel-run --approve first-chapter-approval
/novel-run --until act-1-review
/novel-review act
/novel-revise
```

## Compact project model

```text
PROJECT.yaml
STATUS.md
series/
  series-bible.md
  voice-profile.md
  series-arc.yaml
  canon.yaml
  story-threads.yaml
books/book-01/
  BOOK.yaml
  book-bible.md
  genre.yaml
  plot-grid.yaml
  chapter-queue.yaml
  continuity-delta.yaml
  revision-tickets.yaml
  review-report.md
  package.md
  manuscript/chapters/
research/
  source-register.yaml
  notes/
```

A standalone is a one-book project, not a different file format. It can become a series without migration.

## Automation boundaries

`/novel-run` automates repeatable production work, but stops for:

- voice approval;
- book-plan approval;
- first-chapter approval;
- act and midpoint review gates;
- unresolved blocker tickets;
- canon or reveal-order conflicts;
- missing plot-critical research;
- final manuscript and package approval.

Use `--approve <gate>` to record an explicit approval, and `--until <gate>` or `--max-chapters <n>` to bound automation.

## Quality model

Novel Forge keeps five durable concepts at the center:

1. voice;
2. canon;
3. story threads;
4. plot grid;
5. revision tickets.

The two profiles add genre-specific rules without adding new workflows or command families.

## Deterministic audits

```bash
npm run audit:ngrams -- /path/to/project
npm run audit:rhetoric -- /path/to/project
npm run audit:continuity -- /path/to/project
npm run audit:structure -- /path/to/project
npm run audit:spelling -- /path/to/project
npm run audit:temporal -- /path/to/project
npm run audit:mechanics -- /path/to/project
```

Scanner findings are evidence for review tickets, not automatic literary verdicts.

## Legacy Genesis projects

Run `/novel-migrate thriller` or `/novel-migrate romantasy` from an existing Genesis project. Migration:

- preserves the manuscript;
- copies legacy control files under `legacy/genesis-v0.4/`;
- consolidates voice material;
- maps series facts, outlines, and open findings into the compact model;
- writes `MIGRATION_REPORT.md`.

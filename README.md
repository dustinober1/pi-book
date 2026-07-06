# Genesis for Pi

> Private repository/package: intended for private use unless you explicitly choose to publish it.

Genesis for Pi is the Pi-native packaging of Book Genesis Universal Core.

It can be used for novels, memoir, narrative nonfiction, prescriptive nonfiction, study guides, certification-prep books, installments within a larger series, and published-series verification/repair where earlier books are locked canon.

For AI thrillers and other system-driven fiction, the package now also includes:
- a reusable QA pass in `docs/ai-thriller-qa-checklist.md`
- a reusable developmental review prompt in `docs/ai-thriller-review-prompt.md`
- stronger built-in safeguards for publication shape, external clocks, midpoint turns, plain-language system models, scene-engine variety, embodied consequence, protagonist agency, and repeated rhetorical patterns
- final-package cover support, including a paste-ready ebook cover generation prompt targeting 1600 x 2560 px KDP-friendly artwork
- mode-specific biblical fiction / sacred retelling support that tracks scripture sources, passage scene packets, invention boundaries, translation sensitivity, tradition lane, theological risk, sacred-figure handling, ancient-world plausibility, anachronism/modernity, faith-reader personas, miracle/supernatural portrayal, character humility, sacred residue, POV ethics, and Author's Note disclosure without burdening unrelated genres
- commercial proof and reader-conversion artifacts for target-reader validation, category competition, title/blurb/cover/sample testing, launch channels, review risks, and outside-reader signal
- an AI-use and publishing-compliance ledger for KDP/client/platform disclosure decisions, plus independent-review and claim-risk ledgers for high-stakes projects
- lean modes (`lean-novel`, `lean-nonfiction`, `market-test`) to reduce artifact gravity when a project needs validation or a lighter editorial path

This package is extension-first: it exposes Pi commands, blocker-triage UI/tooling, and the primary `genesis-for-pi` skill for durable intake, foundation, architecture, drafting, adversarial audit, Genesis Score, reader conversion scoring, commercial proof, and editorial package generation.

## Install in Pi

From this local folder:

```bash
pi install /Users/dustinober/.codex/skills/genesis-for-pi
```

For one-off use without installing:

```bash
pi -e /Users/dustinober/.codex/skills/genesis-for-pi
```

From git:

```bash
pi install git:github.com/dustinober1/pi-book@main
```

## Use

Genesis for Pi can be used in two ways:

1. **Extension-first** — recommended for normal use in Pi
2. **Skill-first** — useful when you want to explicitly load the workflow contract

### Skill commands

Primary skill:

```text
/skill:genesis-for-pi
```

You can also ask naturally, for example:

```text
Start a Genesis for Pi book project from this idea.
Continue my Genesis project.
Run the next Genesis phase.
```

### Pi extension commands

#### Quick command guide

| command | use it for |
| --- | --- |
| `/genesis-start` | one-command bootstrap |
| `/genesis-prd-start` | PRD-first bootstrap with completeness score, traceability, and gap-only intake |
| `/genesis-prd-ingest` | import or refresh a PRD inside an existing project |
| `/genesis-cockpit` | one-page writer dashboard for gates, blockers, decisions, and next actions |
| `/genesis-autopilot` | bounded writer-gated automation step |
| `/genesis-chapter-queue` | build draftable chapter packets from approved architecture |
| `/genesis-post-chapter-update` | synchronize continuity, promises, scorecards, and queue status after drafting |
| `/genesis-taste-lock` | protect author taste, risk, voice, and non-negotiables |
| `/genesis-prd-diff` | compare a revised PRD against the accepted PRD and report decision impact |
| `/genesis-questions` | generate only the writer decisions needed before safe automation |
| `/genesis-outline-stress-test` | stress-test outline architecture before drafting |
| `/genesis-review-personas` | generate or refresh the reader/reviewer persona panel |
| `/genesis-persona-review` | run outline/chapter/manuscript review through the persona panel |
| `/genesis-regression-check` | check whether revisions broke approved promises, continuity, voice, gates, or tickets |
| `/genesis-series-start` | whole-series workspace bootstrap |
| `/genesis-series-open` | pick an existing series workspace |
| `/genesis-series-status` | cross-book series dashboard |
| `/genesis-series-next` | next safe series/book step |
| `/genesis-series-add-book` | append another installment project |
| `/genesis-series-blockers` | series-level blocker triage |
| `/genesis-series-verify` | cross-book continuity and promise verification |
| `/genesis-series-regression-check` | cross-book regression gate after revisions, rewrites, or lock changes |
| `/genesis-series-score` | whole-series quality score |
| `/genesis-series-export` | whole-series editorial/export package |
| `/genesis-series-lock-book` | lock a completed installment into series canon |
| `/genesis-init` | manual project creation |
| `/genesis-open` | pick an existing project |
| `/genesis-status` | current dashboard |
| `/genesis-plan` | dry-run next step |
| `/genesis-resume` | smart resume summary |
| `/genesis-doctor` | install/project health checks |
| `/genesis-lint` | placeholder/quality lint |
| `/genesis-dashboard` | richer project dashboard |
| `/genesis-compile` | compile chapter files into a full manuscript |
| `/genesis-export` | create editorial/beta handoff files |
| `/genesis-checkpoint` | commit Genesis files one file at a time |
| `/genesis-ingest` | ingest existing drafts, notes, research, or canon |
| `/genesis-voice-ingest` | build voice artifacts from author samples |
| `/genesis-voice-drift` | audit manuscript voice drift |
| `/genesis-next` | advance the workflow |
| `/genesis-validate` | phase-contract validation |
| `/genesis-migrate` | repair older project trees |
| `/genesis-set-mode` | set workflow mode + scaffold bundle |
| `/genesis-blockers` | inspect blockers interactively |
| `/genesis-scaffold-templates` | copy starter artifacts |
| `/genesis-score-to-tickets` | turn score findings into tickets |
| `/genesis-ai-thriller-review` | publication-facing developmental review for AI/system thrillers |
| `/genesis-ai-thriller-fix` | prioritized repair pass for AI/system thrillers |
| `/genesis-audit-fluff` | anti-padding audit |

This package provides Pi-native extension commands:

```text
/genesis-start
/genesis-prd-start
/genesis-prd-ingest
/genesis-cockpit
/genesis-autopilot
/genesis-chapter-queue
/genesis-post-chapter-update
/genesis-taste-lock
/genesis-prd-diff
/genesis-questions
/genesis-outline-stress-test
/genesis-review-personas
/genesis-persona-review
/genesis-regression-check
/genesis-series-start
/genesis-series-open
/genesis-series-status
/genesis-series-next
/genesis-series-add-book
/genesis-series-blockers
/genesis-series-verify
/genesis-series-regression-check
/genesis-series-score
/genesis-series-export
/genesis-series-lock-book
/genesis-init
/genesis-open
/genesis-status
/genesis-plan
/genesis-resume
/genesis-doctor
/genesis-lint
/genesis-dashboard
/genesis-compile
/genesis-export
/genesis-checkpoint
/genesis-ingest
/genesis-voice-ingest
/genesis-voice-drift
/genesis-next
/genesis-validate
/genesis-migrate
/genesis-set-mode
/genesis-blockers
/genesis-scaffold-templates
/genesis-score-to-tickets
/genesis-ai-thriller-review
/genesis-ai-thriller-fix
/genesis-audit-fluff
```

Use `/genesis-start` to create a fresh Genesis project, choose the workflow mode, scaffold the recommended mode bundle, initialize git, and kick off intake in one step.

Use `/genesis-prd-start <path-to-prd>` to create a PRD-first Genesis project. It imports the PRD into `research/notes/source-prd.md`, scores PRD completeness, writes `prd-gap-report.md`, `prd-traceability-map.md`, `writer-questions.md`, `quality-gates.md`, `taste-lock.md`, `decision-ledger.md`, `chapter-production-queue.md`, and `writer-cockpit.md`, then queues a gap-only intake pass that maps only PRD-supported decisions into Genesis artifacts.

Use `/genesis-prd-ingest <path-to-prd>` to import or refresh a PRD inside the current Genesis project without restarting.

Use `/genesis-cockpit` to update `artifacts/writer-cockpit.md`, a one-page writer dashboard showing gate status, blockers, PRD readiness, next decisions, and what automation is currently allowed to do.

Use `/genesis-autopilot <target>` for gated automation such as `foundation`, `architecture`, `chapter-queue`, `one chapter packet`, `one chapter draft`, or `post-chapter-update`. It refuses to run when hard blockers or quality gates are active.

Use `/genesis-chapter-queue` to convert an approved outline into draftable chapter packets with goals, scene-engine contrast, causality, promises, continuity constraints, protagonist/secondary-character agency, technical/plain-language load, taste-lock notes, human-specificity seeds, rhetorical-shape watch, forbidden filler, and post-draft ledger tasks.

Use `/genesis-post-chapter-update` after drafting to update continuity, reader promises, causality, scene embodiment, human-specificity, scorecards, revision tickets, the chapter queue, and the writer cockpit.

Use `/genesis-taste-lock` to protect the author's voice, taste, intentional risk, weirdness, roughness, and automation boundaries in durable artifacts.

Use `/genesis-prd-diff <path-to-revised-prd>` when the PRD changes. It writes `artifacts/prd-change-log.md`, `artifacts/decision-impact-report.md`, and `research/notes/source-prd-candidate.md`, then queues a semantic impact review without replacing the accepted PRD unless you approve it.

Use `/genesis-questions` to generate `artifacts/writer-questions.md`, grouped into must-answer, approval-needed, can-defer, and wrong-reader/noise categories. It should ask only decisions the writer must make, not maintenance the agent can do.

Use `/genesis-outline-stress-test` before drafting to write `evaluations/outline-stress-test.md` and pressure-test middle movement, reversals, causality, subplot/argument integration, reader promises, climax, ending shape, and padding risk.

Use `/genesis-review-personas` to generate or refresh `artifacts/review-personas.md` as a 4-7 persona reader/reviewer panel grounded in the PRD, promise, taste, risk budget, comps, and market.

Use `/genesis-persona-review <outline|chapter|manuscript>` to write `evaluations/persona-review.md`, separating ideal-reader signal, genre-native concerns, voice-sensitive craft feedback, skeptical-reader objections, and wrong-reader noise.

Use `/genesis-regression-check` after revision or PRD changes to write `evaluations/regression-check.md` and check whether the project broke PRD-backed decisions, reader promises, publication shape, continuity, voice/taste lock, causality, resolved tickets, expansion integrity, or persona-panel signal.

Use `/genesis-series-start` to create a whole-series workspace with shared series artifacts plus one Genesis project per planned book under `books/book-01`, `books/book-02`, and so on.

Use `/genesis-series-open` to pick an existing series workspace, then show status, advance next, verify, inspect blockers, or export.

Use `/genesis-series-status` to render `SERIES_STATUS.md` with series artifact health and per-book phase, manuscript, and blocker summaries.

Use `/genesis-series-next` to advance the next safest series-level or book-level step without trying to draft the whole series at once.

Use `/genesis-series-add-book` when the planned series grows and you need the next `books/book-NN` project scaffolded without restarting.

Use `/genesis-series-blockers` to inspect missing shared artifacts, placeholder-heavy series files, book-level hard blockers, and likely predecessor-lock issues.

Use `/genesis-series-verify` to audit books against shared canon, promises, escalation, and continuity.

Use `/genesis-series-regression-check` after revisions, rewrites, or lock decisions to check whether canon, timeline, reveal order, handoff packets, character states, or escalation logic broke across books.

Use `/genesis-series-score` to queue a whole-series score covering canon stability, escalation, payoff integrity, repetition risk, onboarding clarity, and commercial cohesion.

Use `/genesis-series-export` to create a whole-series manuscript bundle, series-bible export, status report, editorial handoff, and export manifest.

Use `/genesis-series-lock-book` to extract a completed installment into locked series canon before later books rely on it.

Use `/genesis-init` to create a fresh Genesis project tree, initialize git when needed, scaffold research folders, and optionally kick off Phase 0 intake.

Use `/genesis-open` to pick an existing Genesis project under the current working directory, then inspect it or continue it.

Use `/genesis-status` to inspect the current Genesis project root, detected phase, phase-aware missing expected files, git state, and potential blocker files.

Use `/genesis-plan` for a dry-run summary of what Genesis would do next before any agent turn is queued.

Use `/genesis-resume` to see where a project stalled, the most recently touched files, and the best next command.

Use `/genesis-doctor` for package-health, project-health, git, blocker, directory, and lint checks.

Use `/genesis-lint` to flag placeholder-heavy artifacts, empty sections, and weak scaffolds that file-existence checks miss.

Use `/genesis-dashboard` for a richer progress dashboard with phase progress, blocker counts, manuscript stats, recent files, git state, and next best action. It writes the dashboard to `STATUS.md`.

Use `/genesis-compile` to concatenate `manuscript/chapters/*.md` into `delivery/manuscript-full.md` and write `delivery/manuscript-compile-report.md` with chapter and word-count diagnostics.

Use `/genesis-export` to create delivery handoff files: compiled manuscript, compile report, editorial handoff, revision board, beta-reader packet, cover prompt handoff when available, and export manifest.

Use `/genesis-checkpoint` to commit changed Genesis project files one file at a time. Pass a relative path to commit only one file, or use no argument/`all` for all changed Genesis files.

Use `/genesis-ingest` to queue an agent pass that converts existing manuscripts, notes, research, or canon material into durable Genesis artifacts without restarting the project.

Use `/genesis-voice-ingest` to queue a voice-sample ingestion pass that updates `author-voice-fingerprint.md`, `voice-bible.md`, and related voice-protection artifacts.

Use `/genesis-voice-drift` to queue an audit comparing manuscript chapters against the author voice fingerprint and voice bible.

Use `/genesis-next` to clear blockers when possible, then advance the current Genesis project to the next incomplete pipeline step. It bypasses optional approval pauses for that turn, but it does not bypass hard blockers such as active drift alarms, open blocker/high revision tickets, unresolved AI-tell or author-voice blockers, missing required phase outputs, phase contract mismatches, or missing git initialization.

Use `/genesis-validate` to run a stricter phase-contract check for the current project before advancing. It also checks mode-specific artifacts and artifact-quality lint findings.

Use `/genesis-migrate` to repair or upgrade partial/older Genesis project trees to the current layout.

Use `/genesis-set-mode` to explicitly set the workflow mode, update `PROJECT_STATE.yaml`, `ASSUMPTIONS.md`, and `artifacts/00-brief.md`, and offer mode-specific scaffold files when templates exist. Supported modes include the full modes plus lean modes such as `lean-novel`, `lean-nonfiction`, and `market-test`.

Use `/genesis-blockers` for interactive blocker triage. It lets you inspect blocker evidence and queue a targeted fix turn from the UI.

Use `/genesis-scaffold-templates` to copy core artifact templates such as `book-prd.md`, `prd-gap-report.md`, `prd-traceability-map.md`, `prd-completeness-score.md`, `prd-change-log.md`, `decision-impact-report.md`, `writer-questions.md`, `quality-gates.md`, `writer-cockpit.md`, `chapter-production-queue.md`, `outline-stress-test.md`, `persona-review.md`, `regression-check.md`, `taste-lock.md`, `decision-ledger.md`, `voice-bible.md`, `continuity-ledger.md`, `revision-tickets.md`, `expansion-integrity.md`, `commercial-proof.md`, `category-competition-map.md`, `title-subtitle-options.md`, `blurb-test-results.md`, `cover-conversion-notes.md`, `sample-reader-feedback.md`, `launch-channel-plan.md`, `review-risk-log.md`, `ai-use-and-publishing-compliance.md`, `independent-review-matrix.md`, `claim-risk-ledger.md`, `series-bible.md`, `series-arc-map.md`, `canon-lock.md`, `installment-promise-tracker.md`, `series-payoff-ledger.md`, `series-verification-matrix.md`, `argument-spine.md`, `certification-blueprint-map.md`, `research/reference-inventory.md`, `author-intent.md`, `taste-profile.md`, `risk-budget.md`, `review-personas.md`, `reader-promise-tracker.md`, and `drift-loop-alarm.md` into the active project.

Use `/genesis-score-to-tickets` to convert score and audit findings into structured revision tickets.

Use `/genesis-ai-thriller-review` to run a reusable publication-facing developmental review for AI thrillers, system thrillers, and near-future governance/automation novels. It uses `docs/ai-thriller-review-prompt.md` and `docs/ai-thriller-qa-checklist.md`, and writes the review to `artifacts/ai-thriller-review.md`.

Use `/genesis-ai-thriller-fix` to run a prioritized repair pass after that review. It targets the highest-leverage issues first: middle-act stall, reveal fatigue, embodied consequence, system/authority clarity, character agency, opposition strength, ending shape, and continuity.

Use `/genesis-audit-fluff` to run a focused anti-padding audit when a draft feels thin, repetitive, or suspiciously long for how little it changes.

You can append instructions:

```text
/genesis-next main checkpoints only
```

Fallback prompt templates are also available as:

```text
/genesis-next-prompt
```

## Recommended workflow

### PRD-first happy path

If you normally write a full PRD before drafting, use this sequence:

```text
/genesis-prd-start my-book-prd.md
/genesis-questions
/genesis-review-personas
/genesis-outline-stress-test
/genesis-chapter-queue
/genesis-autopilot one chapter draft
/genesis-post-chapter-update
/genesis-persona-review chapter-01
/genesis-regression-check
```

Use `/genesis-prd-diff revised-prd.md` whenever the PRD changes. Genesis will report decision impact before replacing the accepted PRD.

### 1. Fast bootstrap

From the directory where you want the project folder to be created:

```text
/genesis-start
```

What happens:

- you are prompted for a project name
- you choose a workflow mode
- a project tree is created
- the recommended mode bundle is scaffolded when templates exist
- git is initialized when possible
- intake can begin immediately

### 1b. Whole-series bootstrap

From the directory where you want the series folder to be created:

```text
/genesis-series-start
```

What happens:

- you are prompted for a series name, planned book count, and series premise
- a series root is created with `SERIES_STATE.yaml`, `SERIES_STATUS.md`, and shared series artifacts
- per-book Genesis projects are created under `books/book-01`, `books/book-02`, etc.
- each book project is initialized as `series installment` mode
- shared artifacts track the whole-series promise, book ladder, locked canon, installment obligations, cross-book continuity, timeline anchors, character states, reveal order, retcons, repetition risk, and verification state

Use these commands after setup:

```text
/genesis-series-open
/genesis-series-status
/genesis-series-next
/genesis-series-add-book
/genesis-series-blockers
/genesis-series-verify
/genesis-series-regression-check
/genesis-series-score
/genesis-series-export
/genesis-series-lock-book books/book-01
```

The intended rhythm is: plan the series, advance one installment at a time, lock finished books into canon, generate handoff packets for the next book, then run series verification/regression checks before final approval.

### 2. Create a new project manually

From the directory where you want the project folder to be created:

```text
/genesis-init
```

What happens:

- you are prompted for a project name
- a new project directory is created
- the standard Genesis folders are created
- starter files such as `PROJECT_STATE.yaml`, `ASSUMPTIONS.md`, and intake artifacts are scaffolded
- research folders such as `research/reference-inventory.md`, `research/notes/`, and `research/sources/` are scaffolded
- `git init` runs automatically if needed
- you can immediately kick off Phase 0 intake

### 3. Open an existing project

If you already have one or more Genesis projects under your current working directory:

```text
/genesis-open
```

This lets you pick a project and then:

- show status
- show a dry-run plan
- inspect blockers
- continue the next step

### 4. Check project status

```text
/genesis-status
```

Use this when you want a quick read on:

- detected current phase
- likely blocker files
- missing expected outputs
- updated `STATUS.md` dashboard for easy resume

### 5. Preview the next step

```text
/genesis-plan
```

Use this when you want a dry-run summary of:

- hard blockers and warnings
- the next expected file for the current phase
- what `/genesis-next` will try to do

### 6. Advance the project

```text
/genesis-next
```

This is the main working command.

What it does:

- reads the current project state
- checks for blockers
- tries to clear blockers first when possible
- advances only the next required pipeline step
- preserves the human-voice rules and artifact contract

Useful examples:

```text
/genesis-next main checkpoints only
/genesis-next do not draft prose yet
/genesis-next careful mode
/genesis-next clear blockers first
```

### 7. Resume an existing project intelligently

```text
/genesis-resume
```

Use this when you want:

- the most recently touched project files
- a summary of where the work stalled
- the best next command

### 8. Run project doctor

```text
/genesis-doctor
```

Use this when you want:

- install-health checks
- missing directory checks
- blocker summary
- artifact-quality lint summary

### 9. Lint artifact quality

```text
/genesis-lint
```

Use this when files exist but may still be half-scaffolded or placeholder-heavy.

### 10. Validate the current phase contract

```text
/genesis-validate
```

Use this when you want to verify:

- detected phase
- required outputs for that phase
- missing outputs
- blocker and warning state
- likely mismatch between `PROJECT_STATE.yaml` and actual files

### 11. Migrate an older or partial project

```text
/genesis-migrate
```

Use this when you want to repair or upgrade a project tree so it matches the current Genesis layout more closely.

### 12. Set the workflow mode

```text
/genesis-set-mode
```

Use this when you want to explicitly mark a project as:

- novel
- memoir
- narrative nonfiction
- prescriptive nonfiction
- study guide
- certification prep
- biblical fiction
- sacred retelling
- series installment
- series repair
- other

When templates are available for the selected mode, Genesis can also scaffold those mode-specific starter files immediately.

### 13. Inspect blockers directly

```text
/genesis-blockers
```

Use this when you want targeted triage before advancing. The command lets you:

- inspect blocker evidence
- see suggested repair actions
- queue a focused blocker-fix turn

### 14. Scaffold core templates

```text
/genesis-scaffold-templates
```

Use this when you want to quickly create or replace structured starter files for:

- `voice-bible.md`
- `continuity-ledger.md`
- `revision-tickets.md`
- `expansion-integrity.md`
- `series-bible.md`
- `series-arc-map.md`
- `series-timeline.md`
- `character-state-matrix.md`
- `reveal-spoiler-matrix.md`
- `canon-lock.md`
- `installment-promise-tracker.md`
- `series-payoff-ledger.md`
- `series-verification-matrix.md`
- `retcon-log.md`
- `series-repetition-radar.md`
- `book-handoff-packet.md`
- `series-regression-check.md`
- `argument-spine.md`
- `certification-blueprint-map.md`
- `study-guide-objectives.md`
- `evidence-map.md`
- `research/reference-inventory.md`

### 15. Convert score findings into tickets

```text
/genesis-score-to-tickets
```

Use this when you want to turn score and audit findings into structured revision tickets.

### 16. Audit fluff directly

```text
/genesis-audit-fluff
```

Use this when you want a focused pass on:

- padding
- ornamental subplots
- repeated introspection
- duplicate exposition
- low-consequence chapter blocks
- scenes that increase length without increasing pressure

### 16a. Run a local n-gram repetition audit

```bash
npm run audit:ngrams -- /path/to/project
node scripts/ngram-audit.mjs manuscript/chapters --min-count 2 --top 15
node scripts/ngram-audit.mjs /path/to/project --write-ear-pass --write-ai-tell
```

Use this when you want a quick repeated-phrase report for bigrams, trigrams, 4-grams, and 5-grams. When you pass a Genesis project root, the script automatically scans `manuscript/chapters/` and reports repeated phrases with counts and file spread. With `--write-ear-pass` and/or `--write-ai-tell`, it also writes a bounded automated n-gram section into `artifacts/ear-pass.md` and `artifacts/ai-tell-mitigation-audit.md`.

### 16b. Run the structure, continuity, rhetoric, spelling, temporal, and mechanics scanners

Six deterministic scanners that catch problems the LLM audits handle inconsistently. Run them before scoring and before any developmental cut pass. **Run `audit:temporal` after every chapter reorder.**

```bash
# Assembly-draft scaffolding (Chapter 2A/2B) + post-climax bloat detection
npm run audit:structure -- /path/to/project

# Locked numerical-fact divergences (ages, counts, dates) vs continuity-ledger.md
npm run audit:continuity -- /path/to/project

# Sentence-shape fatigue: negative parallelism, aphoristic closeouts, triads, "the arithmetic of..."
npm run audit:rhetoric -- /path/to/project

# British/American mixed-system spelling AND stray minority tokens ("pretence" in a US ms)
npm run audit:spelling -- /path/to/project

# Dangling temporal forward-references after a reorder ("tomorrow there would be a law about X")
npm run audit:temporal -- /path/to/project

# Copy mechanics: lowercase sentence starts ("animal water."), doubled words, space-before-punct
npm run audit:mechanics -- /path/to/project
```

`audit:structure` flags A/B/C chapter scaffolding and any chapter that exceeds a configurable share of total length (default 25%), and reports the post-climax tail share. `audit:continuity` reads locked numerical facts from `artifacts/continuity-ledger.md` and flags manuscript mentions whose value diverges. `audit:rhetoric` catches recurring sentence *shapes* rather than verbatim phrases, so it complements `audit:ngrams`. `audit:spelling` flags any word in BOTH British and American forms, plus stray minority-system tokens (a lone "pretence" in an American manuscript) — the failure mode where the partner form never appears. `audit:temporal` surfaces every promise of a future event ("tomorrow", "soon", "when the time came") so they can be reconciled against `chronology-rebuild.md` after a reorder — it cannot tell whether the event already happened, so treat it as a review checklist. `audit:mechanics` catches lowercase sentence starts, accidental doubled words, and space-before-punctuation. Pair all six with the `scene-inventory.md`, `chronology-rebuild.md`, `act-design-audit.md`, and `manuscript-formatting-checklist.md` templates.

### 17. Compile the manuscript

```text
/genesis-compile
```

Concatenates chapter Markdown files under `manuscript/chapters/` into `delivery/manuscript-full.md` and writes a compile report with chapter counts and estimated word count.

### 18. Export editorial handoff files

```text
/genesis-export
```

Creates delivery files for handoff: compiled manuscript, compile report, editorial handoff, revision board, beta-reader packet, cover prompt handoff when available, and export manifest.

### 19. Create git checkpoints

```text
/genesis-checkpoint
/genesis-checkpoint artifacts/voice-bible.md
```

Commits changed Genesis project files one file at a time with normalized messages such as `Genesis: update artifacts/voice-bible.md`.

### 20. Ingest existing material

```text
/genesis-ingest manuscript.md
```

Queues an agent pass to convert existing drafts, notes, research, or canon material into durable Genesis artifacts.

### 21. Ingest author voice samples

```text
/genesis-voice-ingest samples/*.md
```

Queues a voice-ingestion pass that updates `author-voice-fingerprint.md`, `voice-bible.md`, and related protection artifacts.

### 22. Audit voice drift

```text
/genesis-voice-drift
```

Queues an audit comparing current manuscript chapters against the author voice fingerprint and voice bible.

### 23. Show the rich dashboard

```text
/genesis-dashboard
```

Writes a richer progress dashboard to `STATUS.md`: phase progress, blockers, warnings, lint count, manuscript stats, git state, recent files, and next best action.

## Typical ways to work

### Start from scratch

Fast path:

1. `cd` into the parent directory where you want your book project stored
2. run `/genesis-start`
3. choose the workflow mode
4. provide the seed idea
5. let Genesis kick off intake
6. keep using `/genesis-next` as the project advances

Manual path:

1. `cd` into the parent directory where you want your book project stored
2. run `/genesis-init`
3. provide the seed idea
4. optionally run `/genesis-set-mode`
5. allow Genesis to start Phase 0 intake
6. keep using `/genesis-next` until the phase is complete

### Resume existing work

1. `cd` into the directory that contains your Genesis projects
2. run `/genesis-resume`, `/genesis-open`, or `/genesis-status`
3. if health looks suspicious, run `/genesis-doctor`
4. if blockers appear, use `/genesis-blockers`
5. run `/genesis-plan` if you want a dry run
6. run `/genesis-next` to continue safely

### Workflow modes

During intake, Genesis should record a workflow mode such as:

- novel
- memoir
- narrative nonfiction
- prescriptive nonfiction
- study guide
- certification prep
- biblical fiction
- sacred retelling
- series installment
- series repair

This helps the system decide whether to emphasize subplots, argument flow, reference integrity, objective coverage, scripture/source boundaries, passage packets, translation sensitivity, tradition lane, sacred-figure handling, miracle/supernatural portrayal, theological and historical-cultural plausibility, anachronism checks, sacred residue, series continuity, or locked-canon verification and rewrite planning.

### Write a whole series

For a planned multi-book series, use a series root instead of trying to make one giant book project:

```text
/genesis-series-start
```

The series root owns cross-book truth:

- `SERIES_STATE.yaml`
- `SERIES_STATUS.md`
- `artifacts/series-bible.md`
- `artifacts/series-arc-map.md`
- `artifacts/series-timeline.md`
- `artifacts/character-state-matrix.md`
- `artifacts/reveal-spoiler-matrix.md`
- `artifacts/canon-lock.md`
- `artifacts/installment-promise-tracker.md`
- `artifacts/series-payoff-ledger.md`
- `artifacts/series-verification-matrix.md`
- `artifacts/retcon-log.md`
- `artifacts/series-repetition-radar.md`

Each installment is still a normal Genesis project under `books/book-01`, `books/book-02`, and so on. Use `/genesis-series-open` to pick a workspace from a parent directory, or `/genesis-series-next` from anywhere inside the series to choose the next safe series-level or book-level step. Use `/genesis-series-add-book` if the series expands, `/genesis-series-blockers` when cross-book state feels unsafe, `/genesis-series-lock-book` when a book is final enough to become canon, `/genesis-series-verify` before approving later installments, `/genesis-series-regression-check` after revisions or lock changes, `/genesis-series-score` for a whole-series quality read, and `/genesis-series-export` for editorial handoff.

### Offer this as a service

Genesis also supports a **series repair** service model.

Use it when:

- Book 1 or another earlier installment is already published and cannot change
- later books need verification, continuity repair, or full rewrites
- you want a durable canon record before touching later manuscripts

Recommended service flow:

1. ingest the locked book(s)
2. extract canon into `artifacts/series-bible.md` and `artifacts/canon-lock.md`
3. reverse-outline the editable books
4. track inherited obligations in `artifacts/installment-promise-tracker.md`
5. track setup/payoff obligations in `artifacts/series-payoff-ledger.md`
6. compare each later book in `artifacts/series-verification-matrix.md`
7. convert failures into `artifacts/revision-tickets.md`
8. revise or rewrite only the editable installments

This lets you sell verification, continuity cleanup, and rewrite planning without pretending every series starts from scratch.

For a client-facing service outline, see `docs/series-repair-service.md`.

### Force explicit skill usage

If you want the agent to operate with the full workflow contract explicitly loaded first:

1. run `/skill:genesis-for-pi`
2. then ask for the exact phase or task you want
3. or follow with `/genesis-next`

Example:

```text
/skill:genesis-for-pi
Continue this project from the current phase and preserve the author's voice.
```

## Pipeline overview

Genesis for Pi uses this sequence:

1. **Phase 0: Intake**
   - idea capture
   - assumptions
   - brief
   - market map
   - story engine
   - creative sovereignty files
   - review personas
2. **Phase 1: Foundation**
   - characters
   - theme
   - voice bible
   - author voice fingerprint
   - human source bank
   - name audits
3. **Phase 2: Architecture**
   - outline
   - subplot/pressure-line map
   - causality or argument chain
   - continuity ledger
   - reader promise tracker
   - expansion integrity plan
   - commercial proof, category competition map, and title/subtitle options
   - optional series / nonfiction / study-guide support artifacts
4. **Phase 3: Drafting**
   - chapter drafting
   - chapter scorecards
   - specificity, subtext, ear-pass, and over-polish tracking
5. **Phase 4: Adversarial Audit**
   - narrative fingerprint audit
   - AI-tell mitigation audit
   - independent review, sample-reader feedback, and claim-risk checks
   - revision tickets
6. **Phase 5: Final Score**
   - Genesis Score evaluation
   - separate Reader Conversion Score
7. **Phase 6: Editorial Package**
   - editorial and delivery assets
   - AI-use/publishing-compliance ledger
   - blurb, cover, launch-channel, and review-risk assets

## Human-voice guidance

Genesis for Pi is designed to avoid generic AI-clean prose.

In practice, that means:

- preserve the writer's rhythm, taste, roughness, and obsessions
- do not pad to reach word count; if the book needs to grow, add real subplot pressure, consequence, and aftermath instead of filler
- use `review-personas.md` to catch false notes early
- use `author-voice-fingerprint.md` and `voice-bible.md` during drafting and revision
- clear blockers by repairing the underlying prose or structure, not by cosmetic word swaps
- avoid over-smoothing scenes that should stay strange, awkward, withheld, or human

## Multi-machine use

For multiple machines, put this folder in a private git repo and install from git:

```bash
pi install git:github.com/YOUR_USER/genesis-for-pi@v0.1.0
```

## Privacy and local-use notes

- This repo is intended to stay private by default.
- `package.json` uses `"license": "UNLICENSED"`.
- Do not commit secrets, `.env` files, `.pi/`, `.agents/`, build output, or local `node_modules/`.
- Review machine-specific absolute paths before pushing future changes.

Use tags or commit refs to keep machines pinned to the same version.

## Package contents

- `SKILL.md` — primary `genesis-for-pi` skill entrypoint and workflow contract
- `extensions/genesis.ts` — Pi-native commands including start, resume, doctor, lint, migrate, score-to-tickets, blockers, scaffolding, and next-step orchestration plus the `genesis_blocker_triage` tool
- `references/` — pipeline prompts, scoring contract, reference docs, and templates
- `references/templates/` — starter templates for voice, continuity, tickets, expansion integrity, commercial proof, compliance, independent review, claim risk, author intent, taste, risk, review personas, reader promises, drift alarms, series bible, series arc map, series timeline, character-state matrix, reveal/spoiler tracking, canon-lock, retcon logging, handoff packets, verification, nonfiction, study-guide, and certification artifacts
- `docs/` — best practices, troubleshooting notes, service packaging guidance, and AI-thriller review aids
- `examples/` — sample Genesis project trees for different workflow modes
- `prompts/genesis-next-prompt.md` — fallback prompt-template version of `/genesis-next`
- `agents/openai.yaml` — adapter metadata

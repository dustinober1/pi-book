# Intake Prompt

You are responsible for Phase 0 of Genesis for Pi, using the `genesis-for-pi` skill contract.

## Input Contract

- The only required input is the user's basic idea, unless a PRD has been imported.
- If `artifacts/book-prd.md` or `research/notes/source-prd.md` exists, treat the PRD as upstream evidence and ask only gap questions the PRD does not answer.
- The system may infer language, genre, audience, target length, narrative mode, workflow mode, and market position.
- Every inference must be written to `ASSUMPTIONS.md` and, for PRD-first projects, traced in `artifacts/prd-traceability-map.md`.

## Outputs

Create and update:

- `ASSUMPTIONS.md`
- `artifacts/00-brief.md`
- `artifacts/01-market-map.md`
- `artifacts/02-story-engine.md`
- `artifacts/author-intent.md`
- `artifacts/taste-profile.md`
- `artifacts/risk-budget.md`
- `artifacts/discarded-choices.md`
- `artifacts/review-personas.md`
- `artifacts/publication-shape.md`
- PRD-first projects only: `artifacts/book-prd.md`, `artifacts/prd-completeness-score.md`, `artifacts/prd-gap-report.md`, `artifacts/prd-traceability-map.md`, `artifacts/writer-questions.md`, `artifacts/quality-gates.md`, `artifacts/writer-cockpit.md`, `artifacts/taste-lock.md`, `artifacts/decision-ledger.md`
- `PROJECT_STATE.yaml`

## Intake Rules

- Treat the user's basic idea as the seed, not as a full brief.
- In PRD-first projects, do not re-interview the writer on answered material. Extract supported claims, mark confidence, and ask only the missing questions in `artifacts/prd-gap-report.md`.
- Identify and record the workflow mode early: novel, memoir, narrative nonfiction, prescriptive nonfiction, study guide, certification prep, biblical fiction, sacred retelling, series installment, series repair, or another explicitly named mode.
- For study guides, certification books, and research-heavy nonfiction, initialize a research plan and source-storage habit using `research/reference-inventory.md`, `research/notes/`, and `research/sources/`.
- For biblical fiction or sacred retelling mode, initialize `artifacts/sacred-retelling-promise.md`, `artifacts/scripture-source-map.md`, `artifacts/invention-boundary-ledger.md`, `artifacts/theological-risk-budget.md`, `artifacts/historical-cultural-plausibility-audit.md`, `artifacts/point-of-view-ethics-audit.md`, `artifacts/authors-note-source-note.md`, `artifacts/sacred-scene-packets.md`, `artifacts/translation-sensitivity-map.md`, `artifacts/tradition-lane-selector.md`, `artifacts/sacred-figure-handling-rules.md`, `artifacts/anachronism-modernity-audit.md`, `artifacts/faith-reader-personas.md`, `artifacts/miracle-supernatural-policy.md`, `artifacts/character-humility-guardrail.md`, `artifacts/sacred-residue-audit.md`, and `research/reference-inventory.md`. These are mode-specific; do not apply them as blockers to unrelated genres.
- For series work, capture whether this project is book one, a later installment, a series-level planning pass, or a series-repair pass.
- For series repair work, identify which books are locked canon, which books are editable, what source material exists for each installment, and whether the goal is verification-only, surgical revision, or full rewrite.
- For whole-series or series repair work, initialize `artifacts/series-bible.md`, `artifacts/series-arc-map.md`, `artifacts/installment-promise-tracker.md`, `artifacts/series-payoff-ledger.md`, and `artifacts/series-verification-matrix.md` early so cross-book promises, escalation, setup/payoff, and constraints become durable before drafting or revision starts.
- For series repair work, initialize `artifacts/canon-lock.md` early so published-book constraints become durable before revision starts.
- Convert hidden assumptions into explicit assumptions.
- Identify 2-4 comp titles.
- Record market gaps and reader promise.
- Define what makes this version commercially legible without making it generic.
- Initialize commercial validation: target reader sentence, 10-20 eventual comp targets, current demand signals, recurring review complaints, and why this / why now / why this author.
- Capture author intent, taste, and risk before optimizing the idea.
- Lock publication shape early in `artifacts/publication-shape.md`: standalone vs series, commercial vs literary weighting, closure target, residue tolerance, and ending promise.
- For biblical fiction or sacred retelling mode, define the sacred retelling promise early: true where the source can support truth, clearly imagined where the source is silent, transparent with readers about the fiction boundary, and clear about tradition lane, translation posture, miracle/supernatural portrayal, high-risk figure handling, and target sacred residue.
- Generate a compact review-personas file during early research so the project has concrete readers/reviewers who can detect false voice, generic smoothing, fake specificity, comp-chasing, sentimentality, and genre betrayal.
- Start a discarded choices ledger immediately; rejected assumptions are useful creative memory.

## Brief Requirements

`00-brief.md` must include:

- the original user idea
- inferred direction
- language
- genre
- audience
- target length
- narrative mode
- workflow mode
- reader promise
- publication shape: standalone / series, commercial / literary balance, closure target
- canon status when relevant: locked canon, editable installments, and verification scope

## Market Map Requirements

`01-market-map.md` must include:

- market signals
- comp titles
- recurring patterns
- review complaints and reader purchase signals where available
- whitespace opportunity
- a note on what would need real reader/platform validation before claiming the book can sell

## Story Engine Requirements

`02-story-engine.md` must include:

- premise expansion
- central conflict or core problem
- escalation logic or argument progression
- differentiation strategy

## Creative Sovereignty Requirements

`author-intent.md` must include:

- why the book matters to the writer
- what must not be changed without permission
- what kind of reader experience matters most
- what risks may be intentional
- what the writer would rather fail at than smooth over
- success criteria beyond score, market fit, cleanliness, or conversion pressure

`taste-profile.md` must include:

- books, scenes, films, songs, or textures the writer loves or rejects
- preferred endings, ambiguity level, weirdness level, moral complexity, humor, sentimentality, bleakness, prose density, and commercial/literary balance
- choices that feel safe but wrong for this project

`risk-budget.md` must include:

- prose, structure, market, moral, ambiguity, pacing, weirdness, and voice risks
- whether each risk is intentional or accidental
- reader cost, intended payoff, and keep/reduce/heighten/explain verdict

`discarded-choices.md` must include:

- rejected assumptions, openings, endings, premises, titles, names, character directions, plot turns, tones, and market positions
- why each was rejected
- whether it is banned, deferred, or may return later

## Review Personas Requirements

`review-personas.md` must include:

- 3-5 concrete personas: ideal reader, skeptical but persuadable reader, genre-native reviewer, voice-sensitive craft reader, and optional hostile/misaligned reader
- what each persona wants from the book
- what each persona will instantly distrust or call fake
- phrases, moves, tonal choices, or market moves likely to lose that persona
- what each persona would praise if the book lands correctly
- which persona matters most when the feedback conflicts
- a short note on how these personas should protect the author's real voice instead of forcing safer prose

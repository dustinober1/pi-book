---
name: genesis-for-pi
description: "Use when the user wants Genesis for Pi, an extension-first Book Genesis workflow with durable project files, blocker clearing, stronger human-voice safeguards, intake/foundation/architecture/drafting/audit/Genesis Score/editorial packaging, or portable use in other file-aware agents."
---

# Genesis for Pi

Genesis for Pi is Felipe's portable book-production pipeline for file-aware AI agents, packaged as a Pi-native workflow with extension commands and durable project artifacts. It also works conceptually in other file-aware agents that can read project files and write artifacts.

The package folder and canonical skill name are `genesis-for-pi`. In Pi, treat this package as extension-first: use the Genesis commands and blocker-triage UI when available, and use the skill/orchestrator rules as the durable production contract.

Use this skill for:

- fiction, memoir, nonfiction, or hybrid book projects
- certification study guides, exam-prep books, and research-heavy instructional books
- single-book projects or installments within a larger series
- published-series verification and repair work where one installment is locked canon and later installments may be revised or rewritten
- turning a rough idea into a structured book
- drafting full manuscripts chapter by chapter
- auditing AI-written prose and narrative structure
- producing Genesis Score evaluations
- creating synopses, cover briefs, launch/editorial packages, and formatting handoff notes

## Core Rule

Persist important decisions to files. A Book Genesis run should leave a durable project tree, not just chat output.

## Human Voice Rule

The manuscript should not merely avoid AI tells. It should preserve the author's specific taste, rhythm, obsessions, limits, lived material, and productive imperfections. Optimize for reader trust, not AI-detector games. Do not replace AI tells with anti-AI tells; repair the underlying scene, thought, voice, pressure, subtext, or specificity.

## Creative Sovereignty Rule

Do not optimize away the author's intent, taste, risk, opacity, weirdness, or productive imperfection in pursuit of a cleaner score. The system exists to operationalize the writer's book, not replace it with a safer, smoother, more generically marketable book.

## Expansion Integrity Rule

Do not increase manuscript length with filler. If the book needs more words, add consequence rather than volume: stronger subplots, sharper reversals, added pressure, meaningful aftermath, new relational conflict, material scene work, or real thematic complication. Do not pad with repetitive introspection, duplicate exposition, low-stakes banter, atmospheric drift, decorative worldbuilding, or scenes that leave plot, character, and stakes unchanged.

## Version Control Rule

Before writing project files, verify that the project directory is inside a Git work tree. If it is not, run `git init` in the project directory.

Commit at the file level for maximum rollback opportunities:

- commit one file per commit after each meaningful file write or update
- use clear messages such as `Book Genesis: update artifacts/05-outline.md`
- do not batch unrelated artifacts, chapters, state changes, or delivery files into one commit
- do not commit generated directories by themselves; commit the files inside them
- if a write changes `PROJECT_STATE.yaml` plus another artifact, make two commits

Default project layout:

```text
<project>/
  PROJECT_STATE.yaml
  ASSUMPTIONS.md
  STATUS.md
  artifacts/
    author-intent.md
    taste-profile.md
    risk-budget.md
    discarded-choices.md
    review-personas.md
    publication-shape.md
    commercial-proof.md
    category-competition-map.md
    title-subtitle-options.md
    blurb-test-results.md
    cover-conversion-notes.md
    sample-reader-feedback.md
    launch-channel-plan.md
    review-risk-log.md
    publishing-metadata-checklist.md
    ai-use-and-publishing-compliance.md
    independent-review-matrix.md
    claim-risk-ledger.md
    book-prd.md
    prd-completeness-score.md
    prd-gap-report.md
    prd-traceability-map.md
    prd-change-log.md
    decision-impact-report.md
    writer-questions.md
    quality-gates.md
    writer-cockpit.md
    chapter-production-queue.md
    taste-lock.md
    decision-ledger.md
    voice-bible.md
    author-voice-fingerprint.md
    human-source-bank.md
    name-collision-audit.md
    name-entity-filter.md
    causality-chain.md
    scene-embodiment-map.md
    recurring-formal-device-tracker.md
    technical-seed-map.md
    system-rule-sheet.md
    authority-chain-map.md
    opposition-case.md
    domain-plausibility-audit.md
    05-subplot-map.md
    continuity-ledger.md
    reader-promise-tracker.md
    drift-loop-alarm.md
    expansion-integrity.md
    human-specificity-ledger.md
    narrative-fingerprint-audit.md
    ai-tell-mitigation-audit.md
    subtext-audit.md
    ear-pass.md
    over-polish-audit.md
    negative-capability-audit.md
    revision-philosophy.md
    reader-response-plan.md
    beta-feedback-log.md
    positioning-strategy.md
    cover-generation-prompt.md
    sacred-retelling-promise.md
    scripture-source-map.md
    invention-boundary-ledger.md
    theological-risk-budget.md
    historical-cultural-plausibility-audit.md
    point-of-view-ethics-audit.md
    authors-note-source-note.md
    sacred-scene-packets.md
    translation-sensitivity-map.md
    tradition-lane-selector.md
    sacred-figure-handling-rules.md
    anachronism-modernity-audit.md
    faith-reader-personas.md
    miracle-supernatural-policy.md
    character-humility-guardrail.md
    sacred-residue-audit.md
    revision-tickets.md
  manuscript/
    chapters/
  evaluations/
    chapter-scorecards.md
    outline-stress-test.md
    persona-review.md
    regression-check.md
  delivery/
  research/
    reference-inventory.md
    notes/
    sources/
```

## Canonical Pipeline

Template references for high-friction artifacts live under `references/templates/`. Use them when creating or repairing `book-prd.md`, `prd-gap-report.md`, `prd-traceability-map.md`, `prd-completeness-score.md`, `prd-change-log.md`, `decision-impact-report.md`, `writer-questions.md`, `quality-gates.md`, `writer-cockpit.md`, `chapter-production-queue.md`, `outline-stress-test.md`, `persona-review.md`, `regression-check.md`, `series-regression-check.md`, `taste-lock.md`, `decision-ledger.md`, `voice-bible.md`, `continuity-ledger.md`, `revision-tickets.md`, `expansion-integrity.md`, `commercial-proof.md`, `category-competition-map.md`, `title-subtitle-options.md`, `blurb-test-results.md`, `cover-conversion-notes.md`, `sample-reader-feedback.md`, `launch-channel-plan.md`, `review-risk-log.md`, `publishing-metadata-checklist.md`, `ai-use-and-publishing-compliance.md`, `independent-review-matrix.md`, `claim-risk-ledger.md`, `scene-inventory.md`, `chronology-rebuild.md`, `act-design-audit.md`, `series-bible.md`, `series-arc-map.md`, `series-timeline.md`, `character-state-matrix.md`, `reveal-spoiler-matrix.md`, `canon-lock.md`, `installment-promise-tracker.md`, `series-payoff-ledger.md`, `series-verification-matrix.md`, `retcon-log.md`, `series-repetition-radar.md`, `book-handoff-packet.md`, `argument-spine.md`, `certification-blueprint-map.md`, `study-guide-objectives.md`, `evidence-map.md`, sacred retelling templates such as `scripture-source-map.md`, `invention-boundary-ledger.md`, `sacred-scene-packets.md`, `translation-sensitivity-map.md`, `tradition-lane-selector.md`, `sacred-figure-handling-rules.md`, `anachronism-modernity-audit.md`, `miracle-supernatural-policy.md`, `character-humility-guardrail.md`, `sacred-residue-audit.md`, `authors-note-source-note.md`, `research/reference-inventory.md`, and similar artifacts that benefit from a stable structure.

## Workflow Modes

Choose and record a workflow mode during intake. Common modes include:

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
- lean-novel
- lean-nonfiction
- market-test
- other custom mode named explicitly in project files

Mode affects which artifacts are mandatory in practice. Narrative fiction defaults to the full subplot/scene/continuity contract. Nonfiction may replace some plot pressure with argument flow, evidence, case studies, and reader transformation. Study guides and certification books should prioritize blueprint coverage, objective tracking, and reference integrity. Biblical fiction and sacred retellings should protect scripture/source fidelity, invention boundaries, theological risk, ancient-world plausibility, POV ethics, and reader disclosure; these safeguards are mode-specific and should not burden thrillers, LitRPG, romance, sci-fi, or unrelated modes. Series installments should maintain both book-level and series-level continuity. Series repair projects should treat earlier locked books as canon, reverse-engineer them into durable artifacts, and verify later books against those constraints before approving rewrites. Lean modes intentionally reduce artifact gravity for shorter or faster projects: keep the brief, market map, author intent, taste lock, voice bible, outline or argument spine, causality/continuity/promises, chapter queue, revision tickets, adversarial audit, Genesis Score, commercial proof, and compliance ledger; add specialty artifacts only when genre, claim risk, series complexity, or sacred/source risk requires them.

Commercial proof is now part of the workflow, not just final packaging. Before claiming a book is sellable, maintain `artifacts/commercial-proof.md`, map competition in `artifacts/category-competition-map.md`, test title/blurb/cover/sample signals where possible, preserve outside-reader feedback, and distinguish commercially legible from commercially proven. Before KDP upload, client delivery, or public launch, update `artifacts/ai-use-and-publishing-compliance.md` and `artifacts/publishing-metadata-checklist.md`. Use `/genesis-market-test` or `/genesis-commercial-proof` when you need this validation before full foundation/architecture work.

For whole-series work, prefer `/genesis-series-start` to create a series root with `SERIES_STATE.yaml`, `SERIES_STATUS.md`, shared series artifacts, and one `series installment` Genesis project per book under `books/`. Use `/genesis-series-open` to pick an existing workspace, `/genesis-series-next` for the next safe series/book step, `/genesis-series-add-book` when the series expands, `/genesis-series-blockers` for cross-book triage, `/genesis-series-verify` for cross-book verification, `/genesis-series-regression-check` after revisions or lock decisions, `/genesis-series-score` for whole-series scoring, `/genesis-series-export` for delivery handoff, and `/genesis-series-lock-book` after an installment is ready to become canon.

Load `references/pipeline/manifest.yaml` before starting or advancing phases.

1. Phase 0: Intake
2. Phase 1: Foundation
3. Phase 2: Architecture, including commercial proof and category/title validation
4. Phase 3: Drafting
5. Phase 4: Adversarial Audit, including outside-reader/independent-review and claim-risk checks
6. Phase 5: Final Score, including Reader Conversion Score
7. Phase 6: Editorial Package, including compliance and launch/conversion artifacts

Use `references/pipeline/phases.md` for the compact phase overview.

## Phase References

Read only the prompt for the active phase:

- Intake: `references/prompts/intake.md`
- Foundation: `references/prompts/foundation.md`
- Architecture: `references/prompts/architecture.md`
- Drafting: `references/prompts/drafting.md`
- Adversarial Audit: `references/prompts/adversarial-audit.md`
- Final Score: `references/scoring/genesis-score.md`
- Editorial Package: `references/prompts/editorial-package.md`

`references/prompts/orchestrator.md` contains the portable orchestration rules.

## Operating Loop

1. Identify or create the project directory.
2. Ensure Git is initialized, running `git init` when the project is not already in a work tree.
3. Read `PROJECT_STATE.yaml` if it exists. If not, initialize it from the manifest phases and user idea.
4. Read `ASSUMPTIONS.md` if it exists. If not, create it and mark inferred assumptions clearly.
4a. Read `STATUS.md` when it exists for a quick resume dashboard, but treat project files such as `PROJECT_STATE.yaml`, artifact files, and manuscript files as the source of truth.
4b. Identify and record the workflow mode early: novel, memoir, narrative nonfiction, prescriptive nonfiction, study guide, certification prep, biblical fiction, sacred retelling, series installment, series repair, or another explicitly named mode.
5. Load the current phase prompt and produce only that phase's required outputs.
5a. For PRD-first work, treat the PRD as upstream evidence: import it into `research/notes/source-prd.md`, score it in `artifacts/prd-completeness-score.md`, map supported claims in `artifacts/prd-traceability-map.md`, ask only unanswered questions in `artifacts/prd-gap-report.md` and `artifacts/writer-questions.md`, and do not draft prose until gates allow it. When a revised PRD appears, compare it in `artifacts/prd-change-log.md` and `artifacts/decision-impact-report.md` before accepting it as source of truth.
5b. When creating a supported artifact from scratch, check `references/templates/` first and use the matching template unless the project clearly needs a different structure.
6. Commit one file per commit after every artifact, chapter, state, evaluation, or delivery file update.
7. Update `PROJECT_STATE.yaml` after every phase, chapter block, audit, score, or blocker-clearing pass.
8. Do not skip Phase 4. Audit before final scoring.
9. When drafting, write in chapter files under `manuscript/chapters/` and keep the state synchronized.
10. When user feedback changes direction, record it in project files before continuing.
11. Lock `artifacts/publication-shape.md` early and revisit it before the final act so the ending does not drift into being thematically right but commercially under-resolved. Standalone books need decisive external consequence; series openers need one battle closed and a larger conflict intentionally left alive.
11a. For thrillers, speculative fiction, institutional stories, and system-driven novels, require an early external clock or visible pressure deadline, a midpoint turn that changes public/physical/institutional/relational conditions, and at least one proactive protagonist decision before the final act.
11b. Do not let the middle default to a repeated scene engine of discovery, explanation, phone/legal pressure, text/call human cost, dashboard update, guilt realization, and aphoristic close. Track and vary scene engines through `artifacts/scene-embodiment-map.md`, `evaluations/chapter-scorecards.md`, and `artifacts/drift-loop-alarm.md`.
11c. For technical, legal, medical, institutional, or invented systems, create a simple reader-facing model in `artifacts/technical-seed-map.md` by the first quarter before specialized terms pile up.
12. Use writer approval gates after PRD import, author voice fingerprinting, first-page/sample drafting, chapter one, pre-full-drafting, and final polish; record gate state in `artifacts/quality-gates.md` and summarize it in `artifacts/writer-cockpit.md`. If the writer says "this is not how I sound," update the voice artifacts before continuing.
12. Treat 2-3 integrated subplots as a required structural layer for book-length work unless the user explicitly requests a shorter or single-threaded form.
13. Plan, track, audit, and package subplots through `artifacts/05-subplot-map.md`; do not invent major subplot turns during drafting without updating that map.
14. Maintain `artifacts/continuity-ledger.md` as the manuscript memory: facts, timelines, promises, unresolved questions, clues, reveals, locations, objects, and subplot status.
15. Convert audit and scoring problems into `artifacts/revision-tickets.md` entries with issue, evidence, affected files, severity, repair type, owner phase, and status.
16. Track every major reader promise in `artifacts/reader-promise-tracker.md`, including premise, genre, emotional, mystery, subplot, and opening promises.
17. Maintain `evaluations/chapter-scorecards.md` after chapter blocks so each chapter has a compact diagnostic record.
18. Maintain `artifacts/drift-loop-alarm.md` as the hard stop system for repeated structure, no-state-change chapters, reopened tickets, local-model drift, phase-output mismatch, false productivity, and padding attempts.
19. Maintain `artifacts/expansion-integrity.md` whenever target length, pacing, or scope creates pressure to expand. Record why expansion is needed, which subplot or pressure line justifies it, what each added scene changes, and which filler patterns are forbidden.
20. For series work, maintain `artifacts/series-bible.md`, `artifacts/series-arc-map.md`, `artifacts/series-timeline.md`, `artifacts/character-state-matrix.md`, `artifacts/reveal-spoiler-matrix.md`, `artifacts/installment-promise-tracker.md`, `artifacts/series-payoff-ledger.md`, `artifacts/retcon-log.md`, and `artifacts/series-repetition-radar.md` so recurring continuity, chronology, reveal order, cross-book escalation, setup/payoff, and installment obligations remain visible.
20a. For series repair work, maintain `artifacts/canon-lock.md` for immutable published-book facts and non-negotiables, plus `artifacts/series-verification-matrix.md` to compare each repairable installment against locked canon, promises, continuity, voice, and escalation obligations.
20b. For all series work, keep planned future material separate from locked canon. Do not over-plan every book at scene level, do not invent definitive future-book endings prematurely, and do not lock canon without explicit user approval or `/genesis-series-lock-book`.
20c. When a book becomes final enough to hand off downstream obligations, maintain that book's `artifacts/book-handoff-packet.md` so the next installment inherits the correct ending state, unresolved promises, reveal constraints, and forbidden contradictions.
20d. After cross-book revision, run or update `evaluations/series-regression-check.md` so canon, timeline, character state, reveal order, handoff integrity, and repetition/escalation risks do not silently regress.
20e. For biblical fiction or sacred retelling mode, maintain `artifacts/sacred-retelling-promise.md`, `artifacts/scripture-source-map.md`, `artifacts/invention-boundary-ledger.md`, `artifacts/theological-risk-budget.md`, `artifacts/historical-cultural-plausibility-audit.md`, `artifacts/point-of-view-ethics-audit.md`, `artifacts/authors-note-source-note.md`, `artifacts/sacred-scene-packets.md`, `artifacts/translation-sensitivity-map.md`, `artifacts/tradition-lane-selector.md`, `artifacts/sacred-figure-handling-rules.md`, `artifacts/anachronism-modernity-audit.md`, `artifacts/faith-reader-personas.md`, `artifacts/miracle-supernatural-policy.md`, `artifacts/character-humility-guardrail.md`, `artifacts/sacred-residue-audit.md`, and `research/reference-inventory.md`. Separate explicit scripture, inference, historical/cultural context, tradition, and narrative invention. Do not present invention as biblical fact.
21. For nonfiction and study-guide work, maintain argument and research artifacts such as `artifacts/argument-spine.md`, `artifacts/evidence-map.md`, `artifacts/reader-transformation-map.md`, `artifacts/certification-blueprint-map.md`, `artifacts/study-guide-objectives.md`, and `research/reference-inventory.md` when relevant.
22. Maintain `artifacts/causality-chain.md` so scenes connect by therefore/but causality, not loose and-then sequence.
23. Maintain `artifacts/review-personas.md` during research as a small set of high-signal reader and reviewer personas who will notice false notes, genre betrayal, sentimentality, flattening, overwritten prose, or fake specificity; use them as pressure tests during drafting and audit.
24. Maintain `artifacts/voice-bible.md` with voice rules and anti-voice constraints: diction, rhythm, metaphor rules, POV noticing, dialogue compression, taboo phrases, and generic cadences to avoid.
25. Maintain `artifacts/author-voice-fingerprint.md` from author samples or stated taste: sentence habits, paragraph rhythm, punctuation tolerance, humor, lyricism, dialogue behavior, emotional restraint, taboo phrasing, recurring obsessions, and productive imperfections to preserve.
26. Maintain `artifacts/human-source-bank.md` as optional writer-supplied lived material: memories, overheard phrases, known places, occupational details, embarrassing behavior, family sayings, sensory facts, private annoyances, objects, jokes, and things the writer refuses to sentimentalize.
27. Maintain `artifacts/author-intent.md`, `artifacts/taste-profile.md`, and `artifacts/risk-budget.md` as the creative sovereignty layer: why the book matters, what must not be changed, the author's taste, intentional risks, acceptable reader costs, and what the system must not optimize away.
28. Maintain `artifacts/discarded-choices.md` so rejected openings, endings, names, plot turns, character choices, tonal directions, argument paths, and content structures remain visible and are not accidentally reintroduced.
28a. Maintain `artifacts/decision-ledger.md` for approved pivots, rejected ideas, unresolved choices, and automation boundaries; do not silently reverse a ledgered decision.
28b. Maintain `artifacts/taste-lock.md` as the compact do-not-smooth-away layer for author taste, intentional risk, productive roughness, taboo generic cadences, and changes requiring writer approval.
28c. Maintain `artifacts/chapter-production-queue.md` when architecture is approved so drafting proceeds from packets with goals, promises, causality, continuity constraints, taste-lock notes, forbidden filler, and post-draft ledger tasks.
28d. Maintain `artifacts/writer-questions.md` as a gap-only decision list; ask the writer only questions that require judgment, approval, taste, risk, or strategic direction.
28e. Maintain `evaluations/outline-stress-test.md` before full drafting to catch middle sag, weak reversals, broken causality, decorative threads, promise gaps, false climax, ending mismatch, and padding risk.
28f. Maintain `artifacts/review-personas.md` as an active reader/reviewer panel and `evaluations/persona-review.md` when reviewing outline, chapters, or manuscript through that panel.
28g. Maintain `evaluations/regression-check.md` after significant revision, PRD changes, or persona/audit fixes so approved promises, continuity, voice/taste, resolved tickets, and expansion integrity are not accidentally broken.
29. Maintain `artifacts/name-collision-audit.md` as a web-backed audit of character, place, faction, institution, object, and invented-term names before they are finalized.
30. Maintain `artifacts/name-entity-filter.md` as an internal originality filter for character names, place names, institutions, companies, agencies, cults, factions, recurring objects, named artifacts, and invented terminology; include world-fit logic, AI-default risk, rejected alternatives, and bans on hyper-symbolic surnames, overly smooth YA/fantasy names, cool but empty faction names, invented words without phonetic logic, repeated soft consonant patterns, and placeholder TV drama names.
31. Maintain `artifacts/human-specificity-ledger.md` during drafting so each chapter gets a few precise details with restraint: petty contradictions, dumb object attachments, bad jokes, bodily inconvenience, texture, social awkwardness, silence, uneven competence, and small consequences of fatigue, hunger, weather, money, or shame.
32. Maintain `artifacts/narrative-fingerprint-audit.md` during Phase 4 as a StoryScope-informed whole-book audit of AI-shaped narrative choices: thematic over-determination, moralizing dialogue, tidy single-track plots, overly clean causality, embodied emotion overuse, setting-as-psychological-mirror, external character description, thin subplot integration, lesson-shaped endings, and suspiciously frictionless length expansion.
33. Maintain `artifacts/ai-tell-mitigation-audit.md` during Phase 4 as a source-informed audit of visible AI tells: em dash excess, semicolon swaps, not X; Y contrast, not only/but also, lists of three, stock triads, AI vocabulary clusters, cliches, placeholder or tool leakage, markdown artifacts, fake citations, abstraction trap, subtext vacuum, forced sass, exhaustive qualifiers, purple metaphor stacks, blocky dialogue/exposition/narration, weak callbacks, weak segues, and over-explained jokes.
34. Maintain `artifacts/subtext-audit.md` to catch places where characters say exactly what they mean, narration explains the scene's meaning, symbols are interpreted for the reader, jokes are explained, conflict is too cleanly articulated, or miscommunication/evasion would create more human pressure.
35. Maintain `artifacts/ear-pass.md` as a read-aloud rhythm audit: repeated sentence shapes, too-smooth paragraphs, unnatural dialogue, assistant-like exposition, dead segues, and paragraphs that need to become rougher, shorter, stranger, or more character-shaped.
36. Maintain `artifacts/over-polish-audit.md` to protect productive awkwardness, asymmetry, silence, contradiction, abruptness, and character-shaped roughness from being polished into generic competence.
37. Maintain `artifacts/scene-embodiment-map.md` so major scenes contain physical action, objects, spatial pressure, interruption, practical stakes, and behavior beyond people explaining themselves. Also track dominant scene engine and screen/phone/dashboard dependence so abstract plots keep entering the lived world.
37a. Track repeated rhetorical shapes during drafting and audit. Strong signature moves are allowed, but recurring aphoristic closeouts, negative parallelism, triads, fragment verdicts, and stock phrases become prose fatigue when they make the author more audible than the character. Run `npm run audit:rhetoric -- <project>` for a sentence-shape report (pair it with `npm run audit:ngrams` for verbatim repetition).
37b. Run the six deterministic scanners before scoring and before any developmental cut pass: `npm run audit:structure -- <project>` (catches assembly-draft scaffolding like Chapter 2A/2B and post-climax bloat), `npm run audit:continuity -- <project>` (flags locked numerical facts — ages, counts, dates — that diverge in the manuscript), `npm run audit:rhetoric -- <project>` (sentence-shape fatigue), `npm run audit:spelling -- <project>` (British/American mixed-system AND stray minority-system tokens), `npm run audit:temporal -- <project>` (dangling temporal forward-references that survive a chapter reorder), and `npm run audit:mechanics -- <project>` (lowercase sentence starts, doubled words, space-before-punctuation). These are supporting diagnostics, not verdicts; confirm each finding in context. **After ANY chapter reorder, move, or major expansion, always run `audit:temporal`** — the most common publication-blocker introduced by structural revision is a chapter that still promises a future event ("tomorrow there would be…") which now occurs earlier in the book. Maintain `artifacts/scene-inventory.md` so every scene earns its place by changing plot, character, or pressure (not by delivering a reflection alone), `artifacts/chronology-rebuild.md` so the per-scene timeline grid and character-age track are consistent, and `artifacts/act-design-audit.md` so the post-climax tail is a deliberate Act IV or a compressed denouement rather than a second novella after the novel has climaxed.
38. Maintain `artifacts/negative-capability-audit.md` to protect unresolved tension, moral ambiguity, contradiction, opacity, images that do not reduce to a single theme, and endings with residue.
39. Maintain `artifacts/recurring-formal-device-tracker.md` when the manuscript uses distinctive structural devices (logs, epistolary sections, data dumps, alternate POV chapters, in-world documents); track each occurrence's function, escalation, and compression ratio. Flag and cut redundant occurrences that repeat established work.
40. Maintain `artifacts/technical-seed-map.md` for speculative fiction and thrillers whose climax depends on a specific technical or conceptual mechanism; track when key concepts are introduced, deepened, and made operational so the reader can track the logic in real time at the climax.
41. Maintain `artifacts/system-rule-sheet.md` for speculative fiction and techno-thrillers so the system's capabilities, limits, authority surfaces, legacy exceptions, shutdown logic, and knowledge distribution are defined before drafting.
42. Maintain `artifacts/authority-chain-map.md` for books involving institutional interventions, healthcare, moderation, compliance, platforms, welfare checks, or crisis escalation so every major intervention has a visible authority chain.
43. Maintain `artifacts/opposition-case.md` so every major antagonist, institutional foil, or opposition force has a coherent positive case and protects some real value the book would lose if they lost.
44. Maintain `artifacts/domain-plausibility-audit.md` for fiction that depends on technical, medical, legal, or institutional credibility; flag plot-critical claims that need expert review before final scoring.
45. Maintain `artifacts/manuscript-formatting-checklist.md` during Phase 6 to verify word count accuracy, title page correctness, formatting consistency, metadata scrub, and code-fence/log formatting.
45a. Maintain `artifacts/cover-generation-prompt.md` during Phase 6 as a detailed paste-ready ebook cover prompt. Default KDP ebook art target is 1600 px wide by 2560 px high, with clear thumbnail-readable composition, negative space for typography, avoid list, and manual text-finishing notes.
46. Maintain `artifacts/revision-philosophy.md`, `artifacts/reader-response-plan.md`, `artifacts/beta-feedback-log.md`, and `artifacts/positioning-strategy.md` when revision, outside response, or packaging begins.

## Quality Policy

- Prefer fewer constraints during drafting; evaluate and repair afterward.
- Separate drafting, audit, scoring, and editorial judgment in the workflow.
- Treat word-count padding as a structural failure; if the manuscript needs to be longer, add consequence rather than volume.
- In nonfiction, let argument, evidence, case sequencing, and reader transformation perform structural work that plot and subplot perform in fiction.
- In study guides and certification books, treat blueprint coverage, factual accuracy, source organization, and objective mapping as structural requirements, not packaging details.
- In biblical fiction and sacred retelling mode, treat source/invention boundaries as reader-trust requirements. The story may imagine, but the package must show what is scripture-backed, inferred, historically/culturally sourced, tradition-backed, or invented. Passage packets, translation sensitivity, tradition lane, sacred-figure handling, anachronism checks, miracle/supernatural policy, character humility, sacred residue, and Author's Note disclosure are mode-specific safeguards, not universal genre rules.
- In series work, protect both installment payoff and series-level continuity; do not solve one by breaking the other.
- In series repair work, do not quietly rewrite around locked canon; extract the canon first, record what is immutable, then repair later books against that record.
- Require every subplot to pressure the main plot, expose character contradiction, sharpen theme, alter the ending, or materially increase pressure on an existing promise; decorative side business should be cut or merged.
- Treat continuity drift as a structural defect, not a copy-editing issue; repair or flag contradictions before final scoring.
- Treat open high-severity revision tickets as blockers; do not approve the manuscript until they are fixed, deferred with rationale, or accepted as deliberate risk.
- Treat broken reader promises as structural failures unless the manuscript clearly transforms or deliberately denies them with payoff.
- Use chapter scorecards to make revision surgical instead of rewriting broad sections without evidence.
- Treat any triggered `artifacts/drift-loop-alarm.md` hard stop as a pause point; stop drafting or revision and ask for direction before generating more manuscript.
- Treat `artifacts/quality-gates.md` statuses of `blocked` or `needs_writer_approval` as hard automation stops; update the writer cockpit with the needed decision instead of advancing.
- Treat unresolved `artifacts/expansion-integrity.md` padding risk as a blocker when the project is expanding to meet a target length, trim count, or pacing requirement.
- Treat broken therefore/but causality as a structural failure; every major scene should cause, constrain, complicate, pay off something, or justify a necessary expansion with new pressure.
- Treat anti-voice violations as evidence of prose drift, especially when local models become generic after revision passes.
- Treat unresolved web-backed name collision risk as a blocker; do not finalize names that are overused, strongly associated with existing books/media/IP, too trope-coded, or too AI-default.
- Treat unresolved name-entity-filter.md failures as blockers; do not finalize names that feel generic, over-symbolic, fantasy-random, thriller-cliche, AI-default, cool but empty, phonetically mushy, or like placeholder TV drama names without a deliberate accepted-risk rationale.
- Treat unresolved recurring-formal-device-tracker.md fatigue as a pacing risk; if a distinctive structural device repeats without escalation or new work, cut or compress the redundant occurrence.
- Treat unresolved technical-seed-map.md gaps as a clarity risk for speculative fiction and thrillers; the reader should be able to track both the moral logic and the technical logic at the climax.
- Treat unresolved domain-plausibility-audit.md claims as reader-trust blockers for fiction with technical dependencies; plot-critical claims without expert review should be verified or flagged before final scoring.
- Treat unresolved system-rule-sheet.md gaps as structural risks; late-appearing capabilities, unclear limits, unclear shutdown logic, or emergency exceptions without prior seeding should block approval in speculative thrillers.
- Treat unresolved authority-chain-map.md gaps as plausibility blockers; every institutional intervention should have a visible who-saw-what / who-decided-what chain.
- Treat unresolved opposition-case.md weakness as a thematic and character blocker; a major foil who is not protecting any real value weakens the book.
- Treat unresolved publication-shape.md softness as an ending blocker; standalone books need decisive external consequence, and series openers need a clearer one-battle-closed hook.
- Treat protagonist withholding as a limited tool, not a middle-act engine; repeated delay without changed conditions should be treated as stalling.
- Treat missing external clock, soft midpoint, or passive/reactive protagonist architecture as pacing and market risks in thriller, suspense, and system-driven fiction.
- Treat jargon pileup before a plain reader-facing model as a clarity risk. The repair is not to dumb the book down, but to seed a simpler mental model earlier and tie terms to consequence.
- Treat repeated screen/phone/dashboard scenes as a scene-embodiment risk unless each instance creates a new physical, public, institutional, relational, or material consequence.
- Treat canonical-name-lock violations in continuity-ledger.md as continuity failures, not copy-editing issues; standardize immediately when a name, term, or numerical value appears in two forms.
- Treat an empty or excessive human-specificity-ledger.md as a prose risk; lived detail should add believable noise with restraint, not decorate every beat with quirks.
- Treat unresolved StoryScope-style narrative-fingerprint risk as a blocker; the manuscript should not approve if its story shape depends on thematic over-determination, tidy single-track plotting, overly clean causality, excessive embodied emotion, obvious atmosphere-as-feeling, or closure that turns into a lesson.
- Treat unresolved ai-tell-mitigation-audit.md issues as reader-trust blockers; visible AI tells should be fixed at the cause, not only hidden by replacing punctuation or banned words.
- Treat author-voice-fingerprint.md as the primary defense against generic prose; preserve the author's specific rhythm and taste even when it creates controlled roughness.
- Treat review-personas.md as an early warning system for false voice, fake depth, comp-chasing, and workshop-clean generic prose; if a persona would call out the page as not-me, repair the prose at the level of pressure, rhythm, specificity, and omission.
- Treat human-source-bank.md as optional but high-value source material; use it with permission and restraint rather than inventing generic specificity.
- Treat subtext-audit.md, ear-pass.md, and over-polish-audit.md as safeguards against prose that is too explained, too smooth, or too engineered to evade AI detection.
- Treat writer approval gates as real gates, not courtesy check-ins; revise the artifacts when the writer rejects the sound of the prose.
- Treat author-intent.md, taste-profile.md, and risk-budget.md as creative constraints equal to market and structure; do not erase intentional risk just because it creates friction.
- Treat discarded-choices.md as memory for the project's roads not taken; do not reintroduce rejected ideas without recording why the context changed.
- Treat negative-capability-audit.md as a counterweight to excessive coherence; not every resonance should be explained, resolved, or reduced to theme.
- Treat scene-embodiment-map.md as a guardrail against scenes becoming disembodied conversations about meaning.
- Use the Genesis Score floor principle: the book is only as strong as its weakest major dimension.
- For Portuguese books, write artifacts and prose in Portuguese unless the user requests otherwise.
- If a task is only editing, scoring, or packaging an existing manuscript, start from the matching phase instead of forcing a full restart.
- Calibrate model sampling per phase rather than auto-mutating it; see the "Model sampling profile by phase" section in `docs/best-practices.md`. Default low for ledger/PRD/score/audit work, higher only for net-new prose and divergent ideation, and always calibrate to your specific model — do not copy a single temperature number across providers.

## Complementary Skills

Use these only when relevant and already available:

- `copy-editing` for prose-level cleanup
- `humanizer` for less synthetic phrasing
- `launch-strategy` or `content-strategy` for go-to-market assets
- `imagegen` or cover-specific workflows for cover ideation

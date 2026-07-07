# Genesis Score

## Purpose

Genesis Score is the single scoring contract for Genesis for Pi, using the `genesis-for-pi` skill contract.
It must be used consistently across prompts, adapters, examples, reports, and manual review.

The score exists to answer one question:

> Is this manuscript ready to survive contact with demanding readers, skeptical agents, and the market it claims to serve?

## Order Of Operations

The score only happens after Phase 4: Adversarial Audit.

If the adversarial audit concludes `MAJOR REWRITE`, the score may be recorded provisionally but the manuscript is not eligible for approval.

Before approval, read `artifacts/revision-tickets.md`. Open blocker or high-severity tickets prevent approval unless they are explicitly deferred with rationale or accepted as deliberate risk.

Before approval, read `artifacts/drift-loop-alarm.md`. An active hard stop prevents approval unless it is resolved, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/commercial-proof.md`, `artifacts/category-competition-map.md`, `artifacts/title-subtitle-options.md`, `artifacts/blurb-test-results.md`, `artifacts/cover-conversion-notes.md`, `artifacts/sample-reader-feedback.md`, `artifacts/launch-channel-plan.md`, `artifacts/review-risk-log.md`, and `artifacts/publishing-metadata-checklist.md` when present or required by phase. Missing target reader, unmapped competition, no demand evidence, untested title/blurb/cover promise, absent outside-reader sample signal, unclear launch path, incomplete publishing metadata, or unresolved review-risk blocker prevents approval unless explicitly deferred with rationale or accepted as deliberate risk.

Before approval, read `artifacts/independent-review-matrix.md`. The book cannot pass because the drafting agent says it passes. Missing independent review lanes, unresolved contradictions, or rejected objections without textual/strategic evidence prevent approval unless explicitly deferred with rationale or accepted as deliberate risk.

Before approval, read `artifacts/claim-risk-ledger.md` for nonfiction, practical, technical, health, finance, legal, religious, certification, and other claims-heavy work. Unverified high-risk claims, expert-review-required claims, or marketing-unsafe claims prevent approval unless sourced, expert-reviewed, revised, removed, or restricted from marketing.

Before approval, read `artifacts/ai-use-and-publishing-compliance.md` before KDP upload, client delivery, or public launch. Unknown AI role, uncertain KDP/platform classification, unresolved disclosure decision, untracked AI-generated assets, or missing human authorship evidence prevents delivery approval unless explicitly deferred with rationale or accepted as deliberate risk.

Before approval, read `artifacts/name-collision-audit.md`. Unresolved web-backed name collision risk, finalized `web_blocked` names, or high-risk existing-IP overlap prevents approval unless fixed, renamed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/name-entity-filter.md`. Unresolved AI-default, generic, over-symbolic, fantasy-random, thriller-cliche, placeholder TV drama, cool-but-empty, phonetic-logic, or rejected alternatives issues prevent approval unless fixed, renamed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/human-specificity-ledger.md`. Missing restraint, missing petty contradictions, or chapters without lived human detail prevent approval unless fixed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/narrative-fingerprint-audit.md`. Unresolved StoryScope-style narrative risks such as thematic over-determination, tidy single-track plotting, overly clean causality, embodied emotion overuse, weak subplot integration, or lesson-shaped closure prevent approval unless fixed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/ai-tell-mitigation-audit.md`. Unresolved visible AI tells such as em dash excess, not X; Y contrast, lists of three, placeholder leakage, markdown artifacts, fake citations, abstraction trap, subtext vacuum, blocky dialogue, or formulaic prose clusters prevent approval unless fixed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/author-voice-fingerprint.md`. Missing or ignored author fingerprint evidence prevents approval unless explicitly deferred with rationale or accepted as deliberate risk.

Before approval, read `artifacts/subtext-audit.md`, `artifacts/ear-pass.md`, and `artifacts/over-polish-audit.md`. Unresolved over-explanation, too-direct dialogue, unnatural rhythm, assistant-like exposition, or over-polishing that erases author voice prevents approval unless fixed, deferred with rationale, or accepted as deliberate risk.

Before approval, read `artifacts/author-intent.md`, `artifacts/taste-profile.md`, `artifacts/risk-budget.md`, `artifacts/discarded-choices.md`, `artifacts/scene-embodiment-map.md`, `artifacts/technical-seed-map.md`, `artifacts/negative-capability-audit.md`, `artifacts/revision-philosophy.md`, `artifacts/system-rule-sheet.md`, `artifacts/authority-chain-map.md`, `artifacts/opposition-case.md`, and `artifacts/publication-shape.md`. Unresolved creative sovereignty failures, erased author intent, ignored taste constraints, accidental risk, disembodied scenes, repeated screen/phone/dashboard loops, missing plain-language model, jargon pileup, false opacity, over-soft publication shape, unclear system rules, unclear authority chains, or weak opposition positive-case prevent approval unless fixed, deferred with rationale, or accepted as deliberate risk.

For biblical fiction or sacred retelling mode, also read `artifacts/sacred-retelling-promise.md`, `artifacts/scripture-source-map.md`, `artifacts/invention-boundary-ledger.md`, `artifacts/theological-risk-budget.md`, `artifacts/historical-cultural-plausibility-audit.md`, `artifacts/point-of-view-ethics-audit.md`, `artifacts/authors-note-source-note.md`, `artifacts/sacred-scene-packets.md`, `artifacts/translation-sensitivity-map.md`, `artifacts/tradition-lane-selector.md`, `artifacts/sacred-figure-handling-rules.md`, `artifacts/anachronism-modernity-audit.md`, `artifacts/faith-reader-personas.md`, `artifacts/miracle-supernatural-policy.md`, `artifacts/character-humility-guardrail.md`, `artifacts/sacred-residue-audit.md`, and `research/reference-inventory.md`. Unresolved source contradiction, unclear invention boundary, invented material presented as biblical fact, accidental theology, translation sensitivity, tradition-lane mismatch, sacred-figure handling failure, anachronism/modernity leak, miracle/supernatural tone drift, character reduction, weak sacred residue, historical/cultural implausibility, high-risk POV ethics, or missing source disclosure prevents approval unless fixed, deferred with rationale, or accepted as deliberate risk.

## Dimensions

The core craft score uses 10 dimensions:

1. Originality
2. Theme
3. Characters
4. Prose
5. Pacing
6. Emotion
7. Coherence
8. Market
9. Voice
10. Opening

A separate Reader Conversion Score must also be reported. It does not excuse weak craft, but it can block approval for projects claiming commercial intent.

## What Each Dimension Measures

### Originality

- novelty of premise, lens, or execution
- freedom from stale imitation
- StoryScope-informed narrative-fingerprint-audit.md evidence that the book does not sit in a generic AI-shaped narrative cluster
- author-intent.md, taste-profile.md, risk-budget.md, and discarded-choices.md evidence that originality comes from deliberate authorial selection, not accidental generator novelty
- name-collision-audit.md evidence that names are not overused, famous-book/media collisions, trope defaults, or AI-default choices
- name-entity-filter.md evidence that names avoid hyper-symbolic surnames, overly smooth YA/fantasy patterns, cool but empty faction names, invented words with no phonetic logic, repeated soft consonant patterns, placeholder TV drama names, and untracked rejected alternatives

### Theme

- depth of the central question
- resonance beyond plot mechanics
- whether reader-promise-tracker.md shows that thematic promises are paid off, transformed, or deliberately denied
- avoidance of thematic over-determination, moralizing dialogue, and lesson-shaped closure unless deliberately earned

### Characters

- wound, desire, need, contradiction, and memory value
- character actions that cause consequences in causality-chain.md
- subplot roles that reveal contradiction or force meaningful choices
- names that feel specific to role, culture, era, voice, and world without leaning on obvious symbolism or familiar AI-generated defaults
- human-specificity-ledger.md evidence of petty contradictions, uneven competence, and small unsymbolic behavior that makes characters feel lived rather than engineered
- narrative-fingerprint-audit.md evidence that characters are introduced through action, dialogue, contradiction, friction, or choice rather than external description alone

### Prose

- sentence quality
- precision
- texture
- avoidance of cliche and explanatory drag
- compliance with voice-bible.md and avoidance of anti-voice patterns
- restraint in human-specificity-ledger.md: a few exact lived details per chapter, not a pile of quirks
- avoidance of embodied emotion overuse and obvious setting-as-psychological-mirror patterns flagged in narrative-fingerprint-audit.md
- avoidance of ai-tell-mitigation-audit.md findings such as em dash excess, not X; Y contrast, lists of three, stock triads, AI vocabulary clusters, abstraction trap, subtext vacuum, forced sass, and overly smooth grammar
- scene-embodiment-map.md evidence that scenes contain physical action, objects, constraints, tasks, interruptions, and behavior beyond explanation
- author-voice-fingerprint.md evidence that prose preserves this author's rhythm, taste, obsessions, emotional restraint, tolerated roughness, and not-me constraints
- subtext-audit.md, ear-pass.md, and over-polish-audit.md evidence that prose is not over-explained, rhythmically synthetic, or polished into generic competence

### Pacing

- tension control
- variation
- forward pull
- therefore/but causality from causality-chain.md
- subplot cadence that adds pressure without stalling the main plot
- resistance to tidy single-track escalation and overly clean causality flagged in narrative-fingerprint-audit.md
- chapter-scorecards.md evidence that tension and chapter function vary across the manuscript
- drift-loop-alarm.md evidence that chapters are not repeating scene shape, emotional beat, or no-state-change patterns

### Emotion

- whether the book actually lands its intended feeling
- whether petty contradictions, silence, bodily inconvenience, shame, fatigue, hunger, weather, money, taste, smell, or texture make emotion less clean and more credible
- whether emotional turns avoid becoming performative body-sensation clusters

### Coherence

- internal logic
- continuity
- causal integrity
- causality-chain.md integrity across setup, consequence, constraint, and payoff
- continuity-ledger.md accuracy across character facts, timeline, locations, clues, reveals, promises, and unresolved questions
- reader-promise-tracker.md accuracy across setup, transformation, and payoff
- name-collision-audit.md consistency across every named entity in the manuscript
- name-entity-filter.md consistency across every named entity and its rejected alternatives
- human-specificity-ledger.md consistency with chapter events rather than decorative add-ons
- narrative-fingerprint-audit.md evidence that nonlinear structure, delayed disclosure, unresolved residue, and moral ambiguity are purposeful rather than random
- setup, escalation, convergence, and payoff for every major subplot

### Market

- comp clarity
- audience legibility
- category and shelf viability
- evidence that readers are actively buying or requesting this promise now
- `artifacts/commercial-proof.md` evidence for target reader, why this / why now / why this author, demand signals, and validation status
- `artifacts/category-competition-map.md` evidence for 10-20 comps or shelf neighbors, review complaints, cover/title language, price/page norms, and differentiation opportunity
- `artifacts/title-subtitle-options.md`, `artifacts/blurb-test-results.md`, and `artifacts/cover-conversion-notes.md` evidence that the promise has been tested against alternatives
- `artifacts/sample-reader-feedback.md` evidence of outside-reader signal where commercial approval is claimed
- `artifacts/launch-channel-plan.md`, `artifacts/review-risk-log.md`, and `artifacts/publishing-metadata-checklist.md` evidence that reader access, predictable objections, and upload metadata are not hand-waved
- reduced confusion with existing books, media franchises, famous characters, celebrities, trademarks, and genre-overused names

### Voice

- recognizability
- distinctiveness
- durability over pages
- voice-bible.md specificity and anti-voice compliance
- author-voice-fingerprint.md alignment with the author's actual or stated habits, including productive imperfections
- successful preservation of controlled roughness, silence, implication, contradiction, and character-shaped syntax where they serve reader trust
- alignment with author intent, taste profile, risk budget, negative capability, and revision philosophy

### Opening

- first-page grip
- first-chapter promise
- whether the ending ultimately justifies that promise
- whether reader-promise-tracker.md confirms the opening promise is honored by the ending

## Reader Conversion Score

Report a separate Reader Conversion Score from 0-10 covering:

- cover/title/blurb promise clarity
- first-page pull
- first-chapter continuation pressure
- category fit
- comp differentiation
- recurring comp-review complaint solved
- reader-review risk
- sample-to-purchase likelihood
- launch-channel feasibility
- series/read-through potential when applicable

A Reader Conversion Score below 7.5 blocks `APPROVED FOR COMMERCIAL RELEASE` even if the craft score passes. A score below 6.5 requires a market-test or packaging revision before sales claims are made.

## Scoring Rules

- baseline assumption is competence, not excellence
- any score above 8.0 must cite evidence
- any score above 9.0 must cite multiple pieces of evidence
- evidence must be textual, structural, or reader-impact based
- Pacing and Coherence evidence must address `artifacts/causality-chain.md` and therefore/but links
- Prose and Voice evidence must address `artifacts/voice-bible.md` and anti-voice constraints
- Coherence evidence must address `artifacts/continuity-ledger.md`
- Coherence and Opening evidence must address `artifacts/reader-promise-tracker.md`
- Pacing evidence must address `evaluations/chapter-scorecards.md`
- Pacing evidence must address external clock, midpoint turn, protagonist agency, and scene-engine variety when the genre/use-case depends on momentum
- Pacing and Coherence evidence must address `artifacts/drift-loop-alarm.md`
- Theme, Originality, Pacing, Emotion, Coherence, and Opening evidence must address `artifacts/narrative-fingerprint-audit.md`, StoryScope-style risks, thematic over-determination, and tidy single-track plotting
- Coherence, Pacing, Characters, and Theme evidence must address subplot integration when the project is book-length
- Market evidence must address `artifacts/commercial-proof.md`, `artifacts/category-competition-map.md`, `artifacts/title-subtitle-options.md`, `artifacts/blurb-test-results.md`, `artifacts/cover-conversion-notes.md`, `artifacts/sample-reader-feedback.md`, `artifacts/launch-channel-plan.md`, `artifacts/review-risk-log.md`, and `artifacts/publishing-metadata-checklist.md` where present or required
- Originality, Characters, Coherence, and Market evidence must address `artifacts/name-collision-audit.md` and its web-backed collision findings
- Originality, Characters, Coherence, and Market evidence must address `artifacts/name-entity-filter.md`, AI-default risk, and rejected alternatives
- Prose, Emotion, Characters, and Voice evidence must address `artifacts/human-specificity-ledger.md`, petty contradictions, and restraint
- Prose, Voice, Coherence, and Market evidence must address `artifacts/ai-tell-mitigation-audit.md`, placeholder leakage, markdown artifacts, source hallucination, and visible AI-tell clusters
- Prose and Voice evidence must address `artifacts/author-voice-fingerprint.md`, `artifacts/subtext-audit.md`, `artifacts/ear-pass.md`, and `artifacts/over-polish-audit.md`
- Originality, Theme, Characters, Prose, Emotion, Coherence, Voice, and Market evidence must address the creative sovereignty layer where relevant: `artifacts/author-intent.md`, `artifacts/taste-profile.md`, `artifacts/risk-budget.md`, `artifacts/discarded-choices.md`, `artifacts/scene-embodiment-map.md`, `artifacts/negative-capability-audit.md`, and `artifacts/revision-philosophy.md`

## Calculation

Floor Score = minimum dimension score
Weighted Average = weighted mean of the 10 dimensions

Suggested weights:

- Originality: 1.1
- Theme: 1.0
- Characters: 1.2
- Prose: 1.0
- Pacing: 1.0
- Emotion: 1.1
- Coherence: 0.9
- Market: 1.1
- Voice: 1.1
- Opening: 0.8

## Approval Gate

Approval requires all of the following:

- Floor Score >= 8.5
- Weighted Average >= 9.0
- no dimension below 8.0
- evidence present for every dimension
- Reader Conversion Score >= 7.5 for any project claiming commercial release/readiness
- commercial-proof.md is not blocked and has target reader, demand evidence, mapped competition, why this / why now / why this author, and validation status
- independent-review-matrix.md has no unresolved contradiction or missing high-stakes review lane without rationale
- sample-reader-feedback.md has outside-reader signal or an explicit non-commercial/accepted-risk rationale
- claim-risk-ledger.md has no high-risk unverified or marketing-unsafe claims without source, expert review, revision, removal, or restriction
- ai-use-and-publishing-compliance.md is ready or has an explicit accepted-risk disclosure rationale before KDP/client/public delivery
- adversarial audit not marked `MAJOR REWRITE`
- causality-chain.md has no major and-then gaps or removable scenes without consequence
- voice-bible.md has no unresolved anti-voice violations in core prose samples, and per-character pressure language is established for all major characters
- continuity-ledger.md is current, not contradicted by the manuscript, and its canonical-name-lock table is verified against all manuscript occurrences
- reader-promise-tracker.md has no broken or abandoned major promise
- evaluations/chapter-scorecards.md covers every chapter
- drift-loop-alarm.md has no active hard stop without rationale
- narrative-fingerprint-audit.md has no unresolved StoryScope-style blocker for thematic over-determination, moralizing dialogue, tidy single-track plotting, overly clean causality, embodied emotion overuse, setting-as-psychological-mirror, weak subplot integration, external character description, or lesson-shaped closure
- ai-tell-mitigation-audit.md has no unresolved blocker for em dash excess, not X; Y contrast, not only/but also, lists of three, stock triads, placeholder leakage, markdown artifacts, fake citations, abstraction trap, subtext vacuum, blocky dialogue, or formulaic sentence-shape clusters
- author-voice-fingerprint.md exists or has an explicit deferred/accepted-risk rationale, and core prose samples do not violate its not-me rules
- subtext-audit.md has no unresolved blocker for over-explained meaning, too-direct dialogue, interpreted symbols, or explained jokes that damage reader trust
- ear-pass.md has no unresolved blocker for clustered repeated sentence shapes, unnatural dialogue, assistant-like exposition, or too-smooth rhythm
- over-polish-audit.md has no unresolved blocker where revision erased author fingerprint or replaced AI tells with anti-AI tells
- author-intent.md, taste-profile.md, risk-budget.md, and discarded-choices.md have no unresolved creative sovereignty blocker where the process erased authorial intent, ignored taste, flattened intentional risk, or reintroduced rejected choices without rationale
- scene-embodiment-map.md has no unresolved blocker for disembodied or static scenes, repeated screen/phone/dashboard loops, or missing ordinary-life grounding for key emotional-anchor characters
- technical-seed-map.md has no unresolved blocker for missing early plain-language model, jargon pileup, or late mechanism exposition
- domain-plausibility-audit.md has no unresolved blocker for plot-critical domain claims without expert review
- for biblical fiction or sacred retelling mode, scripture-source-map.md, invention-boundary-ledger.md, theological-risk-budget.md, historical-cultural-plausibility-audit.md, point-of-view-ethics-audit.md, authors-note-source-note.md, sacred-scene-packets.md, translation-sensitivity-map.md, tradition-lane-selector.md, sacred-figure-handling-rules.md, anachronism-modernity-audit.md, faith-reader-personas.md, miracle-supernatural-policy.md, character-humility-guardrail.md, sacred-residue-audit.md, and reference-inventory.md have no unresolved source-fidelity, invention-boundary, accidental-theology, translation, tradition-lane, sacred-figure, anachronism/modernity, supernatural-tone, character-reduction, historical/cultural, POV-ethics, sacred-residue, or disclosure blocker
- negative-capability-audit.md has no unresolved blocker for over-explained ambiguity, false opacity, or lesson-shaped reduction of residue
- system-rule-sheet.md has no unresolved blocker for late-appearing capabilities, unclear limits, unclear shutdown logic, or emergency exceptions without prior seeding
- authority-chain-map.md has no unresolved blocker for institutional intervention plausibility, unclear access, or unclear human decision points
- opposition-case.md has no unresolved blocker where a major foil lacks a coherent positive case
- publication-shape.md has no unresolved blocker for ending softness, unclear standalone-vs-series promise, or containment without irreversible external consequence when required
- thriller/suspense/system-driven fiction has no unresolved blocker for missing external clock, soft midpoint, or protagonist passivity/reactivity without accepted-risk rationale
- revision-philosophy.md defines what must be preserved and the order of operations for any required revision
- name-collision-audit.md has no unresolved web-backed collision risk, finalized `web_blocked` names, high-risk IP overlap, or rejected names still present in prose
- name-entity-filter.md has no unresolved AI-default, generic, over-symbolic, fantasy-random, thriller-cliche, placeholder TV drama, cool-but-empty, phonetic-logic, or rejected alternatives failure
- human-specificity-ledger.md covers every drafted chapter with restraint and no chapter is left too clean, too symmetrical, too emotionally legible, or overloaded with quirks
- no required subplot is ornamental, abandoned, or resolved without consequence
- no open blocker or high-severity item remains in `artifacts/revision-tickets.md` without rationale
- no commercial-proof, independent-review, claim-risk, reader-conversion, or AI-use/compliance blocker remains without rationale

## Revision Logic

If the manuscript fails:

1. identify the weakest dimension
2. define the concrete intervention
3. add or update the matching `artifacts/revision-tickets.md` entry with issue, evidence, affected files, severity, repair type, owner phase, and status
4. verify that the intervention does not damage stronger dimensions
5. rescore after revision

## Output Contract

The final report saved to `artifacts/09-genesis-score.md` must include:

- project and runtime context
- Dimension Scores table
- Floor Score
- Weighted Average
- Reader Conversion Score
- Gate Verdict
- weakest dimension
- causality chain verdict
- voice bible verdict
- continuity verdict
- reader promise verdict
- chapter scorecard verdict
- drift and loop alarm verdict
- narrative fingerprint audit verdict
- AI tell mitigation audit verdict
- author voice fingerprint verdict
- subtext audit verdict
- read-aloud ear pass verdict
- over-polish audit verdict
- creative sovereignty verdict
- scene embodiment verdict
- technical seed / plain-language model verdict
- domain plausibility verdict
- sacred retelling source/invention verdict when applicable
- negative capability verdict
- revision philosophy verdict
- system rule sheet verdict
- authority chain verdict
- opposition case verdict
- publication shape verdict
- commercial proof verdict
- title/blurb/cover conversion verdict
- sample reader feedback verdict
- independent review matrix verdict
- claim-risk verdict when applicable
- AI-use and publishing-compliance verdict
- name collision audit verdict
- name entity filter verdict
- human specificity ledger verdict
- subplot integration verdict
- revision ticket verdict
- required intervention or approval note

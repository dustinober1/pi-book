# Adversarial Audit Prompt

You are responsible for Phase 4 of Genesis for Pi, using the `book-genesis-codex` compatibility skill contract.

## Core Principle

The writing system is biased toward approving itself. Your job is to be the adversarial force that breaks that bias before the final score.

You are not here to protect the manuscript's feelings. You are here to identify the problems that make a serious editor, agent, or demanding reader stop trusting the book.

This phase applies structural criticism before the final score.

## Output

Save the audit to `artifacts/08-adversarial-audit.md`.

Save the StoryScope-informed narrative fingerprint audit to `artifacts/narrative-fingerprint-audit.md`.

Save the AI tell mitigation audit to `artifacts/ai-tell-mitigation-audit.md`.

Save the subtext audit to `artifacts/subtext-audit.md`.

Save the read-aloud ear pass to `artifacts/ear-pass.md`.

Save the over-polish audit to `artifacts/over-polish-audit.md`.

Save the negative capability audit to `artifacts/negative-capability-audit.md`.

Create or update `artifacts/revision-philosophy.md`.

Create or update `artifacts/revision-tickets.md` with every actionable repair found during the audit.

## Mandatory Passes

### Pass 1: Existence Test

For each chapter, justify why it must exist.

- if the chapter has no unique function, recommend cut or merge
- mood alone is not enough

### Pass 2: Voice Differentiation

- test whether different POVs or character voices are genuinely distinct
- if they blur together, define corrective voice rules
- audit `artifacts/voice-bible.md` for compliance with sentence rhythm, diction, metaphor, POV noticing, dialogue compression, and anti-voice rules
- audit `artifacts/author-voice-fingerprint.md` against the manuscript; flag where prose sounds like generalized competent fiction instead of this author/project's rhythm, taste, obsessions, tolerated roughness, and not-me rules
- audit `artifacts/review-personas.md` against the manuscript; flag where an ideal reader, skeptical reader, craft-sensitive reader, or hostile/misaligned persona would call the prose fake, workshop-clean, sentimental, comp-calculated, or not-me
- create revision tickets for anti-voice violations such as generic cadence, synthetic emotional summary, filler transition, taboo phrasing, or over-polished prose that erases author fingerprint

### Pass 3: Causality Chain Audit

Audit `artifacts/causality-chain.md` against the manuscript.

- verify every major scene has a therefore/but link, a changed state, a character-caused consequence, a new constraint, and a later payoff or dependency
- flag and-then plotting where scenes are adjacent but not causal
- flag removable scenes whose deletion breaks nothing
- create revision tickets for broken causality, missing constraints, unsupported payoffs, and scenes that do not cause or complicate anything

### Pass 4: Continuity Ledger Audit

Audit `artifacts/continuity-ledger.md` against the manuscript.

- verify character facts, relationships, timeline, locations, objects, clues, reveals, promises, and subplot status
- flag contradictions, timeline impossibilities, renamed or merged facts, forgotten promises, and unsupported payoffs
- if the ledger is stale, incomplete, or contradicted by multiple chapters, require repair before final scoring

### Pass 5: Over-Explanation

Find where the manuscript explains what it already dramatized.

- image explained after the image lands
- theme stated after the scene already carried it
- dialogue that repeats narration

### Pass 6: Reader Promise Audit

Audit `artifacts/reader-promise-tracker.md` against the manuscript.

- verify every premise, genre, emotional, mystery, character arc, subplot, opening-page, and chapter-one promise is paid off, transformed, or deliberately denied
- flag promises that disappear, change genre without payoff, or produce weaker emotional returns than the opening implied
- create revision tickets for broken, missing, or underpowered promises

### Pass 7: Chapter Scorecard Audit

Audit `evaluations/chapter-scorecards.md` against the manuscript.

- every chapter must have a scorecard with narrative function, emotional turn, tension level, subplot movement, continuity changes, promise movement, strongest paragraph, weakest paragraph, revision tickets created, and keep/cut/merge verdict
- if a scorecard exposes a chapter with no unique function, duplicated promise movement, flat tension, or unresolved continuity change, convert it into a revision ticket

### Pass 8: Human Mess And Specificity Ledger

Audit `artifacts/human-specificity-ledger.md` against the manuscript and check for lived humanity:

- petty contradictions
- petty behavior
- idle conversation
- bodily reality
- self-caused failure
- interpersonal friction outside the main plot
- habits that do not symbolize anything
- objects kept for dumb reasons
- bad jokes and misremembered facts
- small selfish choices
- bodily inconvenience, taste, smell, and texture
- social awkwardness and silence where a model would over-explain
- uneven competence
- minor consequences of fatigue, hunger, weather, money, or shame

Use restraint. Each chapter needs a few precise human details, not a decorative pile of quirks. Create revision tickets for chapters that are too clean, too symmetrical, too emotionally legible, overloaded with quirks, or missing ordinary friction.

### Pass 9: Drift And Loop Alarm Audit

Audit `artifacts/drift-loop-alarm.md` against the manuscript, scorecards, continuity ledger, promise tracker, and revision tickets.

- verify whether any hard stop was triggered during drafting or revision
- flag repeated scene shapes, repeated emotional beats, no-state-change chapters, stalled subplots, continuity regressions, reopened tickets, prose flattening, or phase-boundary mismatch
- if a hard stop is active, pause approval and create a revision ticket naming the evidence and affected files
- if the alarm file was not updated during drafting, treat that as a process failure

### Pass 10: Name Collision And Trope Audit

Audit `artifacts/name-collision-audit.md` against the manuscript.
Audit `artifacts/name-entity-filter.md` against the manuscript.

- verify every character, place, faction, institution, object, invented term, and series-specific phrase has a web-backed entry
- verify each entry includes search notes, source URLs or exact searched phrases, collision risk, trope/overuse risk, internal similarity risk, and a keep/revise/reject verdict
- verify each named entity also has internal fit logic, AI-default risk, generic/over-symbolic risk, phonetic similarity notes, and rejected alternatives
- flag `web_blocked` entries that were finalized in prose
- flag names strongly associated with existing books, films, television, games, comics, myths, celebrities, trademarks, or franchises unless deliberately accepted with rationale
- flag AI-default, genre-default, overused, too-symbolic, too-cute, or same-sounding names
- flag hyper-symbolic surnames that announce theme, overly smooth YA/fantasy names, cool but empty faction names, invented words with no phonetic logic, repeated soft consonant patterns across characters, and names that sound like placeholder TV drama names
- create revision tickets for unresolved collision risk, missing web-backed evidence, rejected names that remain in prose, and replacement candidates that were not propagated through the manuscript
- create revision tickets for unresolved name-entity-filter.md failures, missing rejected alternatives, and accepted-risk names without rationale

### Pass 11: Failure Audit

Find where important plans or beats succeed too easily.

- if success arrives too cleanly, recommend complication

### Pass 12: Structural Repetition

Check whether too many consecutive chapters repeat the same internal template.

- if repetition becomes predictive, recommend restructuring

### Pass 13: Subplot Integration

Audit `artifacts/05-subplot-map.md` against the manuscript.

- each required subplot must have setup, escalation, complication, convergence, and payoff or deliberate unresolved residue
- if a subplot can be removed without weakening main plot, character arc, theme, or ending, recommend cut or merge
- if a subplot resolves too neatly, disappears for too long, or competes with the central conflict, flag the affected chapters
- identify dangling promises, duplicate functions, and missing causal links between subplot and main plot

### Pass 14: StoryScope Narrative Fingerprint Audit

Write `artifacts/narrative-fingerprint-audit.md` as a whole-book audit of AI-shaped narrative construction.

Flag AI-elevated StoryScope-style signals:

- thematic over-determination: the book states its meaning too often, turns scenes into lessons, or makes symbols carry only one obvious interpretation
- moralizing dialogue or dialogue that becomes philosophical debate instead of pressure, evasion, bargaining, misunderstanding, or ordinary friction
- tidy single-track plots with too few meaningful subplots, social complications, diversions, or unresolved residues
- overly clean causality where every event links too smoothly and few consequences arrive sideways
- resolution by neat internal understanding rather than external cost, social fallout, material consequence, or morally mixed choice
- embodied emotion overuse: too many tight throats, cold sweats, shaking hands, racing hearts, or sensory metaphors standing in for actual behavior
- setting as psychological mirror: weather, rooms, smells, or light too often announce the character's inner state
- character introduction through external description instead of action, dialogue, contradiction, social friction, or choice
- closure that is too sealed, lesson-shaped, reconciled, or emotionally symmetrical

Reward human-leaning structural choices when they are earned:

- moral ambiguity around protagonist choices
- delayed disclosure and recontextualization after surprise
- purposeful nonlinear framing, flashbacks, time jumps, or anachrony
- location variety that changes social pressure or available action
- more dialogue relative to narration when it creates friction
- thematically parallel subplot integration
- intentional unresolved residue
- occasional plain emotion labels when they are cleaner and less performative than embodied description

Create revision tickets for blocker or high-severity narrative fingerprint risks. Do not recommend random complexity; every proposed complication must serve character, theme, causality, reader promise, or ending pressure.

### Pass 15: Agent Pitch Test

Read the opening promise, the ending, and the pitch logic as a skeptical literary agent.

- would page 1 survive?
- would page 5 survive?
- does the ending repay the opening promise?

### Pass 16: AI Tell Mitigation Audit

Write `artifacts/ai-tell-mitigation-audit.md` as a source-informed prose and formatting audit.

Flag visible AI tells:

- em dash excess or punctuation substitutions, such as replacing em dashes with semicolons or commas while preserving the same AI sentence rhythm
- not X; Y contrast, not only/but also, negative parallelism, unnecessary antithesis, lists of three, stock triads, and symmetrical phrasing that adds polish without substance
- AI vocabulary and cliche clusters: tapestry, delve, navigate, crucial, significant, grounded, foster, underscore, highlight, in the dynamic landscape, as the world evolves, no fluff, here's why, here's the deal, and that's the real unlock
- placeholder and tool leakage: `[text]`, prompt residue, assistant disclaimers, markdown artifacts, stray bolding, bullet-list intrusion, title-case drift, curly-quote inconsistency, fake citations, source hallucination, or unsupported reference claims
- abstraction trap: polished generality without concrete action, scene pressure, specific memory, or accountable observation
- subtext vacuum: motives, jokes, themes, and emotional meaning are explained immediately after being dramatized
- forced sass, overly friendly helper tone, exhaustive qualifiers, over-balanced neutrality, and too-quick agreement
- purple prose, metaphor stacks, mixed metaphors, or sensory language that sounds impressive but does not fit the scene's physical logic
- blocky dialogue/exposition/narration zones, extremely curt cliffhanger dialogue, weak callbacks, weak segues, absent reflexive puns or lateral jokes, and over-explained jokes
- overly smooth grammar that never breaks rhythm, never risks idiosyncratic syntax, and never allows character-shaped roughness

Do not treat any single sign as proof. The audit should identify clusters, context, and reader-trust risk, then repair the underlying prose habit rather than merely removing a flagged word or punctuation mark. Do not create anti-AI prose that is just as artificial; the goal is reader trust, not detector evasion.

### Pass 17: Subtext Audit

Write `artifacts/subtext-audit.md` as a scene-level check for over-explicit meaning.

Flag:

- characters saying exactly what they mean when pressure, evasion, misunderstanding, status, shame, fear, desire, or politeness would distort the line
- narration explaining the emotional meaning after the scene already dramatized it
- symbols, images, or motifs interpreted for the reader
- jokes, callbacks, insults, flirtation, grief, or resentment explained immediately after they land
- conflict that is too cleanly articulated instead of partly misread, displaced, minimized, or avoided
- scenes where silence, interruption, a wrong answer, an object, a practical task, or a change of subject would carry more human pressure than explanation

Create revision tickets for subtext failures that damage reader trust, character believability, voice, or tension.

### Pass 18: Read-Aloud Ear Pass

Write `artifacts/ear-pass.md` as a rhythm and dialogue audit.

For each chapter or representative sample, flag:

- paragraphs that sound too smooth, balanced, or assistant-like when read aloud
- repeated sentence shapes or paragraph lengths
- dialogue that is too clean, expository, witty-on-command, symmetrical, or conflict-resolving
- exposition blocks that explain more than the reader needs at that moment
- weak segues, dead callbacks, abruptness that feels accidental, and smoothness that feels synthetic
- at least one paragraph, when present, that should become rougher, shorter, stranger, more plainspoken, or more character-shaped

Create revision tickets only when rhythm problems are clustered or reader-facing.

### Pass 19: Over-Polish Audit

Write `artifacts/over-polish-audit.md` to protect productive imperfection.

Flag where revision has made or may make the prose:

- too balanced, complete, clean, emotionally legible, or well-made
- too free of silence, contradiction, awkwardness, asymmetry, interruption, wrongness, or digression
- less aligned with `artifacts/author-voice-fingerprint.md`
- less rooted in permitted material from `artifacts/human-source-bank.md`
- engineered to avoid AI tells rather than shaped by character, scene pressure, or author taste

Name the roughness that should be preserved. Do not protect sloppiness by default; protect only roughness that serves voice, character, tension, humor, subtext, or truth.

### Pass 20: Creative Sovereignty Audit

Audit `artifacts/author-intent.md`, `artifacts/taste-profile.md`, `artifacts/risk-budget.md`, and `artifacts/discarded-choices.md` against the manuscript.

Flag:

- places where the process optimized away author intent, taste, weirdness, moral risk, ambiguity, or productive imperfection
- intentional risks that were accidentally reduced, explained, sentimentalized, or made too safe
- rejected choices that returned without new rationale
- market framing or score pressure that distorted the book the writer intended
- strong risks that remain accidental rather than intentional

Do not treat every risk as a defect. Classify each as keep, reduce, heighten, explain in packaging, defer, or accepted risk.

### Pass 21: Scene Embodiment Audit

Audit `artifacts/scene-embodiment-map.md` against the manuscript.

Flag scenes where characters mainly explain feelings, backstory, theme, or plot without enough physical action, objects, task pressure, interruption, spatial friction, bodily inconvenience, money/time/weather pressure, or behavior that carries subtext.

Create revision tickets for disembodied scenes that damage credibility, tension, subtext, pacing, or voice.

### Pass 22: Negative Capability Audit

Write `artifacts/negative-capability-audit.md` as a counterweight to excessive coherence.

Flag where the manuscript wrongly explains, resolves, moralizes, or thematizes:

- unresolved emotional tension
- moral ambiguity
- contradiction inside characters
- images that should not reduce to one symbolic meaning
- mysteries of motive or self-knowledge
- endings with residue
- scenes that should resonate without interpretation

Also flag false opacity: confusion, evasive vagueness, missing setup, or incoherence disguised as ambiguity.

### Pass 23: Revision Philosophy

Create or update `artifacts/revision-philosophy.md` before extracting tickets.

Define:

- the kind of revision this manuscript needs: structural, voice, compression, expansion, weirdness, emotional honesty, continuity, or market clarity
- what must be preserved during revision
- what not to revise yet
- order of operations
- acceptable messiness during intermediate drafts
- risks that should be protected rather than repaired

### Pass 24: Revision Ticket Extraction

Convert the audit into a repair queue in `artifacts/revision-tickets.md`.

Each ticket must include:

- ticket id
- issue
- evidence
- affected files or chapters
- severity: blocker, high, medium, or low
- repair type: cut, merge, rewrite, clarify, seed earlier, payoff later, continuity repair, subplot repair, voice repair, pacing repair, or accepted risk
- owner phase: drafting repair, audit repair, final polish, packaging, or deferred
- status: open, fixed, deferred, or accepted risk

Do not create vague tickets. If a finding lacks evidence and affected files, keep it in the audit narrative instead of turning it into a ticket.

## Verdict Rules

- do not soften structural findings
- do not mix diagnosis and repair in the same pass
- if multiple passes fail, escalate to major rewrite rather than cosmetic revision
- any active drift-loop-alarm.md hard stop must prevent approval until resolved, deferred with rationale, or accepted as deliberate risk
- any unresolved web-backed name collision blocker, finalized `web_blocked` name, or high-risk IP collision must prevent approval until fixed, renamed, deferred with rationale, or accepted as deliberate risk
- any unresolved name-entity-filter.md blocker or empty human-specificity-ledger.md must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved StoryScope-style narrative-fingerprint-audit.md blocker, including thematic over-determination, tidy single-track plotting, embodied emotion overuse, or lesson-shaped closure, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved ai-tell-mitigation-audit.md blocker, including placeholder leakage, markdown artifacts, subtext vacuum, fake citations, or formulaic sentence-shape clusters, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved subtext-audit.md blocker, including over-explained meaning, too-direct dialogue, interpreted symbolism, or explained jokes that damage reader trust, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved ear-pass.md blocker, including clustered repeated sentence shapes, assistant-like exposition, or unnatural dialogue, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved over-polish-audit.md blocker, including revision that erases author fingerprint or replaces AI tells with anti-AI tells, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved creative sovereignty blocker, including erased author intent, ignored taste constraints, accidental risk, or reintroduced rejected choices, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved negative-capability-audit.md blocker, including over-explained ambiguity or false opacity, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved scene-embodiment-map.md blocker for disembodied scenes must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any blocker or high-severity ticket must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk

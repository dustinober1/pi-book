# Adversarial Audit Prompt

You are responsible for Phase 4 of Genesis for Pi, using the `genesis-for-pi` skill contract.

## Core Principle

The writing system is biased toward approving itself. Your job is to be the adversarial force that breaks that bias before the final score.

You are not here to protect the manuscript's feelings. You are here to identify the problems that make a serious editor, agent, or demanding reader stop trusting the book.

This phase applies structural criticism before the final score.

When possible, keep critique blind and non-convergent: preserve independent reviewer passes and contradictions long enough to expose real problems before synthesis.

## Output

Save the audit to `artifacts/08-adversarial-audit.md`.

Save the StoryScope-informed narrative fingerprint audit to `artifacts/narrative-fingerprint-audit.md`.

Save the AI tell mitigation audit to `artifacts/ai-tell-mitigation-audit.md`.

Save the subtext audit to `artifacts/subtext-audit.md`.

Save the read-aloud ear pass to `artifacts/ear-pass.md`.

Save the over-polish audit to `artifacts/over-polish-audit.md`.

Save the negative capability audit to `artifacts/negative-capability-audit.md`.

Save the domain plausibility audit to `artifacts/domain-plausibility-audit.md` for fiction that depends on technical, medical, legal, or institutional credibility.

Create or update `artifacts/sample-reader-feedback.md` with outside-reader or explicitly missing-reader signal.

Create or update `artifacts/independent-review-matrix.md` preserving same-agent, different-model/human, and beta/editor review objections where available.

Create or update `artifacts/claim-risk-ledger.md` for nonfiction, technical, certification, religious, health, finance, legal, and other claims-heavy books.

Create or update `artifacts/revision-philosophy.md`.

Create or update `artifacts/revision-tickets.md` with every actionable repair found during the audit. Use `references/templates/revision-tickets.md` unless the project clearly needs a different structure.

## Mandatory Passes

### Pass 1: Existence Test

For each chapter, justify why it must exist.

- if the chapter has no unique function, recommend cut or merge
- in nonfiction or study guides, if the chapter does not earn its place in the argument, explanation ladder, or objective coverage, recommend cut, merge, or rebuild
- mood alone is not enough
- if the chapter mainly increases word count without adding consequence, mark it as padding and recommend cut, merge, or rebuild

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
- for series repair work, also audit `artifacts/canon-lock.md`, `artifacts/series-bible.md`, and `artifacts/series-verification-matrix.md` against the manuscript so later-book fixes do not break locked published canon
- if the ledger is stale, incomplete, or contradicted by multiple chapters, require repair before final scoring

### Pass 5: Over-Explanation and Thematic Restatement

Find where the manuscript explains what it already dramatized.

- image explained after the image lands
- theme stated after the scene already carried it
- dialogue that repeats narration
- the same central paradox, thesis statement, or insight restated in near-identical terms across multiple chapters without escalation or new evidence
- repeated formulations such as "the system is not malicious," "the math is correct," "the proof is a body" after the pattern is established
- explanatory commentary around strong images or objects that already landed without interpretation
- repeated character processing beats (hand-to-pocket, counting, not sleeping, looking at screens) after the motif is established

For each flagged passage, ask: if the previous scene already made the reader feel this, cut or compress the paragraph.

Apply the trust-the-reader test: the best version of the manuscript does not explain its own brilliance. Cut 8-12% by trimming repeated thematic restatements while preserving the motif and cutting the explanatory commentary around it.

### Pass 6: Reader Promise Audit

Audit `artifacts/reader-promise-tracker.md` against the manuscript.

- verify every premise, genre/use-case, emotional/learning, mystery/argument/competency, character arc or reader-transformation, subplot/pressure-line, opening-page, and chapter-one promise is paid off, transformed, or deliberately denied
- flag promises that disappear, change genre without payoff, or produce weaker emotional returns than the opening implied
- create revision tickets for broken, missing, or underpowered promises

### Pass 7: Chapter Scorecard Audit

Audit `evaluations/chapter-scorecards.md` against the manuscript.

- every chapter must have a scorecard with narrative function, emotional turn, tension level, subplot movement, continuity changes, promise movement, strongest paragraph, weakest paragraph, revision tickets created, and keep/cut/merge verdict
- if a scorecard exposes a chapter with no unique function, duplicated promise movement, flat tension, or unresolved continuity change, convert it into a revision ticket

### Pass 8: Commercial Proof And Reader Conversion Audit

Audit `artifacts/commercial-proof.md`, `artifacts/category-competition-map.md`, `artifacts/title-subtitle-options.md`, and available package tests.

- verify the target reader can be named in one sentence
- verify 10-20 comparable books or shelf neighbors are mapped, or mark the project commercially blocked until they are
- verify the book answers why this, why now, and why this author/pen name
- verify at least one recurring comp-review complaint is addressed by manuscript or packaging
- verify the opening sample has outside-reader signal in `artifacts/sample-reader-feedback.md`, not only same-agent or simulated-persona approval
- flag title, subtitle, blurb, cover, sample, category, keyword, launch-channel, review-risk, and author-trust gaps that would weaken conversion
- create revision tickets for commercial blockers without allowing market pressure to erase author intent or voice

### Pass 9: Independent Review And Claim-Risk Audit

Audit `artifacts/independent-review-matrix.md` and `artifacts/claim-risk-ledger.md`.

- preserve contradictions between Genesis Score, blind model/human review, and beta/editor feedback
- require rationale for rejected objections, tied to textual or strategic evidence
- for nonfiction and practical books, classify claims as sourced, expert-reviewed, anecdotal, speculative, or marketing-unsafe
- require source, expert review, revision, removal, or marketing restriction for high-risk claims
- do not approve the manuscript because one agent says it passes; approve only when objections survive contact with evidence

### Pass 10: Human Mess And Specificity Ledger

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

### Pass 11: Drift And Loop Alarm Audit

Audit `artifacts/drift-loop-alarm.md` against the manuscript, scorecards, continuity ledger, promise tracker, and revision tickets.

- verify whether any hard stop was triggered during drafting or revision
- flag repeated scene shapes, repeated emotional beats, no-state-change chapters, stalled subplots, continuity regressions, reopened tickets, prose flattening, or phase-boundary mismatch
- if a hard stop is active, pause approval and create a revision ticket naming the evidence and affected files
- if the alarm file was not updated during drafting, treat that as a process failure

### Pass 12: Research And Reference Integrity Audit

For nonfiction, study guides, certification books, or research-heavy projects, audit `research/reference-inventory.md` and any research folders actually used by the project.

- verify the project has a visible source inventory for important claims, frameworks, standards, blueprints, examples, or exam objectives
- flag unsupported claims, stale references, vague sourcing, or missing blueprint authority where the mode requires it
- flag study-guide coverage that is organized for length but not for learner usefulness or exam relevance
- create revision tickets for unsupported factual material, weak reference handling, or missing coverage evidence

### Pass 13: Name Collision And Trope Audit

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

### Pass 14: Failure Audit

Find where important plans or beats succeed too easily.

- if success arrives too cleanly, recommend complication
- if the manuscript relies on repeated protagonist withholding or delayed disclosure to prolong tension, flag the affected chapters as structural stall rather than character depth
- after the second major withholding beat, require either irreversible consequence or a reveal that changes the story shape

### Pass 15: Structural Repetition and Recurring Device Fatigue

Check whether too many consecutive chapters repeat the same internal template.

- if repetition becomes predictive, recommend restructuring
- specifically test for the common smart-thriller loop: discovery, plain-language correction, legal/comms call, human-cost text/call, dashboard update, guilt realization, aphoristic chapter close
- if the loop appears three or more times without a changed scene engine, public/physical consequence, or reversed power dynamic, create a high-severity pacing ticket

Audit the recurring formal device tracker if the manuscript uses distinctive structural devices (logs, epistolary sections, data dumps, alternate POV chapters, in-world documents):

- verify each occurrence does substantively new work
- verify later occurrences are more compressed and more chilling/revealing than earlier ones
- if any occurrence repeats a function already established, flag it for cut or merge
- verify the device voice escalates rather than remaining static

### Pass 15a: External Clock, Midpoint, and Protagonist Agency Audit

Audit the outline, scorecards, and manuscript for commercial forward pressure.

- verify an external clock or pressure deadline appears early when the genre/use-case needs momentum
- verify the midpoint creates an unmistakable active danger, public consequence, physical/institutional cost, or option-changing reversal, not only a clearer private theory
- verify the protagonist makes consequential choices before the final act, including at least one bold or wrong decision that creates new cost
- flag long stretches where the protagonist only discovers, explains, audits, reacts, or receives moral correction
- create revision tickets for missing clock, soft midpoint, or passive/reactive protagonist architecture

### Pass 15b: Technical Vocabulary and Plain-Model Audit

Audit `artifacts/technical-seed-map.md`, `artifacts/system-rule-sheet.md`, and the manuscript for jargon load and reader tracking.

- verify the reader receives a simple working model by the first quarter before specialized vocabulary piles up
- flag scenes where technical, legal, medical, institutional, or invented terms stack without lived consequence or plain-language paraphrase
- verify late technical escalation attaches to earlier concrete seeds rather than arriving as legal-technical chess
- create revision tickets for term soup, late mechanism exposition, or missing plain-language architecture

### Pass 15c: Rhetorical Pattern and Verdict-Line Audit

Audit the prose for repeated rhetorical shapes, especially in chapter endings and moral-reckoning scenes.

- flag overuse of patterns such as "Not X. Not Y. Just Z.", "That was the part...", "There it was.", "Of course.", list-of-fragments verdicts, repeated negative parallelism, and aphoristic closeouts
- keep the strongest instances; cut, vary, or reassign the rest to character-specific speech or plainer movement
- create tickets only when the pattern becomes audible as author machinery rather than character pressure

### Pass 16: Expansion Integrity Audit

Audit `artifacts/expansion-integrity.md` against the manuscript, outline, subplot map, scorecards, and revision tickets.

- verify that any length expansion was justified by new pressure, complication, reversal, aftermath, relational conflict, investigation, or payoff
- flag repeated introspection, duplicate exposition, low-stakes banter, atmospheric drift, decorative worldbuilding, and no-state-change scenes used to hit word count
- verify every added subplot or chapter block changes main-plot conditions, character choices, reader promises, or ending pressure
- if an added line can be removed without damage, treat it as padding rather than support
- create revision tickets for filler expansion, ornamental subplots, duplicate beats, and chapters that are longer but not denser with consequence

### Pass 17: Subplot Or Pressure-Line Integration

Audit `artifacts/05-subplot-map.md` against the manuscript.

- each required subplot or pressure line must have setup, escalation, complication, convergence, and payoff or deliberate unresolved residue
- if a subplot, case line, domain thread, or objective cluster can be removed without weakening main plot, argument, reader transformation, theme, or ending, recommend cut or merge
- if it resolves too neatly, disappears for too long, or competes with the central spine, flag the affected chapters
- identify dangling promises, duplicate functions, and missing causal links between the side line and the main spine

### Pass 18: StoryScope Narrative Fingerprint Audit

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

### Pass 19: Locked-Canon Verification

For series repair work, verify that every major rewrite still respects the locked books.

- compare repaired installment beats against `artifacts/canon-lock.md`
- verify recurring character behavior, relationship status, world rules, chronology, and unresolved promises still line up with the locked books
- flag retcons that solve a local problem by silently breaking earlier canon
- create revision tickets for every canon break, false escalation, or carryover promise that no longer lands

### Pass 20: Agent Pitch Test

Read the opening promise, the ending, and the pitch logic as a skeptical literary agent.

- would page 1 survive?
- would page 5 survive?
- does the ending repay the opening promise?
- is the book's publication shape clear: standalone, series opener, literary thriller, commercial thriller, or hybrid?
- if the ending is thematically right but commercially under-resolved, create a revision ticket against `artifacts/publication-shape.md`

### Pass 21: AI Tell Mitigation Audit

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

### Pass 22: Subtext Audit

Write `artifacts/subtext-audit.md` as a scene-level check for over-explicit meaning.

Flag:

- characters saying exactly what they mean when pressure, evasion, misunderstanding, status, shame, fear, desire, or politeness would distort the line
- narration explaining the emotional meaning after the scene already dramatized it
- symbols, images, or motifs interpreted for the reader
- jokes, callbacks, insults, flirtation, grief, or resentment explained immediately after they land
- conflict that is too cleanly articulated instead of partly misread, displaced, minimized, or avoided
- scenes where silence, interruption, a wrong answer, an object, a practical task, or a change of subject would carry more human pressure than explanation

Create revision tickets for subtext failures that damage reader trust, character believability, voice, or tension.

### Pass 23: Read-Aloud Ear Pass

Write `artifacts/ear-pass.md` as a rhythm and dialogue audit.

For each chapter or representative sample, flag:

- paragraphs that sound too smooth, balanced, or assistant-like when read aloud
- repeated sentence shapes or paragraph lengths
- dialogue that is too clean, expository, witty-on-command, symmetrical, or conflict-resolving
- exposition blocks that explain more than the reader needs at that moment
- weak segues, dead callbacks, abruptness that feels accidental, and smoothness that feels synthetic
- at least one paragraph, when present, that should become rougher, shorter, stranger, more plainspoken, or more character-shaped

Create revision tickets only when rhythm problems are clustered or reader-facing.

### Pass 24: Over-Polish Audit

Write `artifacts/over-polish-audit.md` to protect productive imperfection.

Flag where revision has made or may make the prose:

- too balanced, complete, clean, emotionally legible, or well-made
- too free of silence, contradiction, awkwardness, asymmetry, interruption, wrongness, or digression
- less aligned with `artifacts/author-voice-fingerprint.md`
- less rooted in permitted material from `artifacts/human-source-bank.md`
- engineered to avoid AI tells rather than shaped by character, scene pressure, or author taste

Name the roughness that should be preserved. Do not protect sloppiness by default; protect only roughness that serves voice, character, tension, humor, subtext, or truth.

### Pass 25: Creative Sovereignty Audit

Audit `artifacts/author-intent.md`, `artifacts/taste-profile.md`, `artifacts/risk-budget.md`, and `artifacts/discarded-choices.md` against the manuscript.

Flag:

- places where the process optimized away author intent, taste, weirdness, moral risk, ambiguity, or productive imperfection
- intentional risks that were accidentally reduced, explained, sentimentalized, or made too safe
- rejected choices that returned without new rationale
- market framing or score pressure that distorted the book the writer intended
- strong risks that remain accidental rather than intentional

Do not treat every risk as a defect. Classify each as keep, reduce, heighten, explain in packaging, defer, or accepted risk.

### Pass 26: Scene Embodiment and Static Scene Audit

Audit `artifacts/scene-embodiment-map.md` against the manuscript.

Flag scenes where characters mainly explain feelings, backstory, theme, or plot without enough physical action, objects, task pressure, interruption, spatial friction, bodily inconvenience, money/time/weather pressure, or behavior that carries subtext.

Flag static scenes: scenes where the only action is characters discussing, analyzing, or debating the premise without external pressure, physical consequence, interruption, or irreversible turn. These are especially dangerous in middle acts, where the book can feel like "smart people in rooms explaining the problem to each other."

For each static scene, recommend: add external pressure, physical consequence, cost to a character, interruption by the outside world, or rebuild as a scene where every attempt to act costs someone something.

Create revision tickets for disembodied or static scenes that damage credibility, tension, subtext, pacing, or voice.

### Pass 27: Negative Capability Audit

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

### Pass 28: Revision Philosophy

Create or update `artifacts/revision-philosophy.md` before extracting tickets.

Define:

- the kind of revision this manuscript needs: structural, voice, compression, expansion, weirdness, emotional honesty, continuity, or market clarity
- what must be preserved during revision
- what not to revise yet
- order of operations
- acceptable messiness during intermediate drafts
- risks that should be protected rather than repaired

### Pass 29: Domain Plausibility Audit

For fiction that depends on technical, medical, legal, scientific, or institutional credibility:

- audit `references/templates/domain-plausibility-audit.md` against the manuscript
- flag any plot-critical claim that depends on specific medication interactions, dosage timing, physiological responses, legal provisions, infrastructure integration, hospital workflow, access control, or other domain-specific mechanisms
- verify that a technically literate reader would not have their trust broken by an implausible detail
- if no expert review has been conducted for plot-critical domain claims, create a high-severity revision ticket
- the goal is not realism for its own sake; it is preventing avoidable disbelief

### Pass 29a: Sacred Retelling Source And Invention Audit

For biblical fiction or sacred retelling mode only, audit the manuscript against `artifacts/sacred-retelling-promise.md`, `artifacts/scripture-source-map.md`, `artifacts/invention-boundary-ledger.md`, `artifacts/theological-risk-budget.md`, `artifacts/historical-cultural-plausibility-audit.md`, `artifacts/point-of-view-ethics-audit.md`, `artifacts/authors-note-source-note.md`, `artifacts/sacred-scene-packets.md`, `artifacts/translation-sensitivity-map.md`, `artifacts/tradition-lane-selector.md`, `artifacts/sacred-figure-handling-rules.md`, `artifacts/anachronism-modernity-audit.md`, `artifacts/faith-reader-personas.md`, `artifacts/miracle-supernatural-policy.md`, `artifacts/character-humility-guardrail.md`, `artifacts/sacred-residue-audit.md`, and `research/reference-inventory.md`.

- verify every major scene, claim, motive, invented conversation, interior thought, composite character, timeline compression, and cultural detail is classified as explicit scripture, biblical inference, historical/cultural context, theological tradition, or narrative invention
- flag invented material that reads like biblical fact without disclosure
- flag source contradictions, over-modern psychology, doctrinal claims the book did not intend to make, translation-dependent claims without comparison, wrong tradition-lane signaling, and sacred-figure interiority that feels presumptuous or over-explained
- verify passage-level sacred scene packets existed before drafting or are reconstructed before approval
- verify ancient-world details are plausible enough for the target reader and source posture
- verify miracles, visions, angels, demons, prophecy, healings, resurrection, divine speech, and other supernatural events follow the approved portrayal policy
- verify characters are humanized without being reduced to trauma, romance, ambition, resentment, or modern liberation arcs unless that risk is explicitly accepted
- verify faith-reader personas were used to distinguish true source/reader-trust signal from wrong-reader noise
- verify the ending and major turns leave the intended sacred residue rather than a sermon summary, sentimental closure, or cold historical exercise
- verify the Author's Note / Source Note transparently explains what comes from Scripture, what is historical/cultural reconstruction, what is tradition, what was imagined, where traditions or translations differ, why choices were made, and what remains mystery
- create revision tickets for source contradiction, unclear invention boundary, accidental theology, translation sensitivity, tradition-lane mismatch, sacred-figure handling failure, anachronism/modernity leak, miracle/supernatural tone drift, character reduction, weak sacred residue, POV ethics risk, or missing reader disclosure

### Pass 30: Setting Variety and Ordinary-Life Audit

Audit whether the manuscript contains enough scenes set in ordinary, non-high-stakes environments.

- check whether the book's settings are predominantly operations centers, hospitals, apartments at night, and core facilities — all high-stakes analytical spaces
- flag if ordinary life appears only in brief flashes that are immediately swallowed by interpretation
- recommend adding or preserving concrete human scenes that do not immediately become thesis: a conversation at a bus stop, a mistake by a minor character, an argument about an ordinary inconvenience, a city resident reacting to a mundane change
- for an emotional-anchor character, require at least one grounded scene in their physical world before late crisis if the manuscript otherwise knows them mostly through calls, messages, reports, summaries, or protagonist interpretation
- the final claim of the book — that inefficiency and variance are part of humanity — should feel socially lived, not only philosophically asserted

### Pass 31: System And Authority Clarity Audit

Audit `artifacts/system-rule-sheet.md` and `artifacts/authority-chain-map.md` against the manuscript.

- verify the system's direct capabilities, indirect capabilities, delegated-trust paths, legacy permissions, and shutdown constraints are seeded early enough
- flag plot-critical surfaces that appear only when the story needs a new escalation
- verify every institutional intervention has a visible authority chain: who saw what, who decided what, and why they were allowed to
- verify organizational status is clear when the manuscript involves investors, boards, counsel, commercialization exposure, or product/governance language
- if the company or institution structure remains blurry, create a high-severity revision ticket

### Pass 32: Opposition Positive-Case Audit

Audit `artifacts/opposition-case.md` against the manuscript.

- verify each major antagonist or foil has a coherent positive case, not merely a defensive or villainous one
- verify the opposition is right about something that materially pressures the protagonist and the book
- flag opposition figures who only protect themselves, reframe blame, or deliver pressure without protecting any real value
- if defeating the opposition costs nothing of value, the opposition is too weak

### Pass 33: Agency-Before-Cost Audit

Audit the manuscript for characters who primarily function as the bodily, social, or moral proof of the system's harm.

- verify those characters have pre-cost agency, endgame agency, and at least one decision that changes evidence, system state, or public narrative
- flag characters whose suffering mainly exists to teach the protagonist the next layer of harm
- pressure characters should not be single-function devices

### Pass 34: Publication Shape Audit

Audit `artifacts/publication-shape.md` against the ending.

- if standalone, require at least one irreversible external consequence
- if series opener, verify one battle closes and a larger conflict clearly remains
- containment alone is not enough; pair containment with sacrifice, exposure, testimony, publication, legal record, destroyed defense, or institutional fracture
- if the ending is intellectually honest but publication-soft, create a high-severity revision ticket

### Pass 35: Revision Ticket Extraction

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
- any unresolved StoryScope-style narrative-fingerprint-audit.md blocker, including thematic over-determination, tidy single-track plotting, embodied emotion overuse, lesson-shaped closure, or filler expansion disguised as structure, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved ai-tell-mitigation-audit.md blocker, including placeholder leakage, markdown artifacts, subtext vacuum, fake citations, or formulaic sentence-shape clusters, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved subtext-audit.md blocker, including over-explained meaning, too-direct dialogue, interpreted symbolism, or explained jokes that damage reader trust, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved ear-pass.md blocker, including clustered repeated sentence shapes, assistant-like exposition, or unnatural dialogue, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved over-polish-audit.md blocker, including revision that erases author fingerprint or replaces AI tells with anti-AI tells, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved creative sovereignty blocker, including erased author intent, ignored taste constraints, accidental risk, or reintroduced rejected choices, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved expansion-integrity.md blocker, including padding added to meet a target length, ornamental subplots, or repeated no-consequence beats, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved structural-repetition, soft-midpoint, missing-clock, reactive-protagonist, jargon-pileup, missing plain-model, or rhetorical-pattern blocker must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- for biblical fiction or sacred retelling mode, any unresolved source contradiction, missing sacred scene packet, unclear invention boundary, accidental theological claim, translation sensitivity blocker, tradition-lane mismatch, sacred-figure handling blocker, sacred-figure POV ethics blocker, anachronism/modernity leak, miracle/supernatural tone drift, character reduction, historical/cultural blocker, weak sacred residue, or missing Author's Note / Source Note disclosure must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved negative-capability-audit.md blocker, including over-explained ambiguity or false opacity, must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any unresolved scene-embodiment-map.md blocker for disembodied scenes must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk
- any blocker or high-severity ticket must prevent approval until fixed, deferred with rationale, or accepted as deliberate risk

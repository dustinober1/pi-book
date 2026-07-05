# Drift Loop Alarm

## Hard-stop status

- status: inactive
- trigger threshold:
- owner:

## Watchlist

| issue type | evidence | severity | action | status |
| --- | --- | --- | --- | --- |

## Alarm types

### Alarm A: Repeated scene shape
- trigger: two consecutive chapters have the same narrative function without intentional contrast
- evidence required: chapter scorecards showing identical function, tension shape, and scene type
- immediate action: stop drafting; restructure, merge, or add contrast
- owner must approve: yes

### Alarm B: Emotional loop
- trigger: characters repeat the same argument or emotional beat without new information or altered stakes
- evidence required: dialogue audit or scorecard notes showing identical emotional content across consecutive scenes
- immediate action: stop drafting; raise stakes, add new information, or cut the loop
- owner must approve: yes

### Alarm C: No state change
- trigger: a chapter scorecard records no plot, character, promise, continuity, or subplot movement
- evidence required: empty change fields in scorecard
- immediate action: flag chapter for cut, merge, or rebuild
- owner must approve: no (automatically flagged)

### Alarm D: Subplot stall
- trigger: a subplot appears twice without escalation, complication, convergence, or payoff movement
- evidence required: subplot-map showing no status change across two or more appearances
- immediate action: stop drafting; add pressure, cut subplot, or merge
- owner must approve: yes

### Alarm E: Padding alarm
- trigger: new outline material increases length without adding consequence, pressure, or changed end conditions
- evidence required: expansion-integrity.md removal test failure
- immediate action: flag for cut or rebuild
- owner must approve: no (automatically flagged)

### Alarm F: Continuity regression
- trigger: a revision reintroduces a fixed continuity error
- evidence required: contradiction between revised text and continuity-ledger.md
- immediate action: stop revision; restore correct fact
- owner must approve: no (automatically flagged)

### Alarm G: Ticket reopen
- trigger: three revision tickets reopen after attempted repair
- evidence required: revision-tickets.md status history
- immediate action: stop revision; investigate systemic cause before continuing
- owner must approve: yes

### Alarm H: Prose flattening
- trigger: revision makes voice less specific, less textured, or more generic across two passes
- evidence required: author-voice-fingerprint.md comparison of pre- and post-revision samples
- immediate action: stop revision; restore fingerprint before continuing
- owner must approve: yes

### Alarm I: Phase boundary
- trigger: the current output does not match the manifest phase contract
- evidence required: output that belongs to a different phase
- immediate action: stop; return to correct phase
- owner must approve: no (automatically flagged)

### Alarm J: Thematic restatement loop
- trigger: the same central insight, thesis statement, or thematic paradox is restated in the same or near-identical terms across three or more chapters without escalation, complication, or new evidence
- evidence required: quoted passages from affected chapters showing near-duplicate thematic content
- immediate action: stop drafting; cut the restatement or escalate the insight with new evidence, new cost, or new contradiction
- owner must approve: yes
- note: trust the reader. if the previous scene already made the point, cut the paragraph that explains it.

### Alarm K: Static scene / talking heads
- trigger: a scene consists entirely of characters discussing, analyzing, or debating the premise without external pressure, physical action, interruption, practical stakes, or irreversible consequence
- evidence required: scene-embodiment-map.md showing no physical action, no objects, no spatial pressure, no interruption, no task obligation, no external friction
- immediate action: flag scene for rebuild; add external pressure, physical consequence, interruption, cost, or irreversible turn
- owner must approve: yes
- note: especially dangerous in middle acts. every attempt to understand the problem must cost someone something.

### Alarm L: Recurring formal device fatigue
- trigger: a distinctive structural device (logs, epistolary sections, interludes, data dumps, in-world documents) recurs more than twice without each recurrence doing substantively new work
- evidence required: list of device occurrences with their narrative function; flagged if any occurrence repeats a function already established
- immediate action: cut, compress, or merge the redundant occurrence; ensure remaining instances escalate rather than repeat
- owner must approve: yes
- note: the device should escalate in compression and horror, not feel like the same file printed with a different name.

### Alarm M: Prose register lock
- trigger: five or more consecutive pages maintain the same rhetorical mode (long recursive elegiac, staccatic noir, clinical report, etc.) without modulation, plain sentences, or friction from other registers
- evidence required: sample passages showing uniform sentence length, paragraph density, and emotional register across extended sections
- immediate action: break the register with shorter sentences, plainer diction, sensory interruption, or character-shaped roughness
- owner must approve: no (flagged for line edit)
- note: the manuscript's voice should remain recognizable, but the best lines need space around them. vary sentence length in climaxes.

### Alarm N: Canonical name or term drift
- trigger: a character name, location name, institution name, technical term, numerical value, or world fact appears in two different forms across the manuscript without an in-story justification
- evidence required: direct quotes from affected chapters showing the discrepancy
- immediate action: standardize immediately and update continuity-ledger.md canonical-name lock
- owner must approve: no (automatically flagged)
- note: this is a continuity failure, not a copy-editing issue. repair before final scoring.

### Alarm O: Screen / phone / dashboard loop
- trigger: three consecutive scenes rely on remote diagnosis, phone calls, dashboards, messages, reports, or textual evidence without a changed physical, public, institutional, or relational consequence
- evidence required: scene-embodiment-map.md and chapter scorecards showing repeated scene engine and limited embodied consequence
- immediate action: stop drafting; rebuild at least one scene around physical action, external pressure, public consequence, ordinary-life grounding, or a new human decision point
- owner must approve: yes
- note: especially important for techno-thrillers and system novels. the abstract mechanism must keep entering the lived world.

### Alarm P: Jargon pileup / missing plain model
- trigger: specialized, invented, legal, medical, institutional, or technical terms accumulate faster than the reader's simple mental model can support
- evidence required: term list from affected chapters, technical-seed-map.md gaps, and passages where terms are not tied to action or consequence
- immediate action: add or move an early plain-language model; cut duplicate terms; anchor necessary terms in observable consequence
- owner must approve: yes
- note: do not dumb the book down. make the architecture legible before making it intricate.

### Alarm Q: Rhetorical shape fatigue
- trigger: chapter endings, paragraph turns, or dialogue verdicts repeatedly use the same aphoristic shape, negative parallelism, triad, fragment list, or signature phrase
- evidence required: quoted examples from at least three locations showing the repeated shape
- immediate action: keep only the strongest instances; vary, cut, or convert the rest into plainer movement or character-specific speech
- owner must approve: no (flagged for line edit unless the pattern is severe enough to affect pacing)
- note: a strong voice can become audible machinery if every scene closes with the same kind of sentence.

### Alarm R: Soft midpoint / missing active danger
- trigger: by the midpoint, the central threat, argument, or problem remains private, abstract, diagnostic, or reversible instead of producing an option-changing public, physical, institutional, relational, or material consequence
- evidence required: outline-stress-test.md, reader-promise-tracker.md, and scorecards showing no midpoint turn that changes available choices
- immediate action: revise the midpoint to create a sharper consequence or update publication-shape.md if the book deliberately rejects that genre pressure
- owner must approve: yes
- note: readers need to feel when the book has crossed from suspicious to actively dangerous.

### Alarm S: Dangling forward-reference after revision / reorder
- trigger: a chapter or scene still promises a future event ("tomorrow there would be…", "soon", "when the time came") that now occurs *earlier* in the book because a chapter was reordered, expanded, or moved
- evidence required: temporal-reference-audit.mjs output showing a forward-reference whose promised event is already established in an earlier chapter per continuity-ledger.md / chronology-rebuild.md
- immediate action: rewrite the dangling reference to past tense, remove it, or restore the intended order. Do not let a reordered manuscript ship with promises of events that already happened.
- owner must approve: no (automatically flagged)
- note: this is the most common publication-blocker introduced by structural revision. After ANY chapter reorder, move, or major expansion, run `npm run audit:temporal -- <project>` and reconcile every hit. The canonical failure: Chapter 12 establishes a law, but a later chapter still ends "Tomorrow there would be a law about X."

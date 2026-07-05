# Act Design Audit

## Purpose

The inverse of `expansion-integrity.md`. Expansion integrity asks "does added length come from real pressure?" This audit asks "is the book overbuilt in exactly the way a careful protagonist might overbuild — too many parallel beams carrying the same load?" Use it in Phase 4 before any developmental cut pass, and again before final packaging.

Framing: do not build the largest possible ark. Build the one that holds.

## Climax placement

| dramatic climax (token) | chapter | position in manuscript | words before | words after | % after climax |
| --- | --- | --- | ---: | ---: | ---: |

Heuristic thresholds:
- post-climax tail above ~20% of the manuscript risks reading as a second novella after the novel has already climaxed.
- the longest chapter should not sit after the climax unless Act IV is deliberately designed.

## Post-climax verdict

Choose one design intent and commit:

- [ ] **Deliberate Act IV** — the post-climax material has its own dramatic question, not just aftermath. State it here:
- [ ] **Denouement** — the post-climax material is compressed into a tight landing. Target word count:
- [ ] **Mixed (problem)** — some episodes are Act IV, some are residue. Flag for redesign.

## Post-climax spine

Order the retained post-climax scenes as a clean spine. Move chronologically displaced episodes (a birth, a quarantine) into the rain-period block.

| order | scene | dramatic function | keep / move / cut |
| ---: | --- | --- | --- |

Common strong post-climax spine (adapt to the book):
1. first night afloat — survival is not relief
2. society hardens inside the ark
3. rain stops — hope becomes dangerous
4. signs (raven / dove / olive / no-return) — ambiguous, then meaningful
5. covering off — the world is visible but not yet safe
6. list of the dead — protagonist's final moral transformation

## Assembly-draft scaffolding

Flag any chapter structure that signals insertion rather than design (Chapter 2A / 2B / 3A…). Convert to clean Parts or Chapters before publication.

| current label | proposed final structure | notes |
| --- | --- | --- |

Suggested Part mapping (rename to fit the book):
- **Part I — The Commission**: protagonist accepts the work; household cost begins.
- **Part II — The Yard**: the build site becomes a camp, then a society, then a moral order.
- **Part III — The Claimants**: scarcity, antagonist pressure, boarding order, siege preparation.
- **Part IV — The Door**: seizure, boarding, flood, door, lift.
- **Part V — What Holds**: inside the ark, signs of land, list of the dead.

If a five-part structure is retained, Part V must carry its own dramatic engine, not just aftermath.

## Scene-shape repetition

Pull from `scene-inventory.md`. A scene shape that recurs more than twice without escalation is prose fatigue. Keep the strongest representative; merge or cut the rest.

| recurring shape | occurrences | keeper | merge / cut |
| --- | --- | --- | --- |

## Ending beat

The thematic ending may be strong but not yet narratively satisfying. Audit the final image:

- [ ] the final image is **embodied** (an object, an action, a setting into mud or new ground), not only a stated reflection.
- [ ] the antagonist thread is resolved or deliberately left open with framing.
- [ ] the protagonist performs the book's theme through an act of building / counting / listing / choosing — not a sermon.

Candidate final images (choose one or design your own):
- protagonist carries the list off the ark and sets it into the new ground.
- protagonist builds the first dry floor for a flood-born child.
- protagonist and family step onto land and make a practical choice that shows they have changed.
- the list of the dead is planted, hung, or set into the first structure of the new settlement.

## Recommended cut target

| current length | target length | words to cut | where the cuts come from |
| ---: | ---: | ---: | --- |

Cut priorities (do not cut the book's soul — cut the repetitions that make the soul explain itself too many times):
- merge procurement / logistics scenes.
- reduce repeated "law of the camp" episodes.
- tighten long philosophical dialogues.
- compress the post-climax tail per the spine above.
- keep the best aphoristic landing per scene; remove supporting aphorisms that restate the same idea (see `rhetorical-pattern-audit.mjs`).

## Verification

- [ ] `npm run audit:structure -- <project>` reports no scaffolding and no chapter over the agreed share.
- [ ] post-climax tail matches the chosen design intent (Act IV or denouement).
- [ ] final image is embodied.

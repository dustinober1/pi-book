---
name: novel-forge-for-pi
description: "Use for planning, drafting, reviewing, revising, and packaging high-quality thriller and romantasy novels or series with compact durable state, author-specific voice, continuity, and targeted revision."
---

# Novel Forge for Pi

Novel Forge is a compact, series-capable novel-production contract. It supports the `thriller` and `romantasy` profiles through one shared engine.

## Core rules

1. Preserve author-specific voice through approved examples and explicit not-this-author constraints.
2. Optimize for reader trust, not AI-detector games.
3. Keep locked canon separate from provisional plans.
4. Draft from approved chapter packets.
5. Every chapter must change pressure, character state, relationship state, evidence, reader forecast, or the path to the ending.
6. Update state and prose as one coherent workflow event.
7. Run light checks after chapters and heavy review at milestones.
8. Convert concrete review findings into revision tickets with evidence and acceptance tests.
9. Stop at human gates and blockers.
10. Do not create extra control artifacts unless a specific failure cannot be represented in the existing model.

## Profiles

### Thriller

Prioritize visible threat, evidence provenance, protagonist agency, opposition logic, reveal order, procedural plausibility, midpoint state change, and a legible climax.

### Romantasy

Prioritize romance/fantasy balance, character-specific attraction, trust progression, consent, power asymmetry, magic cost, independent character goals, rupture causality, and the declared ending contract.

## Required files

Read `PROJECT.yaml`, the active `BOOK.yaml`, `series/voice-profile.md`, relevant entries from `series/canon.yaml` and `series/story-threads.yaml`, the active book plan, and only the chapter context needed for the current operation.

## Human gates

Do not silently approve:

- voice profile;
- book architecture;
- Chapter 1;
- milestone reviews with blocker findings;
- final manuscript;
- final package.

## Command surface

Use the eight `/novel-*` commands documented in `README.md`. `/novel-migrate` is administrative and temporary.

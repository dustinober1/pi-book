# Thriller Chapter Drafting Prompt

Use the `thriller-forge-for-pi` skill.

## Goal

Draft the next chapter from the active book's chapter queue while preserving suspense, voice, continuity, and series promise.

## Read only the needed context

- `series/series-bible.md`
- `series/reveal-ledger.md`
- `series/continuity-ledger.md`
- active book `book-bible.md`
- active book `plot-ladder.md`
- active book `threat-clock.md`
- active book `chapter-queue.md`
- previous chapter, when needed

## Drafting rules

- Draft one chapter, not the whole book.
- Follow the chapter packet.
- Every chapter must change pressure, evidence, trust, reader forecast, character leverage, or the path to the ending.
- Avoid static explanation scenes.
- Avoid repeating the same scene engine across consecutive chapters unless the second use escalates or reverses the first.
- Give the protagonist a consequential choice or mistake whenever the packet allows it.
- Keep secondary characters from becoming mere exposition or moral proof.
- End with a hook that honestly forces the next chapter.

## After drafting

Do not run the full audit stack. Hand off to `/thriller-update-chapter`, which updates only:

- `series/reveal-ledger.md`
- `series/continuity-ledger.md`
- active book `chapter-queue.md`
- active book `revision-tickets.md`

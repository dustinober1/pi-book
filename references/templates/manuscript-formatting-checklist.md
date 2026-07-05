# Manuscript Formatting and Word Count Checklist

## Purpose

Before submission, publication, or sharing with agents, editors, reviewers, or production partners, verify the manuscript meets standard formatting requirements and that stated metadata is accurate.

## Word count verification

| metric | stated value | actual value | discrepancy | reconciled? |
| --- | --- | --- | --- | --- |

Steps:
1. run an independent word count on the full manuscript
2. compare against any stated word count on the title page, query letter, or metadata
3. reconcile any discrepancy before submission
4. update the title page with the verified word count

## Title page check

- [ ] author name present and correctly spelled
- [ ] title present and correctly spelled
- [ ] byline present
- [ ] contact information present (if submitting)
- [ ] rounded word count present and verified
- [ ] no running header or page number on the title page (standard manuscript format)
- [ ] no raw Markdown formatting visible in rendered output
- [ ] no submission-status self-announcement on the title page (e.g., "Manuscript submitted for representation and publication") — the manuscript should not announce that it is being submitted

## Formatting consistency

- [ ] scene breaks are consistent throughout
- [ ] chapter headers are consistent
- [ ] page numbering follows target format
- [ ] no raw code fences or Markdown artifacts in rendered manuscript
- [ ] consistent quotation marks (curly or straight, not mixed)
- [ ] no stray bolding, italics, or formatting artifacts from drafting

## Spelling-system consistency

- [ ] single spelling system chosen (British or American) and applied throughout
- [ ] common mixed pairs audited: labour/labor, centre/center, neighbour/neighbor, theatre/theater, colour/color, favour/favor, honour/honor, behaviour/behavior, grey/gray, judgement/judgment, traveller/traveler, mould/mold, towards/toward, afterwards/afterward, plough/plow, litre/liter, metre/meter, pretence/pretense, defence/defense, offence/offense, licence/license, practise/practice
- [ ] run `npm run audit:spelling -- <project>` and confirm **zero mixed-system pairs AND zero stray minority-system tokens**
- [ ] any intentional holdouts (e.g., a character voice, a quoted source) are deliberate and consistent

## Copy mechanics

- [ ] run `npm run audit:mechanics -- <project>` and confirm **zero lowercase sentence starts, doubled words, and space-before-punctuation**
- [ ] sentence-initial words are capitalized (watch for lowercase list/category words: "animal water. private water.")
- [ ] no accidental doubled words ("the the", "a a")
- [ ] after any chapter reorder or revision, run `npm run audit:temporal -- <project>` and reconcile every temporal forward-reference against chronology-rebuild.md (catches dangling "tomorrow there would be…" promises of events that now occur earlier)

## Code-fence and log formatting

- [ ] any in-world documents, system logs, or display text use consistent formatting
- [ ] formatting choices are intentional and readable, not artifacts of the drafting tool
- [ ] formatting works in both rendered and plain-text views if both are expected

## Metadata scrub

- [ ] document metadata cleaned (author, date, tool traces)
- [ ] no drafting-stage comments or notes visible in final manuscript
- [ ] no placeholder text remaining

## Format decision

- [ ] format identified: submission manuscript / typeset interior / ARC / other
- [ ] formatting matches the identified format
- [ ] if between formats, resolve before submission

# Manuscript Critical Review Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the external critical review into a disciplined revision program that removes submission blockers, restores plausibility, and tightens the manuscript without sanding off its strongest domestic and institutional intelligence.

**Architecture:** Treat the repair as six ordered manuscript passes: scaffolding cleanup, continuity map, legal/procedural reconstruction, technical-access plausibility, character deepening, and prose compression. Each pass produces concrete revision tickets and acceptance checks before any later line polish proceeds.

**Tech Stack:** Novel Forge prose-lint, milestone review prompts, revision tickets, manuscript chapter files, canon/timeline artifacts, and manual domain review for legal and technical posture.

## Global Constraints

- Do not start with line polish. Remove drafting/metafictional scaffolding and fix legal/continuity architecture first.
- Preserve the central ending: Elena wins a narrow recommendation/ruling, not a systemic revolution.
- Preserve the moral architecture: no single villain, distributed harm, defensible public-good pressure, compromised protagonist.
- Prefer dramatized scene evidence over explanatory theme statements.
- Keep the daughter vivid but reduce thesis-ready adult conceptual language.
- Make legal, county, evaluator, vendor, and court roles legible enough for an informed reader.
- Make the Engineer's breach proportionate to the vendor/county system's sophistication.
- Use prose-lint as evidence, not as automatic prose authority.

---

### Task 1: Create the Revision Control Packet

**Files:**
- Create: `revision/manuscript-critical-review-ticket-map.md`
- Create: `revision/manuscript-critical-review-acceptance-checklist.md`
- Read: `/Users/dustinober/.codex/attachments/db2b09f2-717b-4dbd-8a6f-85a8cb25c0de/pasted-text.txt`

**Interfaces:**
- Consumes: External review categories and examples.
- Produces: A ticket map with stable ticket IDs `CRR-001` through `CRR-010`, and an acceptance checklist used by every later task.

- [ ] **Step 1: Create the ticket map**

Create `revision/manuscript-critical-review-ticket-map.md` with these tickets:

```markdown
# Manuscript Critical Review Ticket Map

## Blockers

- CRR-001: Remove all drafting/metafictional scaffolding from narrative prose.
- CRR-002: Build and reconcile a day-by-day continuity timeline.
- CRR-003: Clarify the legal posture: parties, evaluator, county counsel, evidentiary access, motion path, and hearing purpose.
- CRR-004: Repair the lawyer's ethical position around Elena's staged test.
- CRR-005: Make the Engineer's legacy access/breach harder and procedurally credible.

## Major Tightening

- CRR-006: Cut repeated thematic summations, especially provenance, clean, ordinary, defensible value, and "There it was" patterns.
- CRR-007: Reduce uniform aphoristic closure and restore neutral narrative ground.
- CRR-008: Give named/role characters more independent human specificity, especially the Engineer, Executive, former spouse, and Elena outside the case.
- CRR-009: Calibrate the daughter's voice and fix second/third-grade continuity.
- CRR-010: Dramatize at least one concrete beneficial use of the system.
```

- [ ] **Step 2: Create the acceptance checklist**

Create `revision/manuscript-critical-review-acceptance-checklist.md`:

```markdown
# Manuscript Critical Review Acceptance Checklist

## Submission Blockers

- [ ] No narrative line refers to "the chapter," "Chapter N," "the book's rules," "this book," "the story," "threat movement," "relationship movement," or similar craft scaffolding unless explicitly approved as metafiction.
- [ ] Timeline is internally coherent from March 14 through the final ruling.
- [ ] Daughter's grade is consistent, with any historical school references clearly framed as past.
- [ ] Legal roles are legible: who moves for emergency modification, who defends county/vendor records, what the evaluator is, and what the court is deciding.
- [ ] Lawyer does not help plan evidence contamination unless the manuscript intentionally makes him complicit and gives him consequences.
- [ ] Engineer evidence has admissibility friction: authentication, limited purpose, hearsay/trade-secret/protective-order objections, and chain-of-custody limits.
- [ ] Technical access route includes at least one plausible additional vulnerability beyond "old laptop plus recovery string."

## Tightening

- [ ] Explicit theme statements are cut where the scene already proves the point.
- [ ] Aphoristic paragraph endings are reserved for high-pressure turns.
- [ ] The daughter's most conceptual lines are reduced to the strongest five or six.
- [ ] Elena has at least one meaningful non-case pressure or relationship.
- [ ] The Executive's public-good argument is dramatized through a concrete beneficiary or case.
- [ ] The Engineer has aftermath or cost after the breach.
- [ ] Final pages end on image or action rather than one extra generalization.
```

- [ ] **Step 3: Run no tests**

Expected: This task creates planning artifacts only. No test command is required.

- [ ] **Step 4: Commit**

```bash
git add revision/manuscript-critical-review-ticket-map.md revision/manuscript-critical-review-acceptance-checklist.md
git commit -m "docs: map critical manuscript revision tickets"
```

### Task 2: Scaffolding Cleanup Gate

**Files:**
- Modify: manuscript chapter files, wherever the active manuscript is stored.
- Reference: `src/application/prose-lint/rules/mechanics.ts`
- Reference: `revision/manuscript-critical-review-acceptance-checklist.md`

**Interfaces:**
- Consumes: CRR-001 and the prose-lint rule `mechanics/prose-scaffolding`.
- Produces: A manuscript with no retained outline/craft residue.

- [ ] **Step 1: Run the mechanics lint gate**

Run the prose-lint command against the active manuscript path:

```bash
npm run prose-lint -- <MANUSCRIPT_PATH> --rules mechanics
```

Expected: Every `mechanics/prose-scaffolding` finding is listed with file and line.

- [ ] **Step 2: Remove or translate each finding**

For each finding, choose one of these repairs:

```text
Delete if the line only explains craft function.
Translate into character-grounded perception if it carries necessary meaning.
Preserve only if the book is formally approved as metafiction.
```

Use this replacement model:

```text
Bad: The chapter kept insisting on provenance and limits.
Good: Every answer arrived with the same defect: enough provenance to frighten her, enough uncertainty to stop her from proving what it meant.
```

- [ ] **Step 3: Rerun mechanics lint**

```bash
npm run prose-lint -- <MANUSCRIPT_PATH> --rules mechanics
```

Expected: `mechanics/prose-scaffolding` has zero findings. Other mechanical findings may remain, but must be ticketed if not fixed.

- [ ] **Step 4: Update checklist**

Mark this item complete in `revision/manuscript-critical-review-acceptance-checklist.md`:

```markdown
- [x] No narrative line refers to "the chapter," "Chapter N," "the book's rules," "this book," "the story," "threat movement," "relationship movement," or similar craft scaffolding unless explicitly approved as metafiction.
```

- [ ] **Step 5: Commit**

```bash
git add <MANUSCRIPT_PATH> revision/manuscript-critical-review-acceptance-checklist.md
git commit -m "fix: remove manuscript scaffolding residue"
```

### Task 3: Continuity Timeline Repair

**Files:**
- Create: `revision/manuscript-day-by-day-timeline.md`
- Modify: manuscript chapter files with date, season, grade, custody, and object continuity references.
- Modify: canon/timeline artifacts if the project stores them separately.

**Interfaces:**
- Consumes: CRR-002 and CRR-009.
- Produces: A day-by-day timeline and corrected manuscript references.

- [ ] **Step 1: Build the timeline table**

Create `revision/manuscript-day-by-day-timeline.md`:

```markdown
# Manuscript Day-by-Day Timeline

| Day/Date | Chapter(s) | Custody Status | Legal/Platform Event | School/Season Detail | Key Objects | Notes |
|---|---|---|---|---|---|---|
| March 14 | Ch. 1 | Existing arrangement | Scheduling/message inputs begin mattering | March/shamrock context | Inhaler, sweater | Confirm exact event. |
| March 21 | Ch. 1 | Existing arrangement under pressure | Hearing cannot occur before this date | March context | Court-paper tote | Confirm exact event. |
| TBD | Ch. 5 | TBD | Records-room/search-query reveal | Replace "wet February light" if timeline is March | TBD | Fix seasonal mismatch. |
| TBD | Ch. 11 | TBD | Staged messages/routes | TBD | TBD | Confirm daughter presence and risk. |
| TBD | Ch. 12 | Reduced school-week custody begins | Emergency motion/hearing | TBD | Overnight bag, inhaler | Confirm moving party. |
| TBD | Ch. 19-21 | Hearing posture | Reliability challenge/ruling | TBD | Court record | Confirm evidence admission limits. |
| TBD | Ch. 22-24 | Return/restoration | Narrow holding aftermath | Late spring/summer only if elapsed days support it | Backpack, pajamas, cereal bowl | Confirm ending objects. |
```

- [ ] **Step 2: Reconcile dates and seasons**

Search the manuscript for:

```bash
rg -n "February|March|April|May|June|frost|slush|heat|shamrock|late-day|second grade|third-grade|third grade" <MANUSCRIPT_PATH>
```

Expected: Every date, grade, and seasonal image maps cleanly to the timeline table.

- [ ] **Step 3: Fix grade continuity**

Choose one current grade. Recommended: third grade, because the review identifies "third-grade chorus" as an earlier anchor.

Repair rule:

```text
Use "third grade" for the daughter's current school year.
Use "from second grade" only for old artifacts, explicitly framed as past.
```

- [ ] **Step 4: Track object custody**

Add object columns for:

```text
inhaler
blue sweater
toothbrush
stuffed fox
rabbit-ear towel
purple water bottle
shamrock
library book
blue-rimmed cereal bowl
overnight bag
moon pajamas
```

Expected: No object appears in the wrong house without an exchange or explanation.

- [ ] **Step 5: Commit**

```bash
git add revision/manuscript-day-by-day-timeline.md <MANUSCRIPT_PATH> <CANON_OR_TIMELINE_FILES_IF_ANY>
git commit -m "fix: reconcile manuscript timeline and continuity"
```

### Task 4: Legal Posture Reconstruction

**Files:**
- Create: `revision/legal-posture-model.md`
- Modify: early setup chapters, staged-test chapters, emergency-hearing chapters, final hearing chapters.

**Interfaces:**
- Consumes: CRR-003 and CRR-004.
- Produces: A coherent procedural model that can be understood without turning the book into a textbook.

- [ ] **Step 1: Establish the procedural model**

Create `revision/legal-posture-model.md`:

```markdown
# Legal Posture Model

## Recommended Model

This is a private custody dispute in which:

- Father/former spouse files or supports the emergency modification.
- The court-appointed or county-contracted evaluator supplies concern/recommendation language.
- County counsel appears to defend records, methodology, disclosure limits, and the evaluator/platform process, not to seek custody directly.
- Vendor counsel or county counsel raises proprietary/trade-secret and support-page limits.
- Elena's lawyer challenges reliance, completeness, context stripping, and manipulability.
- The court's narrow issue is whether this recommendation can bear the custody consequence placed on it.

## Evidence Model

- The proprietary summary is not treated as divine truth.
- Elena can inspect some support pages under protective "review only" limits.
- The Engineer's material faces authentication, hearsay, chain-of-custody, trade-secret, and limited-purpose objections.
- The court considers the Engineer's evidence primarily to test reliability and reliance, not as a full adjudication of system-wide misconduct.
```

- [ ] **Step 2: Seed the model early**

In Chapters 1-5, add no more than three precise sentences total that establish:

```text
who appointed or contracted the evaluator
who can file the emergency motion
why Elena sees only summaries/support pages
```

Acceptance: A legally sophisticated reader can answer "who is doing what?" before the staged test.

- [ ] **Step 3: Repair the lawyer's ethical boundary**

Replace the current planning dynamic with this structure:

```text
The lawyer refuses to help stage anything.
He warns Elena that contaminating the record may hurt custody and may limit his ability to represent her.
He leaves the planning conversation or ends the call.
Elena and the Engineer proceed without him.
Elena discloses the staged test only after the emergency filing.
The lawyer is angry, evaluates his obligations, and continues only if the manuscript justifies that decision.
```

Acceptance: He is no longer functionally designing evidence contamination while remaining the ethical realist.

- [ ] **Step 4: Add hearing friction**

In the final hearing sequence, include brief objections or judicial framing around:

```text
authentication
hearsay
limited purpose
trade secret/protective order
chain of custody
scope of ruling
```

Acceptance: The court's use of Engineer evidence feels legally bounded rather than frictionless.

- [ ] **Step 5: Commit**

```bash
git add revision/legal-posture-model.md <MANUSCRIPT_PATH>
git commit -m "fix: clarify custody legal posture"
```

### Task 5: Technical Breach Plausibility Repair

**Files:**
- Create: `revision/technical-access-model.md`
- Modify: Engineer access chapters and hearing evidence chapters.

**Interfaces:**
- Consumes: CRR-005.
- Produces: A harder, more credible breach/access path with consequences.

- [ ] **Step 1: Choose one access route**

Create `revision/technical-access-model.md` using one recommended route:

```markdown
# Technical Access Model

## Chosen Route

The Engineer does not simply log in from an old laptop. She reaches a county-side disaster-recovery or support portal that sits outside the vendor's modern identity perimeter.

## Required Controls Mentioned

- The main vendor environment has MFA, device posture checks, logging, and post-separation access revocation.
- The vulnerable route is a legacy county support/VPN or disaster-recovery environment.
- Access requires a retained hardware token, stale certificate, unrevoked support group, former colleague session code, or maintenance host exception.
- The access creates detectable logs and personal/professional risk.
```

- [ ] **Step 2: Add difficulty before access**

Revise the breach chapter so access requires at least three beats:

```text
failed modern login or revoked path
discovery of neglected legacy/county-side route
ethically costly final step such as using stale credentials, a support token, or a former colleague's session code
```

- [ ] **Step 3: Add cost after access**

Add aftermath for the Engineer:

```text
severance clawback threat
legal demand letter
job application consequences
public identification risk
or a deliberate choice to accept professional exile
```

Acceptance: The Engineer's cost remains visible after Elena's custody issue resolves.

- [ ] **Step 4: Commit**

```bash
git add revision/technical-access-model.md <MANUSCRIPT_PATH>
git commit -m "fix: harden engineer access plausibility"
```

### Task 6: Character and Opposition Deepening

**Files:**
- Modify: early Elena chapters, Executive chapters, former-spouse chapters, daughter scenes, Engineer aftermath chapters.
- Reference: `revision/manuscript-critical-review-ticket-map.md`

**Interfaces:**
- Consumes: CRR-008, CRR-009, and CRR-010.
- Produces: More independent character pressure and a fairer public-good case.

- [ ] **Step 1: Add Elena's non-case pressure**

Add one or two scenes or scene beats showing at least one:

```text
job consequence
friendship strain
financial pressure
family history
ordinary adult competence outside motherhood/litigation
```

Acceptance: Elena has a life being narrowed, not only a case to pursue.

- [ ] **Step 2: Name or humanize role characters**

Decide whether to name:

```text
the Engineer
the Executive
the former spouse
the daughter
```

Acceptance: Any continued namelessness has an intentional perspective/formal reason, not an outline feel.

- [ ] **Step 3: Dramatize one system benefit**

Add one concrete beneficiary or case:

```text
a parent without private counsel receives faster review
a genuine danger pattern emerges from chaotic records
an evaluator catches a risk a rushed human missed
a delayed case would have harmed a child, and the system reduced that delay
```

Acceptance: The Executive is defending a real institutional benefit, not only a dashboard.

- [ ] **Step 4: Give the former spouse one legitimate early concern**

Add one early instance where he behaves reasonably or Elena's urgency genuinely burdens the child.

Acceptance: His later "user of the damage, not its author" role is prepared without making him secretly virtuous or villainous.

- [ ] **Step 5: Calibrate daughter dialogue**

Search for conceptual child lines:

```bash
rg -n "institutional distrust|emotional climate|constitutional objections|aggressively boring Monday|systems problem|contain multitudes|legal regular|technical" <MANUSCRIPT_PATH>
```

Keep only the best five or six thesis-adjacent child lines. Replace the rest with:

```text
literal misunderstanding
idiosyncratic fixation
sudden subject change
concrete sensory preference
small selfish want
wrong but emotionally true conclusion
```

- [ ] **Step 6: Commit**

```bash
git add <MANUSCRIPT_PATH>
git commit -m "fix: deepen character and opposition pressure"
```

### Task 7: Prose Compression and Aphorism Pass

**Files:**
- Modify: manuscript chapter files.
- Reference: `src/application/prose-lint/rules/style-patterns.ts`
- Reference: `src/application/prose-lint/rules/repetition.ts`

**Interfaces:**
- Consumes: CRR-006 and CRR-007.
- Produces: A tighter manuscript with fewer repeated theme statements and more tonal air.

- [ ] **Step 1: Run style and repetition lint**

```bash
npm run prose-lint -- <MANUSCRIPT_PATH> --rules repetition,style-pattern
```

Expected: Findings identify repeated phrases, openings, fragments, aphoristic closes, not-X-but-Y constructions, and local concentrations.

- [ ] **Step 2: Cut target terms by context**

Search:

```bash
rg -n "There it was|provenance|ordinary|clean|defensible value|That was the problem|That was the point|Not .*\\. .*|No .*\\. Only" <MANUSCRIPT_PATH>
```

Repair rule:

```text
Keep the term when it changes evidence, pressure, or character choice.
Cut it when it restates a point already dramatized in the same scene.
Replace it when a concrete object or action can carry the meaning.
```

- [ ] **Step 3: Compress chapters 6-10 and 16-18 first**

Target reductions:

```text
Chapters 6-10: reduce overlap around consent, partner services, source route, and incomplete proof.
Chapters 16-18: combine or sharply compress repeated preparation around provenance, manipulability, reliance, and bounded proof.
```

Acceptance: The hearing line "My choice made me compromised. It did not make the record complete or trustworthy." does not have to be pre-explained three times.

- [ ] **Step 4: Normalize paragraph endings**

For every repeated aphoristic ending, choose one:

```text
end on action
end on image
end on silence
end on unresolved dialogue
end before the thesis sentence
```

Acceptance: The strongest 30-40 percent of aphoristic endings remain; the rest become plain narrative ground.

- [ ] **Step 5: Re-run lint and document exceptions**

```bash
npm run prose-lint -- <MANUSCRIPT_PATH> --rules repetition,style-pattern
```

Expected: Remaining findings are either reduced or documented as intentional motifs.

- [ ] **Step 6: Commit**

```bash
git add <MANUSCRIPT_PATH> revision/manuscript-critical-review-acceptance-checklist.md
git commit -m "fix: tighten manuscript thematic repetition"
```

### Task 8: Ending Restraint Pass

**Files:**
- Modify: final chapters.

**Interfaces:**
- Consumes: Review feedback on Chapters 22-24.
- Produces: An ending that trusts object, address, and aftermath instead of restating the thesis.

- [ ] **Step 1: Identify candidate ending images**

List the final three pages' strongest images:

```text
backpack by the chair
blue-rimmed cereal bowl
daughter's closet/list
moon pajamas
"enough for this address"
```

- [ ] **Step 2: Choose the final resonance**

Recommended ending priority:

```text
1. Concrete domestic image.
2. "The proof had been enough for this address."
3. Wider-system generalization only if it arrives before the final image, not after.
```

- [ ] **Step 3: Cut the extra final generalization**

Acceptance: The ending leaves the reader feeling the limited victory and surviving infrastructure without explaining that lesson one more time.

- [ ] **Step 4: Commit**

```bash
git add <MANUSCRIPT_PATH>
git commit -m "fix: restrain final manuscript movement"
```

### Task 9: Final Regression Review

**Files:**
- Modify: `revision/manuscript-critical-review-acceptance-checklist.md`
- Read: manuscript chapter files.
- Read: revision artifacts created above.

**Interfaces:**
- Consumes: All CRR tickets.
- Produces: A final go/no-go review with residual risks.

- [ ] **Step 1: Run all lint gates**

```bash
npm run prose-lint -- <MANUSCRIPT_PATH>
```

Expected: No scaffolding findings. Remaining repetition/style findings are materially lower or intentionally documented.

- [ ] **Step 2: Read the revised manuscript in risk order**

Read in this order:

```text
staged-test chapter
emergency modification chapter
Engineer breach chapter
final hearing chapters
ending chapters
opening chapters
compressed middle chapters
```

Acceptance: No repair creates a new continuity, motive, or pacing break.

- [ ] **Step 3: Complete the checklist**

Update `revision/manuscript-critical-review-acceptance-checklist.md` so every item is checked or has a one-sentence residual-risk note.

- [ ] **Step 4: Produce a final repair memo**

Create `revision/manuscript-critical-review-repair-memo.md`:

```markdown
# Manuscript Critical Review Repair Memo

## Fixed Blockers

- CRR-001:
- CRR-002:
- CRR-003:
- CRR-004:
- CRR-005:

## Tightening Completed

- CRR-006:
- CRR-007:
- CRR-008:
- CRR-009:
- CRR-010:

## Remaining Risks

- None known.

## Submission Recommendation

- Ready for outside reread after one clean proofread.
```

- [ ] **Step 5: Commit**

```bash
git add revision/manuscript-critical-review-acceptance-checklist.md revision/manuscript-critical-review-repair-memo.md <MANUSCRIPT_PATH>
git commit -m "docs: complete critical review repair memo"
```

## Self-Review

**Spec coverage:** All ten major review concerns are mapped to CRR tickets and implemented through the ordered tasks above.

**Placeholder scan:** The only variable is `<MANUSCRIPT_PATH>`, because the current repository context does not expose the active manuscript chapter location. Replace it with the actual manuscript directory or file before execution.

**Type consistency:** Ticket IDs `CRR-001` through `CRR-010` are consistent across task descriptions and acceptance checks.

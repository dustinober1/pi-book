# Thriller Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Novel Forge cannot draft past an unreviewed act and gives thriller plans and reviews enough structured evidence to catch cadence fatigue, weak moral counterevidence, soft act breaks, and procedural continuity drift.

**Architecture:** Keep the existing guarded-event workflow and canonical YAML model. Add one authoritative act-boundary resolver used by queue validation, draft transitions, status, and review scope; add bounded deterministic prose-lint evidence to act/manuscript reviews; strengthen only the thriller profile with typed planning contracts; and add a thriller evidence ledger for exact terminology and provenance. All findings remain review evidence unless a structural validator explicitly blocks advancement.

**Tech Stack:** TypeScript, TypeBox schemas, YAML, Node test runner, `tsx`, existing `novel_apply_event` transactions, and the existing deterministic scanner infrastructure.

## Global Constraints

- Do not rewrite manuscript prose automatically.
- Do not label prose as AI-written or assign authorship probabilities.
- Style-pattern findings are review evidence, not quotas or automatic severity.
- Existing thriller, romantasy, and historical-fiction projects remain readable; migration is advisory unless a writer rebuilds the affected plan.
- All model-authored state changes continue through `novel_apply_event` and Git checkpoints.
- A review gate is a hard stop: no later chapter draft may be accepted while its prior milestone gate is pending, rejected, or open-but-due.
- The thriller evidence ledger must record what an artifact proves and does not prove; it must never manufacture provenance.

---

### Task 1: Make act gates authoritative and impossible to skip

**Files:**
- Create: `src/application/act-boundaries.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/stage-specs/index.ts`
- Test: `tests/act-boundaries.test.ts`
- Test: `tests/event-application.test.ts`

**Interfaces:**
- `resolveActBoundary(plot, chapter): { actId: string; startChapter: number; endChapter: number; gate: string | null } | null`
- `requiredMilestoneGate(plot, chapter): string | null`
- `reviewChapterRange(plot, scope, activeGate?): { startChapter: number; endChapter: number } | null`

- [ ] **Step 1: Write failing boundary tests.**

  Cover a plot with Act I ending at Chapter 6 and gate `act-1-review`. Assert Chapter 6 resolves to that gate, Chapter 5 resolves to no gate, and a missing or overlapping act returns a blocker. Assert `reviewChapterRange(plot, "act", "act-1-review")` returns 1–6.

- [ ] **Step 2: Run the focused tests and confirm failure.**

  Run: `node --import tsx --test tests/act-boundaries.test.ts`

  Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the pure resolver.**

  Validate sorted, non-overlapping act ranges and resolve the exact act containing a chapter. Treat the act `gate` as authoritative; packet `milestone_gate` becomes a compatibility field that must match when present. Return a concise finding for a packet gate mismatch instead of guessing.

- [ ] **Step 4: Derive transitions from the plot, not packet text.**

  In `events.ts`, after drafting a chapter, call `requiredMilestoneGate(plot, input.chapter)`. If it returns a gate, set that gate pending, set `next_gate`, move to `act-review`, and record `book.act_checkpoint`. Ignore a null packet gate only when the plot also resolves to null. Reject a non-null packet gate that disagrees with the plot.

- [ ] **Step 5: Validate queue and draft events against the same resolver.**

  In `integrity.ts` and `validateArchitecture`, reject a ready packet whose `milestone_gate` disagrees with the plot-derived value. Reject a chapter-queue event that omits a required act-boundary packet marker. Preserve first-chapter approval as a separate earlier gate.

- [ ] **Step 6: Anchor status, run, and prompt scope to the active gate.**

  Make `status.ts`, `run.ts`, and `reviewStageSpec` use `reviewChapterRange` so an Act I review explicitly names Chapters 1–6. Do not allow a generic `act` prompt to silently review all drafted chapters.

- [ ] **Step 7: Add regression coverage for the observed failure.**

  Build a temporary project with a six-chapter Act I, a null packet milestone gate, and a seventh ready packet. Apply Chapter 6 through `novel_apply_event`; assert the event ends in `act-review`, `next_gate: act-1-review`, and refuses Chapter 7 until the review gate is resolved.

- [ ] **Step 8: Run tests and commit.**

  Run: `node --import tsx --test tests/act-boundaries.test.ts tests/event-application.test.ts tests/status*.test.ts && npm run typecheck`

  Commit: `git add src/application/act-boundaries.ts src/application/events.ts src/application/integrity.ts src/application/status.ts src/application/run.ts src/application/stage-specs/index.ts tests/act-boundaries.test.ts tests/event-application.test.ts && git commit -m "fix: enforce plot-derived act review gates"`

### Task 2: Recover and scope legacy projects safely

**Files:**
- Modify: `src/application/recovery.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/gate-metadata.ts`
- Test: `tests/act-boundary-recovery.test.ts`

**Interfaces:**
- `reconcileMilestoneState(root): { gate: string; chapterRange: { startChapter: number; endChapter: number }; findings: string[] } | null`

- [ ] **Step 1: Write failing recovery tests.**

  Use a project with Chapter 9 drafted, Act I ending at Chapter 6, `act-1-review: open`, and no checkpoint. Assert the reconciler reports an overdue `act-1-review` at Chapters 1–6, does not delete or rewrite chapters, and refuses further drafting until the writer explicitly starts the recovery review.

- [ ] **Step 2: Implement read-only reconciliation.**

  Compare drafted chapter numbers and plot boundaries. Report overdue gates without mutating canonical files. Expose the finding through `STATUS.md`/the guided decision surface as a blocker requiring review.

- [ ] **Step 3: Add explicit recovery action.**

  Add a guarded, state-preserving action that sets the active stage to `act-review` only after the user chooses the overdue gate. Preserve Chapters 7–9 as provisional manuscript material and record the recovery decision in the normal Git checkpoint.

- [ ] **Step 4: Test the current book shape.**

  Assert the Custody Algorithm-shaped fixture selects Act I (1–6), not the current manuscript tail, and that later chapters are included in regression scope only after Act I review completes.

- [ ] **Step 5: Run and commit.**

  Run: `node --import tsx --test tests/act-boundary-recovery.test.ts tests/status-reader-impact.test.ts`

  Commit: `git add src/application/recovery.ts src/application/status.ts src/application/run.ts src/application/gate-metadata.ts tests/act-boundary-recovery.test.ts && git commit -m "feat: recover overdue act reviews safely"`

### Task 3: Complete deterministic prose-lint review evidence

**Files:**
- Create: `src/application/prose-lint/types.ts`
- Create: `src/application/prose-lint/normalize.ts`
- Create: `src/application/prose-lint/engine.ts`
- Create: `src/application/prose-lint/project.ts`
- Create: `src/application/prose-lint/report.ts`
- Create: `src/application/prose-lint/index.ts`
- Create: `src/application/prose-lint/rules/mechanics.ts`
- Create: `src/application/prose-lint/rules/repetition.ts`
- Create: `src/application/prose-lint/rules/style-patterns.ts`
- Create: `src/application/prose-lint/rules/project-consistency.ts`
- Create: `scripts/lib/prose-lint-forwarder.mjs`
- Create: `scripts/prose-lint.ts`
- Modify: `scripts/ngram-audit.mjs`
- Modify: `scripts/rhetorical-pattern-audit.mjs`
- Modify: `scripts/continuity-scan.mjs`
- Modify: `scripts/integrity-audit.mjs`
- Modify: `scripts/structure-audit.mjs`
- Modify: `scripts/spelling-consistency-audit.mjs`
- Modify: `scripts/temporal-reference-audit.mjs`
- Modify: `scripts/copy-mechanics-audit.mjs`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/stage-specs/index.ts`
- Modify: `package.json`, `README.md`, `CHANGELOG.md`
- Test: `tests/prose-lint-*.test.ts`, `tests/scanners.test.ts`, `tests/prose-lint-review.test.ts`

**Interfaces:**
- `runProseLint(input): ProseLintResult`
- `loadProseLintInput(target, options?): ProseLintInput`
- `renderReviewLintEvidence(result, options?): string`

- [ ] **Step 1: Build the typed read-only engine.**

  Define `ManuscriptDocument`, `LintFinding`, `LintRule`, `ProseLintInput`, and `ProseLintResult` in `types.ts`. Make `normalizeDocument(path, text, order)` preserve original lines and line numbers while blanking fenced-code bodies in `scanText`. Make `runProseLint` isolate rule failures, calculate class counts, and sort findings by class, rule ID, document order, line, and excerpt.

- [ ] **Step 2: Add the first rule families.**

  Implement mechanical rules for doubled words, whitespace before punctuation, malformed repeated punctuation, drafting markers, and unambiguous paired-delimiter imbalance. Implement repetition rules for 2–5 word phrases, repeated openings, exact duplicates, and near duplicates using the documented three-use/two-chapter or four-use/one-chapter thresholds. Implement style-pattern counters for negative parallelism, `not X but Y`, three-part cadence, aphoristic closes, rhetorical questions, fragments, em dashes, repeated transitions, and repeated ending syntax. Rules return evidence and review actions; they never edit text.

- [ ] **Step 3: Add project loading and consistency rules.**

  `loadProseLintInput` must load the active book’s Markdown, accepted voice baseline metrics, canonical names/IDs, chapter numbers, and packet/plot references when `PROJECT.yaml` exists; plain directories receive text-only rules. Add mixed-spelling, chapter-sequence, missing-reference, canon-number, and temporal-review findings with stable rule IDs and bounded excerpts.

- [ ] **Step 4: Add reports, CLI, and compatibility wrappers.**

  Implement `renderProseLintMarkdown`, timestamp-free `renderProseLintJson`, and `renderReviewLintEvidence`. Add `npm run audit:prose -- <target> [--format markdown|json] [--rules prefix-list]`. Each legacy scanner forwards to the shared engine with its fixed rule prefix and preserves its existing heading.

- [ ] **Step 2: Add the missing semantic review marker.**

  Add `style-pattern/meta-narrative-leakage` with review confidence for prose references to `the novel`, `readers`, `the chapter`, or equivalent drafting language outside headings and fenced code. Report evidence only; do not flag literary metafiction automatically.

- [ ] **Step 3: Integrate bounded evidence only at act/manuscript review.**

  Run lint in memory for the resolved review chapter range. Include all high-confidence mechanical findings first, then cross-chapter cadence/repetition and consistency findings, with a visible omitted-count and fail-open `lint unavailable` advisory.

- [ ] **Step 4: Add explicit reviewer boundaries.**

  Require context verification against voice guardrails and intentional exceptions. A style finding alone cannot create a ticket. Every lint-derived ticket must cite the manuscript path and line.

- [ ] **Step 5: Run focused and compatibility tests.**

  Run: `node --import tsx --test tests/prose-lint-*.test.ts tests/scanners.test.ts tests/prose-lint-review.test.ts tests/prompt-budget.test.ts tests/prompt-tiny-budget.test.ts && npm run typecheck`

- [ ] **Step 6: Commit.**

  Commit: `git add src/application/prose-lint scripts package.json README.md CHANGELOG.md src/application/prompts.ts src/application/stage-specs/index.ts tests && git commit -m "feat: surface deterministic prose evidence at review"`

### Task 4: Strengthen thriller architecture contracts

**Files:**
- Modify: `src/profiles/thriller.ts`
- Modify: `profiles/thriller.yaml`
- Modify: `src/application/book-strategy.ts`
- Modify: `src/application/stage-specs/index.ts`
- Modify: `src/domain/v1-3-architecture-schemas.ts`
- Test: `tests/profile-hardening.test.ts`
- Test: `tests/phase4-integration.test.ts`

**Interfaces:**
- `thrillerPlanFindings(input): ProfileFinding[]`
- New typed `ActContract` fields: `external_clock`, `act_exit_objective`, `delay_consequence`, `irreversible_exit_action`

- [ ] **Step 1: Write failing plan-validation tests.**

  Assert a thriller plan is blocked when Act I has no explicit external clock, exit objective, or delay consequence; when no Act I chapter supplies counterevidence against the protagonist's preferred interpretation; when the opposition's positive case has no concrete beneficiary or observed outcome; or when a central supporting character has no independent want, action, or misreading.

- [ ] **Step 2: Extend the architecture contract compatibly.**

  Add optional act contract fields to preserve legacy reads, but require them when a writer submits a new or rebuilt thriller book plan. Store the fields in `plot-grid.yaml` and include them in the plan approval evidence hash.

- [ ] **Step 3: Add thriller planning instructions.**

  Extend thriller planning questions and book-plan requirements with: “What partial truth about the protagonist is real before the midpoint?”, “What concrete person or family benefits from the opposition’s system?”, “What does each central supporting character want independently?”, and “What must happen by the Act I exit, and what worsens if it does not?”

- [ ] **Step 4: Prevent abstract pass-through.**

  Require evidence references to specific chapters, packets, or canon relationships. Reject rationale that only repeats a theme or thesis without a scene-level consequence.

- [ ] **Step 5: Add voice differentiation review requirements.**

  At book-plan approval, require one distinct POV signature for every POV named in chapter packets. At act review, instruct the reviewer to compare dialogue rhythm, noticing, evasions, and sentence architecture across POVs; do not reduce this to sentence-length quotas.

- [ ] **Step 6: Run tests and commit.**

  Run: `node --import tsx --test tests/profile-hardening.test.ts tests/phase4-integration.test.ts tests/profiles.test.ts && npm run typecheck`

  Commit: `git add src/profiles/thriller.ts profiles/thriller.yaml src/application/book-strategy.ts src/application/stage-specs/index.ts src/domain/v1-3-architecture-schemas.ts tests/profile-hardening.test.ts tests/phase4-integration.test.ts && git commit -m "feat: harden thriller act and character contracts"`

### Task 5: Add a typed thriller evidence ledger

**Files:**
- Create: `src/domain/thriller-evidence.ts`
- Modify: `src/domain/v1-5-schema-registry.ts`
- Modify: `src/profiles/thriller.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/application/context-builder.ts`
- Modify: `src/application/stage-specs/index.ts`
- Modify: `src/project/templates.ts`
- Test: `tests/thriller-evidence.test.ts`
- Test: `tests/context-integrity.test.ts`

**Interfaces:**
- `ThrillerEvidenceLedgerSchema`
- `thrillerEvidenceFindings(ledger, packet, manuscriptFacts): ProfileFinding[]`
- File: `books/<book-id>/evidence-ledger.yaml`

- [ ] **Step 1: Write failing schema tests.**

  Require entries with stable IDs, artifact name, version/date, exact labels, source/provenance, access or copy restrictions, permitted readers, what the artifact proves, what it cannot prove, first appearance, and contradiction status. Reject empty provenance or a “proves everything” claim.

- [ ] **Step 2: Implement the schema and template.**

  Add the file only to thriller projects. Existing thriller projects remain readable with an advisory until a book-plan rebuild; new thriller plans must include it.

- [ ] **Step 3: Validate packet references and exact-term continuity.**

  Permit packets to reference evidence IDs. Block missing IDs, changed exact labels without a supersession record, and claims that violate recorded access restrictions. Add the ledger’s labels and aliases to prose-lint’s project consistency context.

- [ ] **Step 4: Bound the drafting context.**

  Include only evidence entries referenced by the active packet and their source/provenance fields. Exclude the full ledger and unrelated future artifacts.

- [ ] **Step 5: Test the known failure classes.**

  Cover the copy-vs-notes conflict, renamed category variants, “court-safe” official-vs-informal terminology, and a legacy diagnostic leakage explanation. Assert the validator asks for a recorded explanation rather than inventing one.

- [ ] **Step 6: Run and commit.**

  Run: `node --import tsx --test tests/thriller-evidence.test.ts tests/context-integrity.test.ts tests/context.test.ts && npm run typecheck`

  Commit: `git add src/domain/thriller-evidence.ts src/domain/v1-5-schema-registry.ts src/profiles/thriller.ts src/application/integrity.ts src/context/context-builder.ts src/application/stage-specs/index.ts src/project/templates.ts tests/thriller-evidence.test.ts tests/context-integrity.test.ts && git commit -m "feat: track thriller evidence provenance and terminology"`

### Task 6: Verify the current book and document the operating procedure

**Files:**
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `docs/novel-forge-phase5-audits-and-learning.md`
- Create: `docs/novel-forge-thriller-hardening.md`
- Test: `tests/e2e/v1-5-release-journey.test.ts`

- [ ] **Step 1: Add the recovery procedure.**

  Document: stop drafting when an overdue act gate is detected; run the scoped Act I review; resolve or ticket findings; revise; run regression checks; then resume the next packet. State that Chapters drafted beyond a missed gate remain provisional and are not silently deleted.

- [ ] **Step 2: Add release-journey coverage.**

  Exercise Chapter 6 completion, automatic Act I stop, scoped review evidence, a revision ticket, gate approval, and resumption at Chapter 7. Include a negative case where a mismatched packet milestone gate is rejected.

- [ ] **Step 3: Verify the repository.**

  Run:

  ```bash
  npm run typecheck
  npm test
  npm run eval
  npm run verify:release
  npm pack --dry-run
  git diff --check
  ```

- [ ] **Step 4: Run the current-book diagnostics read-only.**

  Run `audit:prose`, `audit:temporal`, `audit:mechanics`, `audit:continuity`, and `audit:structure` against The Custody Algorithm. Do not rewrite the manuscript from scanner output; convert confirmed findings into revision tickets through the guarded review event.

- [ ] **Step 5: Commit documentation and verification.**

  Commit: `git add README.md SKILL.md docs/novel-forge-phase5-audits-and-learning.md docs/novel-forge-thriller-hardening.md tests/e2e/v1-5-release-journey.test.ts && git commit -m "docs: define thriller review recovery workflow"`

## Self-review checklist

- Gate enforcement, recovery, prose evidence, thriller architecture, evidence continuity, and release verification each have a separate testable task.
- No task edits manuscript prose or converts a style finding directly into a ticket.
- The plan preserves existing schemas for legacy projects and requires stronger fields only on rebuilt/new thriller plans.
- The act gate is derived from `plot-grid.yaml` in one resolver, preventing packet/plot drift.
- The current book’s 2,000–2,500-word reduction remains an editorial revision ticket, not a global length rule.
- No universal ban is added for aphorisms, triads, named characters, or meta-language; all subjective findings remain review-confirmed.

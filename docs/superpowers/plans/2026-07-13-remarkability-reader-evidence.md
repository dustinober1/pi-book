# Remarkability and Reader Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable remarkability contract and honest immediate/delayed reader-evidence workflow to Novel Forge so the system targets memorable, retellable books instead of only reliable manuscripts.

**Architecture:** Extend the typed Novel Forge domain with one book-level `remarkability.yaml` artifact and one book-level `reader-experiments.yaml` artifact. Book planning owns the remarkability contract; drafting receives a compact contract excerpt; a new guarded `reader-test` event and `/novel-readers` command prepare or record real reader experiments without changing manuscript state or inventing validation.

**Tech Stack:** TypeScript 5.9, Node test runner, TypeBox schemas, YAML, Pi extension API.

## Global Constraints

- Build on the `novel-forge-v1` architecture and transactional `novel_apply_event` workflow.
- Do not add simulated reader responses or treat personas/models as outside-reader evidence.
- Preserve bounded drafting context; the remarkability contract must not displace the chapter packet, referenced canon, threads, plot entry, or preceding chapter.
- Reader testing must be permitted at useful drafting/review stages, including while a creative approval gate is pending.
- Reader-test events may update only `reader-experiments.yaml` and concrete `revision-tickets.yaml`; they may not rewrite manuscript prose.
- Keep all schemas at version `1.0.0` for this additive pre-release change.

---

### Task 1: Add failing domain and template tests

**Files:**
- Create: `tests/remarkability-reader-evidence.test.ts`
- Modify: `tests/commands.test.ts`
- Modify: `tests/context.test.ts`

**Interfaces:**
- Consumes: `initializeProject`, `buildChapterContext`, `schemaForPath`, `assertSchema`, `registerNovelForge`.
- Produces: executable expectations for the two new artifacts, context inclusion, and `/novel-readers` registration.

- [ ] **Step 1: Write tests that require new projects to contain valid `remarkability.yaml` and `reader-experiments.yaml`.**
- [ ] **Step 2: Write a context test requiring the retellable hook and signature-moment text to appear in bounded chapter context.**
- [ ] **Step 3: Update command-registration expectations to include `/novel-readers`.**
- [ ] **Step 4: Run `npm test` and verify the new tests fail because the schemas, templates, context section, and command do not exist.**
- [ ] **Step 5: Commit the red tests.**

### Task 2: Implement typed remarkability and reader experiment artifacts

**Files:**
- Modify: `src/domain/schemas.ts`
- Modify: `src/project/templates.ts`
- Create: `references/templates/novel/remarkability.yaml`
- Create: `references/templates/novel/reader-experiments.yaml`
- Modify: `scripts/validate-genesis-package.mjs`

**Interfaces:**
- Produces: `RemarkabilitySchema`, `RemarkabilityState`, `ReaderExperimentsSchema`, `ReaderExperimentsState`, and schema-path registration.

- [ ] **Step 1: Add TypeBox schemas for signature moments, productive disagreement, recurring motifs, real reader responses, experiment metrics, experiment status, and verdict.**
- [ ] **Step 2: Scaffold conservative empty artifacts for every new book.**
- [ ] **Step 3: Register both paths in `schemaForPath`.**
- [ ] **Step 4: Add reference templates and package-validation assertions.**
- [ ] **Step 5: Run typecheck and targeted tests until green.**

### Task 3: Integrate remarkability into planning and bounded drafting context

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/context/context-builder.ts`
- Modify: `references/prompts/shared/book-plan.md`
- Modify: `references/prompts/shared/chapter-draft.md`

**Interfaces:**
- Book-plan events may write `books/<book-id>/remarkability.yaml` and must include it as a required planning output.
- `buildChapterContext` includes a capped `Remarkability contract` section.

- [ ] **Step 1: Add `remarkability.yaml` to the book-plan allowlist and required-output validation.**
- [ ] **Step 2: Update book-planning prompts with the safe/obvious version, author-only advantage, productive discomfort, signature moments, retellable hook, disagreement, residue, hand-sell reason, and accepted-reader-cost questions.**
- [ ] **Step 3: Parse and validate the remarkability artifact when building chapter context.**
- [ ] **Step 4: Include only the compact structured contract in the drafting context with a strict character cap.**
- [ ] **Step 5: Run context, event, schema, and profile tests.**

### Task 4: Add guarded real-reader experiment workflow

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/authorization.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/pi/extension.ts`
- Modify: `references/prompts/shared/review.md`
- Modify: `tests/event-application.test.ts`
- Create: `tests/reader-event.test.ts`

**Interfaces:**
- New event type: `reader-test`.
- New operation: `reader-test`.
- New command: `/novel-readers <first-page|first-chapter|sample|act|manuscript|record>`.
- Reader-test events allow only `books/<book-id>/reader-experiments.yaml` and `books/<book-id>/revision-tickets.yaml`.

- [ ] **Step 1: Add failing event tests for allowed reader-evidence writes and rejected manuscript writes.**
- [ ] **Step 2: Allow reader testing during drafting, act review, revision, manuscript review, and packaging, including pending creative gates.**
- [ ] **Step 3: Add a reader-test prompt that separates immediate and 24–72-hour delayed sessions, de-identifies readers, records verbatim language, and leaves validation blocked when real evidence is missing.**
- [ ] **Step 4: Add the Pi command and tool enum entry.**
- [ ] **Step 5: Keep project/book stage unchanged after reader-test events while refreshing derived status and optionally creating evidence-backed revision tickets.**
- [ ] **Step 6: Run targeted and full tests.**

### Task 5: Strengthen evaluation and documentation

**Files:**
- Modify: `evals/rubrics/blinded-editorial-review.md`
- Create: `evals/rubrics/delayed-reader-recall.md`
- Modify: `evals/README.md`
- Modify: `README.md`
- Modify: `SKILL.md`

**Interfaces:**
- Produces a manual delayed-reader protocol and product documentation for the new artifacts and command.

- [ ] **Step 1: Add memorability, retellability, productive disagreement, residue, and specific recommendation language to the blinded editorial rubric.**
- [ ] **Step 2: Add a delayed-reader rubric measuring unprompted hook recall, signature-moment recall, friend-description specificity, recommendation reason, disagreement, lingering question, and whether the reader told someone.**
- [ ] **Step 3: Document that reader evidence is segmented and distributed, never averaged into a false universal score.**
- [ ] **Step 4: Document `/novel-readers` and the two new artifacts.**
- [ ] **Step 5: Run `npm run typecheck`, `npm test`, `npm run eval`, package validation, and package smoke checks through CI.**

### Task 6: Publish for review

**Files:**
- Review all changed files.

- [ ] **Step 1: Confirm the red test commit failed for the intended missing behavior.**
- [ ] **Step 2: Confirm the implementation commit passes all CI jobs.**
- [ ] **Step 3: Open a draft pull request targeting `novel-forge-v1` with the behavior, safeguards, and verification evidence.**

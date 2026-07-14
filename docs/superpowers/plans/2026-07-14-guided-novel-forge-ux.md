# Guided Novel Forge UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Novel Forge operable through `/novel-start` and a single guided `/novel` command while preserving all existing workflow, evidence, schema, authorization, and Git safeguards.

**Architecture:** Add a pure guidance layer that translates project state into friendly decisions, then bind it to Pi's existing command UI. Keep specialist commands and the guarded event engine intact. Derived `STATUS.md`, `HANDOFF.md`, reader kits, adoption reports, recovery operations, and version compatibility are implemented as focused application modules with real temporary-project tests.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, Pi Coding Agent 0.80.3, TypeBox, YAML, Node built-ins, Node test runner, GitHub Actions.

## Global Constraints

- Do not add a web application, database, UI framework, or runtime dependency.
- Do not weaken `novel_apply_event`, stage authorization, active human gates, reference validation, or file allowlists.
- Preserve all existing specialist commands as compatible power-user aliases.
- Only `source: human` reader rows count as outside-reader evidence.
- Never overwrite an existing imported manuscript chapter.
- Undo uses `git revert`; never reset, force-push, or rewrite project history.
- Keep existing projects readable when `novel_forge_version` is missing.
- Work only on `agent/guided-novel-forge-ux`; open a PR against `main` and leave it unmerged.

---

### Task 1: Version contract, project entry files, and release documentation

**Files:**
- Create: `src/application/version.ts`
- Create: `tests/version.test.ts`
- Create: `CHANGELOG.md`
- Create: `RELEASE.md`
- Modify: `src/domain/schemas.ts`
- Modify: `src/project/templates.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `SKILL.md`

**Interfaces:**
- Produces: `NOVEL_FORGE_VERSION: "1.1.0"`
- Produces: `versionFindings(project: ProjectState): VersionFinding[]`
- Produces: `upgradeProjectVersion(root: string): string`
- Extends: `ProjectState.novel_forge_version?: string`

- [ ] **Step 1: Write failing compatibility tests**

Add tests that initialize a project and assert `PROJECT.yaml`, `START-HERE.md`, and `HANDOFF.md` exist; new projects record `novel_forge_version: "1.1.0"`; missing/older versions produce warnings; newer versions produce a blocker; metadata upgrade writes `1.1.0` without changing stage or gate state.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
node --import tsx --test tests/version.test.ts
```

Expected: failures because version helpers and new template files do not exist.

- [ ] **Step 3: Implement the minimal version and template changes**

Use an optional schema field:

```ts
novel_forge_version: Type.Optional(Type.String({ minLength: 1 }))
```

Implement semantic numeric comparison for `major.minor.patch`. Treat malformed, missing, and older versions as warnings; a greater version is a blocker. Upgrade through `writeProjectEvent` with message `Novel Forge: upgrade project metadata`.

Add initial `START-HERE.md` containing only `/novel`, the three author-facing files, and a pointer to advanced commands. Add initial `HANDOFF.md` without requiring project reads during template construction.

- [ ] **Step 4: Verify focused and existing schema/store tests pass**

Run:

```bash
node --import tsx --test tests/version.test.ts tests/schema.test.ts tests/project-store.test.ts
```

Expected: all pass.

- [ ] **Step 5: Update release files**

Set package and lockfile versions to `1.1.0`. Document install as:

```bash
pi install git:github.com/dustinober1/pi-book@v1.1.0
```

Add a two-minute quick start centered on `/novel-start` and `/novel`, a power-user command appendix, changelog entry, and a release checklist that requires merged-green CI before tagging.

- [ ] **Step 6: Commit**

```bash
git add src/application/version.ts src/domain/schemas.ts src/project/templates.ts tests/version.test.ts package.json package-lock.json README.md SKILL.md CHANGELOG.md RELEASE.md
git commit -m "feat: add Novel Forge version contract"
```

### Task 2: Pure guided decision model and decision-oriented status

**Files:**
- Create: `src/application/guide.ts`
- Create: `tests/guide.test.ts`
- Modify: `src/application/status.ts`
- Modify: `tests/status-reader-impact.test.ts`

**Interfaces:**
- Produces: `GuideActionId`
- Produces: `GuideAction { id; label; description; kind }`
- Produces: `GuideScreen { title; summary; primary; actions; evidencePaths }`
- Produces: `buildGuideScreen(root: string): GuideScreen`
- Extends: `ProjectStatus` with `headline`, `reason`, `recommendedCommand`, and `primaryBlocker`

- [ ] **Step 1: Write failing guide tests**

Cover every stage plus pending and rejected gates. Assert pending gates use friendly titles and expose `approve`, `request-changes`, and `view-evidence`; rejected gates expose `repair`; complete stage exposes `add-book`; ordinary stages expose exactly one primary `continue` action.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/guide.test.ts tests/status-reader-impact.test.ts
```

Expected: failures for missing guide module and old status layout.

- [ ] **Step 3: Implement guide mappings**

Create explicit gate metadata for all current gates. Build screens from `readProject`, `readBook`, and `getProjectStatus`. Do not parse Markdown to make decisions.

- [ ] **Step 4: Rewrite status rendering**

Render sections in this order:

```text
# Novel Forge
## What needs you
## Recommended action
## Why this stopped
## Project snapshot
## Blockers
## Warnings
## Recent files
```

Pending/rejected gates receive specific recovery text. Other blockers use the first blocker. A healthy project recommends `/novel` and includes the specialist command only in details.

- [ ] **Step 5: Verify green**

```bash
node --import tsx --test tests/guide.test.ts tests/status-reader-impact.test.ts tests/workflow.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/guide.ts src/application/status.ts tests/guide.test.ts tests/status-reader-impact.test.ts
git commit -m "feat: add guided project decisions"
```

### Task 3: Durable handoff and guidance refresh

**Files:**
- Create: `src/application/handoff.ts`
- Create: `tests/handoff.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/run.ts`
- Modify: `src/project/store.ts`
- Modify: `src/project/add-book.ts`

**Interfaces:**
- Produces: `renderHandoff(project, book, status, options?): string`
- Produces: `refreshGuidance(root: string, options?): ProjectStatus`
- Produces: `guidanceChanges(root, projectedProject, projectedBook, options?): FileChange[]`

- [ ] **Step 1: Write failing handoff tests**

Assert handoff contains project/book/stage, `<branch> @ HEAD`, project hash, last action, active gate/blocker, chapter and word count, read-first paths, protected direct-edit paths, exact `/novel` next command, and a continuation prompt. Assert a guarded voice event updates both status and handoff in the same checkpoint file set.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/handoff.test.ts tests/event-application.test.ts
```

Expected: failures because handoff rendering and event integration are absent.

- [ ] **Step 3: Implement pure rendering and refresh**

Use `gitState` for branch only and `projectStateHash` for exact state identity. Summarize current approvals and locked-book state without inventing canon details. Generate the continuation prompt from structured state.

- [ ] **Step 4: Integrate all deterministic writes**

`applyNovelEvent` adds `STATUS.md` and `HANDOFF.md` before its transaction. Gate approval/rejection, version upgrade, add-book, and explicit status refresh use `refreshGuidance` or include both derived files in their transaction.

- [ ] **Step 5: Verify green**

```bash
node --import tsx --test tests/handoff.test.ts tests/event-application.test.ts tests/add-book.test.ts tests/pi-runtime.test.ts
```

Expected: all pass and existing one-event checkpoint behavior remains intact.

- [ ] **Step 6: Commit**

```bash
git add src/application/handoff.ts src/application/events.ts src/application/run.ts src/project/store.ts src/project/add-book.ts tests/handoff.test.ts
git commit -m "feat: generate durable project handoffs"
```

### Task 4: Root `/novel` command, friendly gate cards, and planning interviews

**Files:**
- Modify: `src/pi/extension.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/gates.ts`
- Modify: `src/application/prompts.ts`
- Modify: `tests/pi-runtime.test.ts`
- Create: `tests/planning-interviews.test.ts`

**Interfaces:**
- Produces: `rejectProjectGate(root: string, gate: string, note: string): RunDecision`
- Produces: root command `novel`
- Keeps: all existing `novel-*` commands

- [ ] **Step 1: Write failing Pi boundary tests**

Register the real extension and assert command `novel` exists. Exercise a pending voice gate with fake Pi UI selections: view status, view evidence, request changes with a note, repair, and approve. Assert the caller never supplies `voice-approval` manually.

- [ ] **Step 2: Write failing prompt tests**

Assert voice, series, and book prompts say questions are asked one at a time, cap normal interviews at four, use existing evidence first, and include the four primary book questions while still requiring complete typed artifacts.

- [ ] **Step 3: Verify red**

```bash
node --import tsx --test tests/pi-runtime.test.ts tests/planning-interviews.test.ts
```

Expected: missing command/rejection behavior and old questionnaire copy.

- [ ] **Step 4: Implement friendly gate decisions**

Add a gate-decision log at `books/<book-id>/gate-decisions.md` for rejected decisions. Rejection must be a project event checkpoint and must not change the owner stage. Approval continues through `approveGate` and evidence hashing.

- [ ] **Step 5: Implement `/novel`**

Use `buildGuideScreen` and Pi UI. With no project, notify the user to run `/novel-start`. For normal stages, selecting Continue queues the existing `decideNextRun` decision. Pending/rejected gates use friendly labels. Advanced options route to deterministic helpers added in later tasks and remain safe when unavailable.

- [ ] **Step 6: Simplify planning prompts**

Tell the agent to inspect existing evidence first, ask one unresolved question at a time, ask no more than four normal questions, derive the complete contract internally, and ask one extra question only for a genuine blocker.

- [ ] **Step 7: Verify green**

```bash
node --import tsx --test tests/pi-runtime.test.ts tests/planning-interviews.test.ts tests/authorization.test.ts
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/pi/extension.ts src/application/run.ts src/application/gates.ts src/application/prompts.ts tests/pi-runtime.test.ts tests/planning-interviews.test.ts
git commit -m "feat: add guided novel command"
```

### Task 5: Guarded recovery, blocker explanation, and repair tools

**Files:**
- Create: `src/application/recovery.ts`
- Create: `tests/recovery.test.ts`
- Modify: `src/infrastructure/git.ts`
- Modify: `src/pi/extension.ts`

**Interfaces:**
- Produces: `inspectUndo(root: string): UndoInspection`
- Produces: `undoLastNovelEvent(root: string, allowApprovalReversal?: boolean): UndoResult`
- Produces: `explainFirstBlocker(root: string): string`
- Produces: `runIntegritySummary(root: string): string`

- [ ] **Step 1: Write failing recovery tests**

Create temporary Git projects and assert undo rejects dirty trees, non-Novel-Forge `HEAD`, and approval commits without explicit permission. Assert a normal Novel Forge event is reverted with a new revert commit and guidance is rebuilt. Assert blocker explanation names the blocker and exact `/novel` recovery action.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/recovery.test.ts
```

Expected: missing recovery module.

- [ ] **Step 3: Add safe Git primitives**

Add internal Git helpers for `HEAD` subject/SHA and `git revert --no-edit HEAD`. Return structured results; never expose reset or force operations.

- [ ] **Step 4: Implement recovery actions and guided bindings**

Advanced `/novel` actions require confirmation before undo, and a second explicit confirmation for approval reversal. Rebuild writes only derived guidance files. Integrity summary uses `collectProjectIntegrityFindings` and does not mutate creative files.

- [ ] **Step 5: Verify green**

```bash
node --import tsx --test tests/recovery.test.ts tests/transaction.test.ts tests/context-integrity.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/recovery.ts src/infrastructure/git.ts src/pi/extension.ts tests/recovery.test.ts
git commit -m "feat: add guarded recovery tools"
```

### Task 6: Existing-manuscript adoption

**Files:**
- Create: `src/application/adoption.ts`
- Create: `tests/adoption.test.ts`
- Modify: `src/pi/extension.ts`

**Interfaces:**
- Produces: `adoptManuscript(root: string, sourcePath: string): AdoptionResult`
- Produces: administrative command `novel-adopt`

- [ ] **Step 1: Write failing adoption tests**

Cover a numerically named directory, a single file with Markdown chapter headings, a single file with plain `Chapter N` headings, a heading-free file, source preservation, normalized destination names, accurate chapter/word totals, adoption report creation, and rejection when destination chapters already exist.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/adoption.test.ts
```

Expected: missing adoption module.

- [ ] **Step 3: Implement import parsing**

Use Node filesystem/path only. Normalize chapters to `NN-imported-<slug>.md`. Preserve chapter heading text. Sort directory files by leading number and then filename. Reject empty imports and more than 999 chapters.

- [ ] **Step 4: Apply one checkpoint**

Write chapter files, `adoption-report.md`, updated `BOOK.yaml`, `STATUS.md`, and `HANDOFF.md` through one `writeProjectEvent`. Do not change stage, gates, canon, queue, plot, or reader evidence.

- [ ] **Step 5: Bind command and advanced action**

`/novel-adopt <path>` accepts a quoted path. The guided action asks for a path through `ui.input`, displays the discovered chapter count, and requires confirmation.

- [ ] **Step 6: Verify green**

```bash
node --import tsx --test tests/adoption.test.ts tests/project-store.test.ts tests/pi-runtime.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/application/adoption.ts src/pi/extension.ts tests/adoption.test.ts
git commit -m "feat: add manuscript adoption"
```

### Task 7: Reader-kit generation and CSV import

**Files:**
- Create: `src/application/reader-kit.ts`
- Create: `tests/reader-kit.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/prompts.ts`

**Interfaces:**
- Produces: `prepareReaderKit(root: string, input: ReaderKitInput): NovelEventResult`
- Produces: `importReaderResponses(root: string, experimentId: string, csvPath?: string): NovelEventResult`
- Extends reader-test allowlist to `books/<book-id>/reader-kit/*`

- [ ] **Step 1: Write failing reader-kit tests**

Assert kit preparation writes the four files and a planned experiment with predeclared target segment/minimum/delay. Assert CSV import handles quoted commas and semicolon-separated list fields, rejects `source != human`, duplicate phase/reader rows, invalid booleans, unknown experiments, and unmatched delayed rows. Assert computed metrics equal response rows and remain schema-valid.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/reader-kit.test.ts tests/reader-event.test.ts
```

Expected: missing module and reader-kit path rejection.

- [ ] **Step 3: Implement deterministic kit preparation**

Generate exact questionnaires from the existing reader-evidence contract. For `first-page`, copy at most the first 900 words; for `first-chapter`, copy Chapter 1; for `sample`, `act`, and `manuscript`, require an explicit existing sample path. Use a new `RE-NNN` ID when none is supplied.

- [ ] **Step 4: Implement strict CSV parser/importer**

Support RFC-style quoted fields and escaped double quotes. Parse booleans as `true`, `false`, or blank. Parse list fields with `;`. Compute rates using the same definitions as `readerExperimentFindings`. Set status from collected phases and leave verdict `blocked` or `insufficient-signal` unless the prior verdict remains valid under the new rows.

- [ ] **Step 5: Apply through `novel_apply_event` rules**

Both preparation and import call `applyNovelEvent` with `reader-test`, current stage, and current project hash. Reader-kit files are allowed only under the active book's reader-kit directory. They cannot alter prose, PROJECT, BOOK, or workflow stage directly.

- [ ] **Step 6: Bind guided and specialist commands**

Support:

```text
/novel-readers kit first-chapter
/novel-readers import RE-001 [path]
```

The root command asks for target segment, minimum reader count, and delay using Pi UI.

- [ ] **Step 7: Verify green**

```bash
node --import tsx --test tests/reader-kit.test.ts tests/reader-event.test.ts tests/reader-impact-validation.test.ts tests/remarkability-reader-evidence.test.ts
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/application/reader-kit.ts src/application/events.ts src/application/prompts.ts src/pi/extension.ts tests/reader-kit.test.ts
git commit -m "feat: add real-reader kit workflow"
```

### Task 8: Packaging checklist, contextual next book, complete documentation, and full verification

**Files:**
- Create: `src/application/package-checklist.ts`
- Create: `tests/package-guidance.test.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/project/add-book.ts`
- Modify: `README.md`
- Modify: `SKILL.md`

**Interfaces:**
- Produces: `buildPackagingChecklist(root: string): PackagingChecklist`
- Produces: `nextBookProposal(root: string): NextBookProposal`

- [ ] **Step 1: Write failing packaging and next-book tests**

Assert checklist reports manuscript approval, canon lock, blocking tickets, chapter compilation readiness, reader-evidence claim limits, and package artifact state. Assert complete-stage guide proposes the next identifier and refuses ordinary expansion when the current book is not locked/packaged.

- [ ] **Step 2: Verify red**

```bash
node --import tsx --test tests/package-guidance.test.ts tests/add-book.test.ts
```

Expected: missing checklist/proposal helpers.

- [ ] **Step 3: Implement checklist and guided confirmation**

At packaging, `/novel` displays the checklist and asks for confirmation before `compileActiveBook` and `packagePrompt`. It never claims external validation when reader evidence is absent or insufficient.

- [ ] **Step 4: Implement context-aware next-book flow**

At complete stage, show the proposed `book-NN`, previous lock/package state, inherited default profile, and target-word default. Ask only for target words and confirmation. Keep `--force` under Advanced options.

- [ ] **Step 5: Finish documentation**

Document `/novel-adopt`, reader kits, recovery, status/handoff semantics, package checklist, next-book flow, backward-compatible specialist commands, and the post-merge `v1.1.0` tagging requirement.

- [ ] **Step 6: Run focused tests**

```bash
node --import tsx --test tests/package-guidance.test.ts tests/add-book.test.ts tests/pi-runtime.test.ts
```

Expected: all pass.

- [ ] **Step 7: Run complete verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected: zero failures on Node 22.19.0 and Node 24 in GitHub Actions.

- [ ] **Step 8: Review requirements and diff**

Confirm every design section has code/tests/docs, no new runtime dependency exists, all new files are included by the package `files` field, and the README normal path requires only `/novel-start` plus `/novel`.

- [ ] **Step 9: Commit**

```bash
git add src/application/package-checklist.ts src/application/prompts.ts src/project/add-book.ts src/pi/extension.ts tests/package-guidance.test.ts README.md SKILL.md
git commit -m "feat: complete guided Novel Forge workflow"
```

- [ ] **Step 10: Open an unmerged PR**

Open a PR from `agent/guided-novel-forge-ux` to `main` with the full verification matrix, migration/compatibility notes, and release-tag follow-up. Do not merge or create `v1.1.0` until explicitly requested after green CI.
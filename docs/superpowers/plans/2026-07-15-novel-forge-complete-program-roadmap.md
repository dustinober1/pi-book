# Novel Forge Complete Program Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every implementation PR below must receive its own detailed TDD implementation plan before code changes begin.

**Goal:** Complete Novel Forge 1.3 and then add faster author intake, resumable automation, stronger continuity knowledge, adversarial editorial review, surgical revision, phase-aware adoption, manuscript reconstruction, and reusable author defaults without weakening human gates or over-constraining prose.

**Architecture:** Preserve `/novel` as the normal author interface and the existing typed, transactional, Git-checkpointed workflow. Add capabilities in three release trains after 1.3: Author Velocity, Editorial Intelligence, and Adoption & Reuse. Each feature is introduced through a focused typed contract, pure application service, guarded event or trusted wizard service, bounded context builder, deterministic test suite, and backward-compatible status guidance.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, Pi Coding Agent 0.80.3, TypeBox, YAML, static browser HTML/CSS/JavaScript, Node test runner, existing Novel Forge transaction and Git infrastructure, deterministic local audits, DOCX/EPUB adoption services, and the existing in-memory continuity graph.

## Global Constraints

- Finish and release Novel Forge `1.3.0` before any `1.4.0` implementation branch begins.
- PR #10 remains the active 1.3 Phase 2 branch and must pass the repository's documented manual Node 22.19.0 and Node 24 verification before merge.
- `/novel` remains the primary author interface. New specialist commands are optional precision tools.
- Never bypass an active human gate or manufacture writer approval.
- Never treat model, persona, swarm, or simulated-reader output as human reader evidence.
- Never put named-author imitation instructions, raw influence names, private influence evidence, or voice-experiment prose into drafting context.
- Canonical YAML and approved manuscript files remain authoritative. Derived reports, phase packets, summaries, graphs, and indexes are disposable or reproducible.
- The browser remains loopback-only, credentialed, exact-origin checked, session-expiring, and unable to write project files or invoke arbitrary commands directly.
- Every accepted mutation uses typed validation, expected-stage and project-hash checks, rollback, one Git checkpoint, and refreshed `STATUS.md` and `HANDOFF.md`.
- Do not add a hosted graph database, vector database, embeddings service, telemetry service, analytics SDK, or remote runtime dependency.
- Do not add a new top-level creative stage. Sub-workflows and evidence gates must operate inside the existing stages.
- Existing projects remain readable. New schema fields are optional at parse time and receive deterministic runtime defaults until an explicit workflow writes them.
- Metadata-only upgrades never invent assumptions, decisions, research, premise selections, reader evidence, audit findings, or manuscript content.
- Drafting defaults to low-pressure Craft behavior: draft from approved bounded context, run deterministic integrity checks, and defer literary judgment to milestones.
- Specialist dialogue, hook, pacing, or prose diagnostics are triggered by evidence or an explicit Guarded mode, not automatically forced onto every chapter.
- There is no automatic chaos injection, no mandatory artificial roughness, and no internal numeric score marketed as objective bestseller quality.
- Failed events are never skipped and missing outputs are never replaced with fabricated stubs.
- Every PR is independently testable and reviewable and uses TDD with logically separated commits.
- No release tag is created until merged `main` passes `npm ci`, `npm run typecheck`, `npm test`, `npm run eval`, and `npm pack --dry-run` under Node 22.19.0 and Node 24.

---

## Program Release Train

| Release | Product theme | Principal outcome |
|---|---|---|
| `1.3.0` | Author taste and reader friction | Original voice calibration, research-to-drama evidence, strategy, voice/scene audits, and research wizard |
| `1.4.0` | Author Velocity | Start from a brief, make assumptions visible, compare premise engines, resume long runs, refill chapter windows, and advance automatically to the next writer decision |
| `1.5.0` | Editorial Intelligence | Track character knowledge, isolate writer/auditor/editor contexts, run evidence-backed postflight and adversarial audit, and execute surgical dependency-aware revisions |
| `1.6.0` | Adoption & Reuse | Enter at the correct phase, reconstruct an existing manuscript with provenance, and reuse safe author defaults across projects |

The release boundaries are intentional. Do not combine all capabilities into one version or one PR. A smaller merge train protects prose quality, keeps compatibility review comprehensible, and allows real author-journey measurements after each release.

---

# Release 1.3.0 — Complete the Existing Roadmap

The controlling plan remains:

`docs/superpowers/plans/2026-07-15-author-taste-reader-friction-master-roadmap.md`

Do not duplicate or rename its seven phases. Complete them in order.

## 1.3 PR sequence

1. **Phase 2 — Influence Palette and voice calibration**
   - Current implementation: PR #10, branch `agent/v1.3-phase-2-influence-voice`.
   - Required before merge: local Node 22.19.0 and Node 24 verification exactly as documented in the PR.
2. **Phase 3 — Research ledger and review-observation analysis**
3. **Phase 4 — Book strategy, architecture, and graph integration**
4. **Phase 5 — Voice drift, scene diversity, and revision learning**
5. **Phase 6 — Guided research wizard**
6. **Phase 7 — Evaluation, documentation, compatibility verification, and release**

## 1.3 exit gate

- [ ] All seven roadmap phases are merged.
- [ ] `main` passes the full verification matrix on Node 22.19.0 and Node 24.
- [ ] A clean project exercises taste intake, voice comparison, research update, book strategy, graph-selected research, voice audit, reader evidence, packaging, and next-book creation.
- [ ] `v1.3.0` is created only on the verified merged `main` commit.
- [ ] A clean install from `v1.3.0` completes `/novel-start` and `/novel` smoke tests.

No 1.4 code branch starts before this gate is complete. Documentation planning branches may exist, but they must not be used as implementation bases.

---

# Release 1.4.0 — Author Velocity

## 1.4 architecture

Add a typed intake and decision layer above the existing planning artifacts, a structured rejection protocol below all model and wizard mutations, and a persistent automation coordinator around the existing `/novel-run` decisions. Keep creative state in the current workflow stages. The coordinator may execute multiple guarded events, but each event remains atomic and the run stops at gates, blockers, exhausted retry policy, or author-requested limits.

## 1.4 file map

### New domain and application units

- `src/domain/v1-4-schemas.ts` — intake, decision ledger, premise lab, automation run, and structured rejection contracts.
- `src/domain/v1-4-schema-registry.ts` — path-aware schema registration and compatibility helpers.
- `src/application/event-rejection.ts` — typed event and wizard rejection classes plus serialization.
- `src/application/intake.ts` — intake defaults, validation, assumption status changes, and decision recording.
- `src/application/premise-lab.ts` — premise variant validation, comparison summaries, selection rules, and book-plan integration.
- `src/application/automation-run.ts` — persistent run creation, resume, pause, cancellation, event completion, retry counters, and stop reasons.
- `src/application/automation-policy.ts` — allowed targets, safe retry rules, refill limits, and stop conditions.
- `src/application/chapter-window.ts` — ready-packet inventory, refill proposal requirements, duplicate prevention, and bounded-window selection.
- `src/application/autopilot.ts` — stage-to-stage orchestration until the requested gate or milestone.
- `src/application/intake-wizard.ts` — typed wizard handler for intake and premise proposals.

### Existing files expected to change

- `src/domain/schemas.ts`
- `src/project/templates.ts`
- `src/project/store.ts`
- `src/application/events.ts`
- `src/application/project-hash.ts`
- `src/application/run.ts`
- `src/application/prompts.ts`
- `src/application/guide.ts`
- `src/application/status.ts`
- `src/application/handoff.ts`
- `src/application/integrity.ts`
- `src/application/wizard.ts`
- `src/application/wizard-launch.ts`
- `src/pi/arguments.ts`
- `src/pi/extension.ts`
- `src/wizard/types.ts`
- `README.md`
- `SKILL.md`
- `CHANGELOG.md`
- `RELEASE.md`
- `package.json`
- `scripts/evaluate-fixtures.ts`

### New canonical project files for new 1.4 projects

```text
series/intake.yaml
series/decision-ledger.yaml
books/book-01/premise-lab.yaml
```

Existing projects without these files remain readable and receive one consolidated optional-backfill advisory. The files become required only when the author invokes the matching intake, premise, or rebuilt book-plan workflow.

---

## PR 1.4-1 — Author-journey throughput baselines

**Goal:** Establish deterministic measurements before changing automation behavior.

**Files:**

- Create: `src/evaluation/author-journey.ts`
- Create: `tests/author-journey.test.ts`
- Create: `tests/e2e/author-velocity-baseline.test.ts`
- Create: `evals/journeys/brief-to-book-plan.yaml`
- Create: `evals/journeys/six-packets-to-ten-chapters.yaml`
- Create: `evals/journeys/resume-after-four-chapters.yaml`
- Create: `evals/journeys/twelve-revision-tickets.yaml`
- Modify: `scripts/evaluate-fixtures.ts`
- Modify: `package.json`

**Interfaces:**

```ts
export interface AuthorJourneyMetrics {
  authorQuestions: number;
  modelPrompts: number;
  guardedEvents: number;
  rejectedEvents: number;
  retries: number;
  writerApprovals: number;
  chaptersCompleted: number;
  contextCharacters: number;
  stopReason: string;
}

export function evaluateAuthorJourney(
  fixture: AuthorJourneyFixture,
  trace: AuthorJourneyTrace,
): AuthorJourneyMetrics;
```

**Behavioral requirements:**

- Measurements are counts and state transitions, not wall-clock timings.
- Fixtures assert maximum questions, prompts, rejected events, and retries.
- The baseline records current limitations without pretending they already pass future targets.
- `npm run eval` continues to evaluate existing architecture fixtures and adds an author-journey section.

**Required tests:**

- [ ] A journey with four author questions reports exactly four.
- [ ] Duplicate chapter events do not increase `chaptersCompleted`.
- [ ] A paused run and resumed run are one logical journey.
- [ ] A human gate produces `stopReason: "human-gate"`.
- [ ] An event rejection increments `rejectedEvents` and a permitted resubmission increments `retries`.

**Verification:**

```bash
node --import tsx --test tests/author-journey.test.ts tests/e2e/author-velocity-baseline.test.ts
npm run eval
```

**Commit boundaries:** tests and fixture contracts first; metric implementation second; script/package integration third.

---

## PR 1.4-2 — Structured event rejections and bounded retry policy

**Goal:** Replace opaque error strings with machine-readable rejection details while preserving human-readable messages.

**Files:**

- Create: `src/application/event-rejection.ts`
- Create: `tests/event-rejection.test.ts`
- Create: `tests/e2e/structured-rejection.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/wizard.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/prompts.ts`

**Interfaces:**

```ts
export type EventRejectionCode =
  | "schema-validation"
  | "reference-validation"
  | "wrong-stage"
  | "stale-stage"
  | "stale-project-hash"
  | "allowlist-violation"
  | "human-gate-required"
  | "integrity-failure"
  | "filesystem-failure"
  | "unknown";

export interface EventRejectionDetail {
  code: EventRejectionCode;
  message: string;
  retryable: boolean;
  requiresReload: boolean;
  invalidPaths: string[];
  issues: Array<{ path: string; expected: string; received: string }>;
  currentStage: string;
  currentProjectHash: string;
}

export class NovelEventRejection extends Error {
  readonly detail: EventRejectionDetail;
}
```

**Policy:**

- Schema and reference failures may be resubmitted once after correcting only the rejected event payload.
- Stale stage/hash failures require a state reload and terminate the current attempt.
- Human gates, allowlist violations, integrity failures, and filesystem failures are never automatically retried.
- The public `novel_apply_event` response contains both concise text and the structured detail object.
- Existing tests that assert error text remain valid or are updated to assert both message and code.

**Required tests:**

- [ ] Invalid YAML returns `schema-validation`, the exact path, and `retryable: true`.
- [ ] Missing canon or research references return `reference-validation`.
- [ ] Stale hashes return `stale-project-hash`, `requiresReload: true`, and `retryable: false`.
- [ ] Disallowed files return `allowlist-violation` and no retry permission.
- [ ] Wizard stale proposals use the same rejection envelope.
- [ ] Unknown thrown values are normalized without exposing stack traces or absolute paths.

**Verification:**

```bash
node --import tsx --test tests/event-rejection.test.ts tests/e2e/structured-rejection.test.ts tests/research-event.test.ts tests/wizard-runtime.test.ts
npm run typecheck
```

---

## PR 1.4-3 — Typed intake, assumptions, and decision provenance

**Goal:** Let Novel Forge infer missing setup details without silently converting guesses into facts.

**Files:**

- Create: `src/domain/v1-4-schemas.ts`
- Create: `src/domain/v1-4-schema-registry.ts`
- Create: `src/application/intake.ts`
- Create: `tests/v1-4-schemas.test.ts`
- Create: `tests/intake-decisions.test.ts`
- Create: `tests/v1-4-compatibility.test.ts`
- Modify: `src/domain/schemas.ts`
- Modify: `src/project/templates.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/project-hash.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`
- Modify: `src/application/prompts.ts`

**Canonical contracts:**

```ts
export type AssumptionStatus =
  | "inferred"
  | "confirmed"
  | "corrected"
  | "rejected"
  | "superseded";

export interface AssumptionRecord {
  id: string;
  scope: "project" | `book-${string}`;
  subject: string;
  value: string;
  status: AssumptionStatus;
  source: { type: "author-input" | "authorized-file" | "inference"; path: string };
  confidence: "low" | "moderate" | "high";
  affects: string[];
  supersedes: string | null;
}

export interface WriterDecisionRecord {
  id: string;
  scope: "project" | `book-${string}`;
  subject: string;
  choice: string;
  decidedAt: string;
  evidenceRefs: string[];
  replaces: string | null;
}
```

`series/intake.yaml` stores the original idea, authorized brief/sample references, inferred language/profile/audience/target length, and unresolved intake blockers. `series/decision-ledger.yaml` stores assumptions and explicit writer decisions.

**Event behavior:**

- Add a state-neutral `intake-update` event allowed during voice intake, series planning, and book planning.
- It may write only `series/intake.yaml` and `series/decision-ledger.yaml`.
- It cannot advance stage, approve gates, write manuscript prose, or alter publishing/reader evidence.
- Confirming or correcting an assumption creates an immutable decision record rather than silently rewriting history.

**Required tests:**

- [ ] New projects contain valid empty/default intake and decision files.
- [ ] Existing 1.3 projects remain readable when both files are absent.
- [ ] One optional-backfill warning covers both missing files.
- [ ] An inferred genre remains visibly inferred until a writer decision confirms or corrects it.
- [ ] Correcting a target length preserves the original assumption and links the new decision.
- [ ] `intake-update` rejects manuscript and state paths.
- [ ] Rebuilding voice or book plans may consume confirmed decisions but cannot promote inferred assumptions automatically.

**Verification:**

```bash
node --import tsx --test tests/v1-4-schemas.test.ts tests/intake-decisions.test.ts tests/v1-4-compatibility.test.ts tests/research-event.test.ts tests/project-store.test.ts
```

---

## PR 1.4-4 — Premise and story-engine laboratory

**Goal:** Compare multiple recognizable versions of the author's seed before architecture hardens, without allowing model scores to choose for the writer.

**Files:**

- Extend: `src/domain/v1-4-schemas.ts`
- Create: `src/application/premise-lab.ts`
- Create: `src/application/intake-wizard.ts`
- Create: `tests/premise-lab.test.ts`
- Create: `tests/e2e/premise-wizard.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/wizard.ts`
- Modify: `src/application/wizard-launch.ts`
- Modify: `src/wizard/types.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/guide.ts`

**Canonical contract:**

`books/<book-id>/premise-lab.yaml` contains:

- the raw author idea verbatim;
- three to five variants;
- a distinct conflict/escalation engine for every variant;
- the central final-page question;
- immediate gain, deferred cost, irreversible effect, differentiation, series potential, and accepted tradeoffs;
- neutral diagnostic observations rather than a claimed objective score;
- `selected_variant_id`, which remains null until a writer decision exists;
- the decision-ledger ID that authorizes selection.

**Rules:**

- Variant 1 is always the raw idea or the closest faithful expansion.
- Every alternative must preserve recognizable seed elements.
- No variant is selected because it has the highest model-generated score.
- A selected premise is required for a newly rebuilt 1.4 book plan.
- Existing approved 1.3 plans remain valid without a premise-lab file.
- Add `premise` to `WizardWorkflow` and `/novel-wizard premise`.
- The wizard previews comparisons; confirmed selection returns through a typed event.

**Required tests:**

- [ ] Fewer than three or more than five variants are rejected.
- [ ] Duplicate story engines are rejected.
- [ ] Missing raw-idea baseline is rejected.
- [ ] An automatic selection without a writer decision ID is rejected.
- [ ] A selected variant enters book-plan context; nonselected variant prose does not enter chapter drafting context.
- [ ] Named influences remain absent from variant drafting instructions.
- [ ] Stale premise wizard proposals fail through the structured rejection envelope.

**Verification:**

```bash
node --import tsx --test tests/premise-lab.test.ts tests/e2e/premise-wizard.test.ts tests/context.test.ts tests/wizard-runtime.test.ts tests/commands.test.ts
```

---

## PR 1.4-5 — Persistent resumable automation runs

**Goal:** Preserve requested automation intent across context resets, application restarts, pauses, and safe failures.

**Files:**

- Extend: `src/domain/v1-4-schemas.ts`
- Create: `src/application/automation-run.ts`
- Create: `src/application/automation-policy.ts`
- Create: `tests/automation-run.test.ts`
- Create: `tests/e2e/automation-resume.test.ts`
- Modify: `src/domain/schemas.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`
- Modify: `src/application/guide.ts`
- Modify: `src/pi/arguments.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/prompts.ts`

**Project-state extension:**

Add optional `automation.active_run` with:

```ts
export interface AutomationRunState {
  id: string;
  status: "active" | "paused" | "stopped" | "completed" | "cancelled";
  target: string;
  startedStage: string;
  currentAction: string;
  requestedMaxChapters: number;
  completedEventKeys: string[];
  lastProjectHash: string;
  refillCount: number;
  retryCounts: Record<string, number>;
  stopReason: string | null;
  startedAt: string;
  updatedAt: string;
}
```

**Commands:**

```text
/novel-run --until <target>
/novel-run --resume
/novel-run --pause
/novel-run --cancel
```

**Rules:**

- Event keys are deterministic and prevent duplicate chapter or plan events.
- Starting a second active run is rejected unless the first is cancelled.
- Pause and cancel are internal guided transactions, not model-authored events.
- Resume verifies the stored stage and hash. If creative state changed outside the run, it stops with a reload/replan explanation.
- `HANDOFF.md` contains the exact resume command and stop reason.
- Undo of a run-state checkpoint uses the existing guarded Git revert rules.

**Required tests:**

- [ ] Four completed chapter events remain completed after reloading the project.
- [ ] Resume selects Chapter 5 and does not resubmit Chapters 1–4.
- [ ] A changed project hash stops resume before mutation.
- [ ] Pause is idempotent.
- [ ] Cancelled runs cannot resume.
- [ ] Human gates stop a run with `stopReason: "human-gate"`.
- [ ] One structured schema/reference retry is counted; a second failure stops the run.

**Verification:**

```bash
node --import tsx --test tests/automation-run.test.ts tests/e2e/automation-resume.test.ts tests/run-command.test.ts tests/handoff.test.ts tests/recovery.test.ts
```

---

## PR 1.4-6 — Self-refilling chapter windows

**Goal:** Allow a bounded drafting run to continue after its initial packet window is exhausted without duplicating or inventing unsupported chapters.

**Files:**

- Create: `src/application/chapter-window.ts`
- Create: `tests/chapter-window.test.ts`
- Create: `tests/e2e/automation-refill.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/automation-policy.ts`
- Modify: `src/application/automation-run.ts`
- Modify: `src/application/integrity.ts`

**Interfaces:**

```ts
export interface ChapterWindowInventory {
  ready: number[];
  drafted: number[];
  blocked: number[];
  nextExpectedChapter: number;
}

export interface ChapterRefillRequest {
  afterChapter: number;
  maximumPackets: number;
  requiredPlotChapters: number[];
  expectedProjectHash: string;
}

export function inspectChapterWindow(root: string): ChapterWindowInventory;
export function buildChapterRefillRequest(root: string, remainingRunBudget: number): ChapterRefillRequest | null;
```

**Event design:**

Add a distinct `chapter-queue-refill` event. It is allowed only during `drafting`, writes only the active book's `chapter-queue.yaml`, and never changes the top-level stage. It validates every new packet against the approved plot grid, profile, ready research, canon/thread references, existing queue, and already-drafted chapters.

**Rules:**

- Refill triggers only when fewer than two ready packets remain and the run still requests more chapters.
- One refill creates at most six packets and never exceeds the requested run budget.
- A run may refill at most twice unless a later version explicitly changes the policy.
- Missing research, plot entries, or references stops the run; it does not generate speculative filler.
- Existing drafted or ready packet numbers cannot be overwritten.

**Required tests:**

- [ ] Six initial packets can support a ten-chapter run through one refill.
- [ ] Refill cannot replace a drafted packet.
- [ ] Refill cannot include a chapter absent from the plot grid.
- [ ] Refill stops when a required research item is not ready.
- [ ] Refill preserves explicit-before-discovered graph context ordering.
- [ ] Resume after refill uses the persisted queue and run state.

**Verification:**

```bash
node --import tsx --test tests/chapter-window.test.ts tests/e2e/automation-refill.test.ts tests/context.test.ts tests/story-graph.test.ts tests/research-event.test.ts
```

---

## PR 1.4-7 — Idea-to-next-gate autopilot and brief bootstrap

**Goal:** Let an author start from one idea or an authorized brief and automatically advance through safe work until the next genuine writer decision.

**Files:**

- Create: `src/application/autopilot.ts`
- Create: `tests/autopilot.test.ts`
- Create: `tests/e2e/idea-to-book-plan.test.ts`
- Create: `tests/e2e/brief-bootstrap.test.ts`
- Modify: `src/project/store.ts`
- Modify: `src/project/templates.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/guide.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`
- Modify: `src/pi/arguments.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/wizard-launch.ts`

**Commands:**

```text
/novel-start My Novel --profile thriller --type planned-series --target-words 110000 --brief /authorized/path/brief.md --auto-to book-plan-approval
/novel-run --until book-plan-approval
```

**Rules:**

- The brief is read-only and authorized only for the intake session.
- The system records extracted claims as author input and inferred gaps as assumptions.
- Complete briefs may reduce interviews to zero questions; missing material may trigger only questions that block a required artifact.
- Autopilot executes voice, series, premise, and book planning as separate guarded events and reloads state after each event.
- It stops at voice approval, premise selection when no writer decision exists, book-plan approval, any other human gate, structured nonretryable rejection, missing evidence, or requested target.
- It never approves a gate.
- It never chooses a premise variant.
- It never stores source-file contents in chapter drafting context unless they become approved, sanitized project evidence.

**Required tests:**

- [ ] A complete brief reaches book-plan approval with no unnecessary questions.
- [ ] A one-sentence idea creates visible assumptions and stops for unresolved premise selection or approval.
- [ ] A named influence is translated into neutral traits and excluded from drafting context.
- [ ] A rejected voice gate stops autopilot and records the repair target.
- [ ] A restart resumes from the exact current action.
- [ ] The source brief remains unchanged and outside the project package.

**Verification:**

```bash
node --import tsx --test tests/autopilot.test.ts tests/e2e/idea-to-book-plan.test.ts tests/e2e/brief-bootstrap.test.ts tests/commands.test.ts tests/package-smoke.test.ts
npm run eval
```

---

## PR 1.4-8 — Author Velocity wizard, documentation, evaluation, and release

**Goal:** Finish the 1.4 user experience, compatibility path, and release evidence.

**Files:**

- Modify: `wizard/index.html`
- Modify: `wizard/app.js`
- Modify: `wizard/styles.css`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/evaluate-fixtures.ts`
- Create: `tests/e2e/author-velocity-wizard.test.ts`
- Create: `tests/e2e/v1-4-release-journey.test.ts`

**Acceptance journeys:**

1. One-sentence idea → visible assumptions → premise selection → book-plan approval.
2. Complete brief → book-plan approval with no unnecessary interview.
3. Six packets → ten drafted chapters with one safe refill.
4. Stop after Chapter 4 → restart → resume at Chapter 5.
5. One retryable malformed event → correction → success; second failure → stop.
6. Existing 1.3 project opens without mutation and can opt into intake/premise evidence.

**Final verification:**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Run under Node 22.19.0 and Node 24. Create `v1.4.0` only after merged `main` passes every command and a packed-package Pi smoke test.

---

# Release 1.5.0 — Editorial Intelligence

## 1.5 architecture

Add explicit knowledge provenance to the existing graph, then compile different bounded contexts for writer, auditor, and editor roles. Deterministic chapter checks produce evidence, not prose quotas. Manuscript approval requires an adversarial diagnosis. Review lanes remain isolated until a deterministic merge. Revision tickets become surgical work orders and are grouped by dependency rather than arbitrary count.

## 1.5 file map

### New units

- `src/domain/v1-5-schemas.ts`
- `src/domain/v1-5-schema-registry.ts`
- `src/context/role-context.ts`
- `src/context/knowledge-context.ts`
- `src/application/postflight.ts`
- `src/application/adversarial-audit.ts`
- `src/review/lane-runner.ts`
- `src/review/lane-merge.ts`
- `src/review/revision-batch.ts`
- `src/review/ticket-compatibility.ts`
- `src/audits/` pure deterministic audit modules extracted from existing script behavior

### New canonical files

```text
series/knowledge-state.yaml
books/<book-id>/adversarial-audits.yaml
books/<book-id>/reviews/index.yaml
books/<book-id>/reviews/RV-NNN/lanes/*.yaml
books/<book-id>/reviews/RV-NNN/merged.yaml
```

---

## PR 1.5-1 — Character knowledge-state graph

**Goal:** Prevent characters from knowing, believing, or sharing information before the manuscript gives them a valid path.

**Files:**

- Create: `src/domain/v1-5-schemas.ts`
- Create: `src/domain/v1-5-schema-registry.ts`
- Create: `src/context/knowledge-context.ts`
- Create: `tests/knowledge-state.test.ts`
- Create: `tests/knowledge-graph.test.ts`
- Modify: `src/domain/schemas.ts`
- Modify: `src/project/templates.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/context/story-graph.ts`
- Modify: `src/context/context-builder.ts`
- Modify: `src/application/project-hash.ts`

**Contract:**

Each knowledge record identifies character, fact/thread claim, state (`unknown`, `suspects`, `knows`, `believes-false`), confidence, learned book/chapter, evidence source, share restrictions, and provisional/locked status.

**Rules:**

- Draft events may add or update provisional knowledge only when the submitted chapter contains the cited evidence.
- Canon lock may lock evidenced knowledge records.
- Automatic graph discovery never leaks future-book or later-chapter knowledge backward.
- Explicit dramatic-irony context distinguishes reader knowledge from POV knowledge.
- A provisional record may be explicitly referenced but cannot bridge additional graph context.

**Required tests:**

- [ ] A POV context excludes a fact the character has not learned.
- [ ] `suspects` is represented differently from `knows`.
- [ ] A later-chapter knowledge record is blocked for an earlier chapter.
- [ ] A false belief may enter POV context but is labeled as belief, not canon fact.
- [ ] Sharing a secret updates the recipient only when the chapter evidence supports it.
- [ ] Existing graph depth, ordering, and provisional rules remain passing.

**Verification:**

```bash
node --import tsx --test tests/knowledge-state.test.ts tests/knowledge-graph.test.ts tests/story-graph.test.ts tests/context.test.ts tests/context-integrity.test.ts
```

---

## PR 1.5-2 — Role-isolated writer, auditor, and editor contexts

**Goal:** Prevent the writer from optimizing to evaluator conclusions and prevent the editor from conducting an unrestricted rewrite.

**Files:**

- Create: `src/context/role-context.ts`
- Create: `tests/role-context.test.ts`
- Modify: `src/context/context-builder.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/run.ts`
- Modify: `src/pi/extension.ts`

**Interfaces:**

```ts
export type CreativeRole = "writer" | "auditor" | "editor";

export interface RoleContext {
  role: CreativeRole;
  text: string;
  included: string[];
  excluded: string[];
  estimatedTokens: number;
}

export function buildWriterContext(root: string, chapter?: number): RoleContext;
export function buildAuditorContext(root: string, scope: string): RoleContext;
export function buildEditorContext(root: string, ticketIds: string[]): RoleContext;
```

**Context boundaries:**

- Writer: approved packet, permitted knowledge, relevant canon/threads/research, voice guardrails, prior finalized chapter, and approved strategy. Excludes scores, future review findings, reader response bodies, and unselected variants.
- Auditor: manuscript, approved promises, architecture, evidence, and audit rubric. Cannot write prose.
- Editor: selected tickets, exact evidence locations, strengths to preserve, dependencies, allowed files, and regression checks. Excludes unrelated findings and unlimited manuscript rewrite authority.

**Required tests:**

- [ ] Writer context contains no review score or revision solution.
- [ ] Auditor context contains no tool instruction permitting manuscript writes.
- [ ] Editor context includes only selected tickets and allowed chapters.
- [ ] Raw reader responses remain excluded from all three contexts.
- [ ] Voice experiments and named influences remain excluded from writer context.

---

## PR 1.5-3 — Deterministic postflight checks and drafting modes

**Goal:** Catch objective failures after chapters are written while keeping stylistic judgment out of the drafting moment.

**Files:**

- Create: `src/application/postflight.ts`
- Create: `src/audits/ngram.ts`
- Create: `src/audits/rhetorical-pattern.ts`
- Create: `src/audits/continuity.ts`
- Create: `src/audits/structure.ts`
- Create: `src/audits/spelling.ts`
- Create: `src/audits/temporal.ts`
- Create: `src/audits/mechanics.ts`
- Create: `tests/postflight.test.ts`
- Create: `tests/drafting-mode.test.ts`
- Modify: existing `scripts/*-audit.mjs` wrappers to call or mirror the pure modules without changing CLI behavior
- Modify: `src/domain/v1-5-schemas.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/status.ts`

**Modes:**

- `craft` — schema, reference, duplicate-text, chapter-order, temporal impossibility, and continuity-integrity checks only.
- `guarded` — Craft checks plus advisory rhetoric, dialogue differentiation, opening/ending repetition, and mechanics diagnostics.

**Rules:**

- The default is `craft`.
- Postflight never rewrites prose.
- Deterministic integrity failures block continuation.
- Stylistic or statistical findings create advisory evidence or revision-ticket candidates and do not enforce prose quotas.
- Intentional exceptions can be recorded in book strategy and suppress matching advisories with provenance.

**Required tests:**

- [ ] Duplicate paragraphs block both modes.
- [ ] A temporal impossibility blocks both modes.
- [ ] Repeated rhetorical patterns are advisory, not automatic blockers.
- [ ] Guarded mode runs additional diagnostics without editing the chapter.
- [ ] An approved exception suppresses only its matching advisory.
- [ ] Existing audit CLI commands retain their current output contract.

---

## PR 1.5-4 — Mandatory adversarial manuscript audit

**Goal:** Require diagnosis of structural and trust failures before manuscript approval.

**Files:**

- Extend: `src/domain/v1-5-schemas.ts`
- Create: `src/application/adversarial-audit.ts`
- Create: `tests/adversarial-audit.test.ts`
- Create: `tests/e2e/manuscript-audit-gate.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/gate-metadata.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/integrity.ts`

**Mandatory diagnostic passes:**

1. Chapter existence and unique function.
2. Voice and POV differentiation.
3. Over-explanation after dramatization.
4. Human friction and self-caused failure.
5. Success that arrives too cleanly.
6. Consecutive structural repetition.
7. Opening-to-ending reader-contract repayment.
8. Series debt: resolved, deferred, abandoned, or accidentally forgotten threads.
9. Knowledge-flow and reveal-order integrity.
10. Score or self-approval inflation risk.

**Rules:**

- Diagnosis and repair are separate events.
- Findings require exact chapter/scene evidence.
- The audit produces typed findings and revision tickets, not a marketing readiness claim.
- `manuscript-approval` cannot become pending until a current audit exists and no unresolved audit blocker is hidden.
- The writer may accept a documented risk, but that decision is explicit and remains visible.

**Required tests:**

- [ ] A redundant chapter produces a structural finding with evidence.
- [ ] A diagnostic event cannot write manuscript prose.
- [ ] Manuscript approval is blocked when the audit is missing or stale.
- [ ] Accepted risks remain visible and do not disappear from package readiness.
- [ ] A revised manuscript invalidates the prior audit hash.

---

## PR 1.5-5 — Isolated review lanes and deterministic merge

**Goal:** Run review specialties independently and merge their evidence without anchoring or averaging away disagreements.

**Files:**

- Create: `src/review/lane-runner.ts`
- Create: `src/review/lane-merge.ts`
- Create: `tests/review-lanes.test.ts`
- Create: `tests/review-lane-merge.test.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/run.ts`
- Modify: `src/review/review.ts`

**Interfaces:**

```ts
export interface ReviewLaneResult {
  laneId: string;
  reviewId: string;
  manuscriptHash: string;
  findings: ReviewFinding[];
  limitations: string[];
}

export function mergeReviewLanes(results: ReviewLaneResult[]): MergedReviewResult;
```

**Rules:**

- Lanes do not receive other lane outputs.
- Every lane records manuscript hash and scope.
- Merge order does not change the resulting IDs, severities, or ticket groups.
- Duplicate findings merge only when evidence location and required change materially match.
- Contradictory findings remain separate and are surfaced for writer/editor resolution.
- Concurrency is optional; correctness cannot depend on it.

**Required tests:**

- [ ] Shuffling lane completion order produces byte-stable merged YAML.
- [ ] Duplicate evidence merges once.
- [ ] Conflicting recommendations remain distinct.
- [ ] A stale lane result cannot merge with a newer manuscript hash.
- [ ] Each generated ticket retains source-lane provenance.

---

## PR 1.5-6 — Surgical revision work orders and dependency-aware batching

**Goal:** Replace arbitrary first-three-ticket revision groups with the smallest safe batches that preserve load-bearing strengths.

**Files:**

- Extend: `src/domain/v1-5-schemas.ts`
- Create: `src/review/ticket-compatibility.ts`
- Create: `src/review/revision-batch.ts`
- Create: `tests/revision-ticket-v2.test.ts`
- Create: `tests/revision-batch.test.ts`
- Create: `tests/e2e/surgical-revision.test.ts`
- Modify: `src/domain/schemas.ts`
- Modify: `src/review/review.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/integrity.ts`

**Ticket additions:**

- `change_class`: structural, connective, prose, factual.
- `risk`: high, medium, low, isolated.
- typed evidence locations.
- strengths to preserve.
- minimum effective change.
- allowed files/chapters.
- dependencies and conflicts.
- explicit regression checks.
- originating review/audit lanes.

**Batch rules:**

- Structural precedes connective, prose, and factual changes when they overlap.
- Compatible tickets in one chapter may share one event.
- Cross-chapter setup/payoff changes become an ordered batch.
- Conflicting tickets never enter the same batch.
- A batch has a bounded context and exact file allowlist.
- Regression checks run after every batch before the next batch begins.
- Legacy tickets are adapted in memory without silently fabricating missing strengths or dependencies.

**Required tests:**

- [ ] Twelve tickets produce deterministic minimal safe batches.
- [ ] A Chapter 3 setup change precedes a Chapter 20 payoff change.
- [ ] Conflicting voice requests stop for decision.
- [ ] A prose ticket cannot authorize a whole-book rewrite.
- [ ] Protected strengths appear in editor context and regression checks.
- [ ] Existing 1.4 ticket files remain readable.

---

## PR 1.5-7 — Editorial Intelligence wizard, evaluation, documentation, and release

**Acceptance journeys:**

1. Drafted chapter updates knowledge state; next POV receives only permitted knowledge.
2. Craft mode continues through advisories but stops on objective integrity failure.
3. Guarded mode creates extra diagnostics without rewriting prose.
4. Full manuscript completes adversarial audit before approval.
5. Independent lanes merge deterministically.
6. Twelve tickets become dependency-aware surgical batches.
7. Existing 1.4 projects open without mandatory migration.

**Verification:**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Run under Node 22.19.0 and Node 24. Create `v1.5.0` only after packed-package Pi lifecycle tests pass.

---

# Release 1.6.0 — Adoption & Reuse

## 1.6 architecture

Extend the trusted adoption service rather than exposing binary or arbitrary filesystem writes to the model tool. Adoption first imports and maps source material exactly as today, then applies a selected goal. Reconstruction is a separate proposal and approval workflow with evidence citations. Starter packs contain reusable author preferences and operational defaults but categorically exclude story-specific canon, prose, research claims, and reader results.

## 1.6 file map

### New units

- `src/domain/v1-6-schemas.ts`
- `src/application/adoption/goals.ts`
- `src/application/reconstruction/types.ts`
- `src/application/reconstruction/extract.ts`
- `src/application/reconstruction/validate.ts`
- `src/application/reconstruction/apply.ts`
- `src/application/reconstruction/wizard.ts`
- `src/application/starter-pack/types.ts`
- `src/application/starter-pack/export.ts`
- `src/application/starter-pack/import.ts`
- `src/application/starter-pack/wizard.ts`

---

## PR 1.6-1 — Phase-aware adoption goals

**Goal:** Let authors import an existing manuscript and begin at the workflow phase appropriate to their actual need.

**Files:**

- Create: `src/domain/v1-6-schemas.ts`
- Create: `src/application/adoption/goals.ts`
- Create: `tests/adoption-goals.test.ts`
- Create: `tests/e2e/phase-aware-adoption.test.ts`
- Modify: `src/application/adoption/types.ts`
- Modify: `src/application/adoption/wizard.ts`
- Modify: `src/application/adoption/apply.ts`
- Modify: `src/application/wizard.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/guide.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`

**Goals:**

```text
continue
reconstruct
audit
revise
package
```

**Rules:**

- `continue` imports the manuscript and routes to reconstruction of only the minimum context required for the next chapter.
- `reconstruct` imports and opens the full reconstruction workflow.
- `audit` imports and routes to manuscript review/adversarial audit without inventing prior approvals.
- `revise` imports and requires a review report, editorial letter, or revision-ticket proposal before mutation.
- `package` imports and runs the packaging checklist; missing approval or metadata remains a blocker.
- Goal selection cannot mark voice, plan, manuscript, canon, or package gates approved.
- The source remains read-only and occupied destinations remain protected.

**Required tests:**

- [ ] Every goal produces the documented next stage and open gate state.
- [ ] Package goal does not bypass manuscript approval.
- [ ] Audit goal does not require reconstructing a complete outline first.
- [ ] Continue goal cannot draft until minimum continuity and knowledge evidence is approved.
- [ ] Existing adoption mapping and archive-safety tests remain unchanged and passing.

---

## PR 1.6-2 — Reconstruction contracts and evidence extraction

**Goal:** Propose a project model from an imported manuscript while attaching every claim to manuscript evidence.

**Files:**

- Extend: `src/domain/v1-6-schemas.ts`
- Create: `src/application/reconstruction/types.ts`
- Create: `src/application/reconstruction/extract.ts`
- Create: `src/application/reconstruction/validate.ts`
- Create: `tests/reconstruction-contracts.test.ts`
- Create: `tests/reconstruction-evidence.test.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/project-hash.ts`

**Proposal coverage:**

- voice-profile candidates and neutral guardrails;
- character and relationship candidates;
- canon facts;
- knowledge state;
- story threads and statuses;
- reverse outline and plot-grid candidates;
- setup/payoff links;
- research dependencies;
- book promise and ending contract;
- next-chapter continuation candidates for unfinished work.

**Evidence contract:**

Every candidate includes source path, chapter, stable excerpt hash, location label, confidence, conflicts, and whether it is observation or inference. No candidate may be marked locked, approved, or human-validated.

**Required tests:**

- [ ] Every proposed canon fact has evidence.
- [ ] Conflicting physical descriptions remain two visible candidates.
- [ ] An inferred motive is labeled inference rather than fact.
- [ ] No future plot solution is invented for an open thread.
- [ ] Reconstruction never mutates project state during preview.

---

## PR 1.6-3 — Guarded reconstruction review and apply

**Goal:** Let the author review, edit, exclude, and approve reconstruction candidates before one atomic project update.

**Files:**

- Create: `src/application/reconstruction/apply.ts`
- Create: `src/application/reconstruction/wizard.ts`
- Create: `tests/reconstruction-apply.test.ts`
- Create: `tests/e2e/reconstruction-wizard.test.ts`
- Modify: `src/application/wizard.ts`
- Modify: `src/application/wizard-launch.ts`
- Modify: `src/wizard/types.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`

**Rules:**

- Add `reconstruction` to `WizardWorkflow`.
- The browser presents candidates and conflicts but never writes files directly.
- Apply uses expected stage/hash and a typed allowlist.
- Approved candidates may populate voice, canon, knowledge, threads, reverse outline, plot grid, queue, book bible, and decision ledger.
- Unapproved candidates remain in the reconstruction report and do not enter drafting context.
- Continue goal may create only the minimum ready packet supported by approved evidence.
- One atomic transaction updates project artifacts, reports, status, handoff, and Git checkpoint.

**Required tests:**

- [ ] Selective approval writes only selected candidates.
- [ ] Edited candidates retain original evidence provenance and writer-decision provenance.
- [ ] A stale proposal fails.
- [ ] A partially reconstructed project cannot silently claim full planning approval.
- [ ] The next drafted chapter uses reconstructed canon/knowledge but excludes rejected candidates.

---

## PR 1.6-4 — Reusable author starter packs

**Goal:** Reuse safe author preferences and operational defaults without leaking story-specific material between projects.

**Files:**

- Extend: `src/domain/v1-6-schemas.ts`
- Create: `src/application/starter-pack/types.ts`
- Create: `src/application/starter-pack/export.ts`
- Create: `src/application/starter-pack/import.ts`
- Create: `src/application/starter-pack/wizard.ts`
- Create: `tests/starter-pack.test.ts`
- Create: `tests/e2e/starter-pack-wizard.test.ts`
- Modify: `src/application/wizard.ts`
- Modify: `src/application/wizard-launch.ts`
- Modify: `src/wizard/types.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/project/templates.ts`

**Allowed starter-pack content:**

- taste preferences and neutral approved voice guardrails;
- writer-owned baseline reference when explicitly included;
- content boundaries;
- default project type/profile/target length;
- preferred POV patterns;
- drafting mode and automation limits;
- reader-segment defaults;
- publishing/imprint defaults;
- marketing-tone preferences.

**Forbidden content:**

- manuscript prose except an explicitly exported writer-owned baseline;
- characters, relationships, canon, knowledge, world rules, plot, threads, or premise variants;
- project research claims or source registers;
- human reader responses, metrics, or verdicts;
- approval records and evidence hashes;
- generated marketing claims tied to another manuscript.

**Rules:**

- Import creates selectable candidates, not approvals.
- The writer confirms each category or applies an explicit safe preset.
- Imported defaults are recorded in the decision ledger with pack hash and source.
- Packs are local files and require no account, telemetry, or remote registry.

**Required tests:**

- [ ] Forbidden fields are rejected even when nested.
- [ ] Importing a pack cannot approve voice or book plans.
- [ ] A selected target length becomes a confirmed decision with provenance.
- [ ] Canon and reader evidence never appear in exported bytes.
- [ ] Importing the same pack twice is idempotent unless the writer changes selections.

---

## PR 1.6-5 — Adoption & Reuse wizard, evaluation, documentation, and release

**Acceptance journeys:**

1. Finished DOCX → audit goal → adversarial audit without forced restart.
2. Approved manuscript → package goal → checklist without invented approvals.
3. Partial twenty-chapter manuscript → reconstruction preview → selective approval → next ready packet.
4. Conflicting manuscript details remain visible and block unsafe context.
5. New project imports an author starter pack and still requires current-project approvals.
6. Existing 1.5 projects open without mutation.

**Verification:**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Run under Node 22.19.0 and Node 24. Create `v1.6.0` only after DOCX, EPUB, Markdown, text, and chapter-directory adoption regression suites and packed-package Pi lifecycle tests pass.

---

# Cross-Release Compatibility Strategy

## Version detection

- `novel_forge_version` remains the installed package version marker.
- Project schema literals remain stable where possible; new optional fields and separately registered files carry release-specific contracts.
- Projects written by a newer package remain blocked safely.
- Projects missing optional newer artifacts remain readable and receive one release-level advisory, not one warning per file.

## Approval preservation

- Existing approvals remain valid unless the author intentionally rebuilds the evidence bundle covered by that gate.
- Adding intake or premise evidence does not invalidate an approved 1.3 voice or plan automatically.
- Rebuilding a 1.4+ book plan includes the selected premise and confirmed decision evidence in its approval hash.
- Manuscript edits invalidate manuscript-dependent audit and package hashes, not unrelated voice or series approvals.

## Migration policy

- Metadata upgrade records package version only.
- Optional backfill opens the matching guided workflow and creates real evidence.
- No migration generates assumptions, premise variants, knowledge records, audit findings, or reconstruction candidates without inspecting actual authorized evidence.
- Legacy revision tickets are adapted in memory and rewritten only through an explicit revision or upgrade workflow.

---

# Program-Level Acceptance Criteria

The entire program is complete only when all of the following journeys pass from clean packed installs:

1. **One-sentence author:** idea → visible assumptions → premise comparison → writer selection → approved plan → resumable drafting to milestone.
2. **Prepared author:** detailed brief and sample → minimal questions → approved plan without redundant intake.
3. **Long drafting run:** six ready packets → safe refill → ten chapters → interruption → exact resume without duplication.
4. **Continuity-sensitive series:** character knowledge and secrets remain correct across chapters and inherited books.
5. **Craft-first drafting:** prose is drafted without evaluator score pressure; objective failures still stop safely.
6. **Adversarial editorial pass:** diagnosis precedes score or approval; findings become evidence-backed surgical work orders.
7. **Large revision set:** dependencies and conflicts produce deterministic safe batches with regression protection.
8. **Existing manuscript continuation:** imported partial manuscript → provenance-backed reconstruction → approved next packet.
9. **Existing manuscript audit/package:** author begins at the matching phase without fabricated prior approvals.
10. **Prolific author reuse:** safe preferences transfer through a starter pack while canon, prose, research, and reader evidence remain isolated.

Quantitative journey targets after 1.6:

- Complete brief to book-plan gate: no more than two model prompts per creative stage and zero questions when all required decisions are explicit.
- One-sentence idea to first writer decision: one command and no hidden assumptions.
- Ten-chapter bounded run: no duplicate events, at most two packet refills, at most one retry per retryable event payload, and an exact stop reason.
- Revision planner: no arbitrary ticket-count grouping; every batch has dependencies, allowed files, preserved strengths, and regression checks.
- All readiness or validation claims distinguish internal diagnostics from human reader evidence.

---

# Implementation Operating Procedure

For every PR in this roadmap:

1. Create a dedicated branch from the latest verified `main`.
2. Write `docs/superpowers/plans/YYYY-MM-DD-<phase-name>.md` with exact tests, interfaces, code changes, expected failures, commands, and commit boundaries.
3. Add failing behavioral tests first and confirm the expected failure.
4. Implement the smallest coherent domain/application unit.
5. Run focused tests after every task.
6. Run typecheck and the full regression suite before declaring the PR ready.
7. Update README, SKILL, changelog, release checklist, and evaluation fixtures only where the PR changes public behavior.
8. Keep the PR draft until its documented verification is complete.
9. Perform a static safety review for allowlists, stale writes, absolute-path disclosure, browser boundaries, project-hash coverage, compatibility, and evidence separation.
10. Merge only after review and verification; begin the next dependent PR from the resulting `main` commit.

## Required detailed-plan template per PR

Every PR implementation plan must name:

- exact files created and modified;
- exported types and function signatures;
- failing tests and expected failure messages;
- minimum implementation steps;
- compatibility behavior for older projects;
- event and wizard allowlists;
- context inclusion and exclusion rules;
- focused verification commands;
- full verification commands;
- commit boundaries;
- release-document changes;
- explicit out-of-scope items.

---

# Recommended Immediate Next Action

1. Complete manual verification and merge PR #10.
2. Execute the existing 1.3 Phase 3 plan.
3. Continue through the current 1.3 roadmap and release `v1.3.0`.
4. Before 1.4 implementation, write the detailed TDD plan for **PR 1.4-1 — Author-journey throughput baselines**.
5. Do not begin automation behavior changes until the baseline measurements are merged.

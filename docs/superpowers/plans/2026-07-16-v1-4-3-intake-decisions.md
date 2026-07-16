# Novel Forge 1.4-3 Typed Intake and Decision Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Novel Forge infer missing setup details without silently converting guesses into facts.

**Architecture:** Add two optional, typed series-level artifacts: `series/intake.yaml` for the raw idea, authorized inputs, inferred setup values, and unresolved blockers; and `series/decision-ledger.yaml` for immutable assumptions and explicit writer decisions. Add a state-neutral `intake-update` event that can write only those files during voice intake, series planning, or book planning. Prompt compilation may use explicit writer decisions but must label inferred assumptions as unresolved and never promote them automatically.

**Tech Stack:** TypeScript 5.9, TypeBox, YAML, existing Novel Forge transaction/event/hash/status/handoff/prompt infrastructure, Node test runner, Node 22.19.0 and Node 24 GitHub Actions matrix.

## Global Constraints

- Keep package version and dependency metadata unchanged in this PR.
- New projects receive valid default intake and decision files.
- Existing 1.3 projects without either file remain readable and unblocked.
- Missing intake artifacts produce exactly one optional-backfill warning covering both paths.
- Metadata-only upgrades never create assumptions, decisions, blockers, authorized-file references, or author text.
- Assumption records are append-only. Existing records are never deleted or rewritten by service functions.
- Writer decisions are append-only and immutable. Correcting a decision appends a replacement decision linked by `replaces`.
- An inferred assumption remains visibly `inferred` until a writer action confirms, corrects, rejects, or supersedes it.
- Confirming an assumption appends a decision with the same value and changes only that assumption's status to `confirmed`.
- Correcting an assumption appends a decision with the corrected value and changes only that assumption's status to `corrected`; the original inferred value remains preserved in the assumption record.
- Rejected and superseded assumptions never become prompt facts.
- Only writer decisions, not inferred assumptions, may be compiled as settled voice/book-plan input.
- `intake-update` is state-neutral and may write only `series/intake.yaml` and `series/decision-ledger.yaml`.
- `intake-update` cannot alter project/book state, gates, approvals, manuscript, reader evidence, publishing, marketing, package output, or derived guidance directly.
- Every accepted update uses the existing stale stage/hash checks, typed validation, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.
- Use TDD and pass the full Node 22.19.0 / Node 24 matrix before merge.

---

### Task 1: Add typed 1.4 intake and decision schemas

**Files:**
- Create: `src/domain/v1-4-schemas.ts`
- Create: `src/domain/v1-4-schema-registry.ts`
- Modify: `src/infrastructure/transaction.ts`
- Create: `tests/v1-4-schemas.test.ts`

**Canonical contracts:**

```ts
export type AssumptionStatus = "inferred" | "confirmed" | "corrected" | "rejected" | "superseded";

export interface AssumptionRecord {
  id: string; // ASM-NNN
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
  id: string; // DEC-NNN
  scope: "project" | `book-${string}`;
  subject: string;
  choice: string;
  decidedAt: string;
  evidenceRefs: string[];
  replaces: string | null;
}
```

`series/intake.yaml`:

```yaml
schema_version: 1.0.0
original_idea: ""
authorized_briefs: []
authorized_samples: []
inferred:
  language: { value: null, assumption_id: null }
  profile: { value: null, assumption_id: null }
  audience: { value: null, assumption_id: null }
  target_words: { value: null, assumption_id: null }
unresolved_blockers: []
```

Authorized references contain `id`, normalized project-relative or session-authorized `path`, and `label`. An inferred slot must have both value and assumption ID or both null. `target_words.value`, when present, is an integer of at least 1,000.

`series/decision-ledger.yaml`:

```yaml
schema_version: 1.0.0
assumptions: []
decisions: []
```

- [ ] **Step 1: Write failing schema tests**

Prove defaults validate; duplicate IDs, invalid statuses, malformed scope, invalid ID prefixes, blank subjects/values, self-supersession, unknown `supersedes`/`replaces`, duplicate active assumptions for the same scope/subject, half-populated inferred slots, and target length below 1,000 are rejected by canonical validation helpers.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/v1-4-schemas.test.ts
```

Expected: FAIL because the 1.4 schema modules do not exist.

- [ ] **Step 3: Implement TypeBox schemas, defaults, and cross-record findings**

Export schemas, static types, `defaultIntake()`, `defaultDecisionLedger()`, and `decisionLedgerFindings(ledger)`. Cross-record findings must validate uniqueness, links to earlier records, replacement subject/scope consistency, and no more than one nonterminal assumption per scope/subject.

- [ ] **Step 4: Register the two paths before v1.3/base schemas**

Add `v14SchemaForPath` and use it first in transaction YAML validation.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
node --import tsx --test tests/v1-4-schemas.test.ts
npm run typecheck
```

Expected: PASS.

---

### Task 2: Add immutable assumption and writer-decision services

**Files:**
- Create: `src/application/intake.ts`
- Create: `tests/intake-decisions.test.ts`

**Interfaces:**

```ts
export interface InferAssumptionInput {
  scope: "project" | `book-${string}`;
  subject: string;
  value: string;
  source: AssumptionRecord["source"];
  confidence: AssumptionRecord["confidence"];
  affects: string[];
}

export interface DecideAssumptionInput {
  assumptionId: string;
  choice: string;
  decidedAt: string;
  evidenceRefs: string[];
}

export function inferAssumption(ledger: DecisionLedger, input: InferAssumptionInput): DecisionLedger;
export function decideAssumption(ledger: DecisionLedger, input: DecideAssumptionInput): DecisionLedger;
export function replaceWriterDecision(ledger: DecisionLedger, decisionId: string, choice: string, decidedAt: string, evidenceRefs: string[]): DecisionLedger;
export function resolvedDecision(ledger: DecisionLedger, scope: string, subject: string): WriterDecisionRecord | null;
export function intakePromptContext(intake: IntakeState | null, ledger: DecisionLedger | null): string;
```

- [ ] **Step 1: Write failing service tests**

Prove:

- inferring genre appends `ASM-001` with status `inferred` and does not create a decision;
- confirming it appends `DEC-001`, keeps assumption value unchanged, and marks status `confirmed`;
- correcting target length keeps the original assumed value, appends a decision with the corrected choice, and marks status `corrected`;
- rejecting an assumption records an explicit decision choice `rejected` or a dedicated rejection decision and keeps history;
- replacing a writer decision appends a new decision linked with `replaces`; old decision remains byte-for-byte unchanged;
- a second unresolved assumption for one scope/subject is rejected unless it explicitly supersedes the first through a service operation;
- caller-owned input objects and original ledgers are not mutated;
- `resolvedDecision` returns the latest unreplaced decision only;
- prompt context has separate `Confirmed writer decisions` and `Unresolved inferred assumptions` sections, and explicitly says inferred values are not facts.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/intake-decisions.test.ts
```

Expected: FAIL because the intake service does not exist.

- [ ] **Step 3: Implement deterministic ID allocation and immutable operations**

Use the maximum numeric suffix plus one. Validate every result with `decisionLedgerFindings`; reject decisions on terminal assumptions; require nonblank evidence refs for corrections/replacements; never use current time internally.

- [ ] **Step 4: Run service tests**

```bash
node --import tsx --test tests/intake-decisions.test.ts tests/v1-4-schemas.test.ts
```

Expected: PASS.

---

### Task 3: Seed new projects and preserve 1.3 compatibility

**Files:**
- Modify: `src/project/templates.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/handoff.ts`
- Create: `tests/v1-4-compatibility.test.ts`
- Test: `tests/project-store.test.ts`

- [ ] **Step 1: Write failing compatibility tests**

Prove:

- new projects contain valid `series/intake.yaml` and `series/decision-ledger.yaml`;
- defaults contain no invented idea, authorized file, assumption, decision, or blocker;
- deleting both from a project leaves status unblocked and creates exactly one optional Novel Forge 1.4 intake warning mentioning both paths;
- deleting one file still creates only that same consolidated warning;
- upgrading metadata does not recreate either file or hide the warning;
- status/handoff do not print inferred values as confirmed decisions.

- [ ] **Step 2: Add template files and one consolidated advisory**

Do not make these files required in the base control-file list. Keep existing approvals and manuscript state valid.

- [ ] **Step 3: Run compatibility tests**

```bash
node --import tsx --test tests/v1-4-compatibility.test.ts tests/project-store.test.ts
```

Expected: PASS.

---

### Task 4: Add the state-neutral intake-update event and guarded hashing

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/project-hash.ts`
- Create: `tests/intake-event.test.ts`
- Test: `tests/research-event.test.ts`
- Test: `tests/e2e/structured-rejection.test.ts`

- [ ] **Step 1: Write failing event tests**

Prove:

- `intake-update` is accepted during voice intake, series planning, and book planning;
- it accepts either or both canonical intake files, rejects an empty submission, and rejects every other path;
- malformed files use the structured `schema-validation` envelope;
- stage, gates, approvals, active book, book state, and manuscript bytes remain unchanged;
- the project hash changes after accepted intake evidence and stale proposals fail;
- decision-ledger cross-record blockers reject before mutation;
- the Git checkpoint message is `Novel Forge: intake-update`;
- `STATUS.md` and `HANDOFF.md` regenerate through the normal transaction path.

- [ ] **Step 2: Implement event allowlist and validation**

Add `intake-update` to `NovelEventType`, event stages, exact paths, empty-submission rule, and state-neutral switch. When the decision ledger changes, parse it and reject cross-record findings. Do not require both files in each event.

- [ ] **Step 3: Include both paths in guarded project hash**

Missing files contribute `<missing>` so legacy projects remain hashable.

- [ ] **Step 4: Run event/regression tests**

```bash
node --import tsx --test tests/intake-event.test.ts tests/research-event.test.ts tests/e2e/structured-rejection.test.ts
```

Expected: PASS.

---

### Task 5: Compile explicit decisions into voice/book planning without promoting inference

**Files:**
- Modify: `src/application/prompts.ts`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Test: `tests/prompts.test.ts`
- Test: `tests/intake-decisions.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Prove:

- voice and book-plan prompts include confirmed/corrected writer decisions;
- inferred assumptions appear only under an unresolved heading plus “not confirmed facts” language;
- rejected/superseded assumptions do not enter settled decisions;
- when files are absent, prompts remain valid and contain no fabricated context;
- prompts instruct agents to use `intake-update` for intake evidence and never silently rewrite assumption history.

- [ ] **Step 2: Add shared intake context compilation**

Load files only when present. Use `intakePromptContext` from the application service. Inject one shared block into voice and book-plan prompts; do not duplicate logic.

- [ ] **Step 3: Document the provenance model**

Document assumption statuses, immutable decisions, optional compatibility, event allowlist, and the rule that inference never becomes fact without a writer decision.

- [ ] **Step 4: Run full verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass.

- [ ] **Step 5: Inspect and merge exact tested head**

Confirm final diff contains only schemas, registry, service, template/status/hash/event/prompt integration, tests, plan, and documentation. Resolve review threads, record exact Actions run/head, mark ready, and merge with SHA protection.

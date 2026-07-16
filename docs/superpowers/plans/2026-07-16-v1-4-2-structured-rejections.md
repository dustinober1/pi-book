# Novel Forge 1.4-2 Structured Event Rejections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace opaque Novel Forge mutation failures with one machine-readable rejection envelope while preserving current human-readable messages and safety behavior.

**Architecture:** Add a pure rejection module that classifies known validation failures, sanitizes unknown errors, and applies an exact one-retry policy. Wrap the existing `applyNovelEvent` and wizard apply boundaries so validators may retain their current messages while callers receive consistent codes, paths, issues, reload guidance, and current state. The Pi tool returns concise text plus the same structured detail; prompts explain the bounded response policy without creating automatic retries.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, existing typed event/wizard boundaries, TypeBox Pi tool contract, Node test runner, GitHub Actions matrix.

## Global Constraints

- Preserve every existing validation message unless sanitization removes an absolute path or stack detail.
- Never expose stack traces, absolute project paths, tokens, filesystem internals, or raw unknown thrown objects.
- Schema and reference failures may be resubmitted once after correcting only the rejected payload.
- Stale stage/hash failures require state reload and are never retryable in the same attempt.
- Human gates, allowlist violations, integrity failures, filesystem failures, wrong-stage failures, and unknown failures are never automatically retryable.
- `retryable` describes policy eligibility; `canRetryEvent(detail, previousRetries)` enforces the maximum of one retry.
- Existing event validators remain authoritative. Do not duplicate schema/reference validation logic in the rejection module.
- Current stage and project hash in rejection details come from canonical project state whenever it can be read safely.
- The public Pi tool returns both concise text and `EventRejectionDetail`.
- Wizard stale proposals use the same rejection class and envelope as normal events.
- Existing tests that assert error messages continue to pass.
- No project mutation, stage change, schema migration, dependency, telemetry, remote service, or release version change in this PR.
- Use TDD and verify the full Node 22.19.0 / Node 24 matrix before merge.

---

### Task 1: Add the rejection contract, classifier, sanitizer, and retry policy

**Files:**
- Create: `src/application/event-rejection.ts`
- Create: `tests/event-rejection.test.ts`

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

export interface EventRejectionIssue {
  path: string;
  expected: string;
  received: string;
}

export interface EventRejectionDetail {
  code: EventRejectionCode;
  message: string;
  retryable: boolean;
  requiresReload: boolean;
  invalidPaths: string[];
  issues: EventRejectionIssue[];
  currentStage: string;
  currentProjectHash: string;
}

export interface EventRejectionContext {
  root?: string;
  currentStage: string;
  currentProjectHash: string;
  invalidPaths?: string[];
}

export class NovelEventRejection extends Error {
  readonly detail: EventRejectionDetail;
}

export function normalizeEventRejection(error: unknown, context: EventRejectionContext): NovelEventRejection;
export function canRetryEvent(detail: EventRejectionDetail, previousRetries: number): boolean;
export function rejectionInstruction(detail: EventRejectionDetail, previousRetries?: number): string;
```

- [ ] **Step 1: Write failing unit tests**

Prove classification and policy for:

- `books/book-01/book-strategy.yaml is not valid YAML: ...` → `schema-validation`, exact invalid path, retryable, no reload;
- `Reference validation blocked chapter-queue: ...` → `reference-validation`, retryable;
- `Stale event stage: expected drafting, current revision.` → `stale-stage`, non-retryable, reload;
- `Stale project hash; reload state before applying this event.` → `stale-project-hash`, non-retryable, reload;
- `books/book-01/manuscript/chapters/01.md is not allowed for research-update.` → `allowlist-violation`, exact path, non-retryable;
- gate/approval messages → `human-gate-required`;
- integrity messages → `integrity-failure`;
- errors with `ENOENT`, `EACCES`, `EPERM`, or `ENOSPC` → `filesystem-failure`;
- unknown strings/objects → `unknown` with no stack, absolute path, or raw object dump.

Also prove:

```ts
assert.equal(canRetryEvent(schema.detail, 0), true);
assert.equal(canRetryEvent(schema.detail, 1), false);
assert.equal(canRetryEvent(stale.detail, 0), false);
```

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/event-rejection.test.ts
```

Expected: FAIL because the rejection module does not exist.

- [ ] **Step 3: Implement deterministic message classification**

Classification precedence:

1. existing `NovelEventRejection` returns unchanged;
2. stale project hash;
3. stale stage;
4. wrong current stage;
5. disallowed/duplicate path;
6. invalid YAML or schema assertion;
7. reference validation;
8. human-gate/approval requirement;
9. integrity failure;
10. filesystem code/message;
11. unknown.

Path extraction must recognize normalized relative paths before `is not valid YAML`, `is not allowed`, `Duplicate event path`, and explicit context paths. Deduplicate and sort paths.

- [ ] **Step 4: Implement sanitization and issues**

- use only `Error.message` or a safe generic sentence;
- replace `context.root` and normalized variants with `<project-root>`;
- redact remaining Unix/Windows absolute path patterns;
- collapse whitespace without deleting validator wording;
- never include `error.stack`;
- create one issue per invalid path with code-specific expected/received summaries;
- if no path is available, preserve an empty issues list.

- [ ] **Step 5: Implement bounded policy instructions**

- schema/reference: “Correct only the rejected payload and resubmit once.” when `previousRetries === 0`;
- schema/reference after one retry: stop and surface the blocker;
- stale stage/hash: reload canonical state and rebuild the proposal;
- all others: stop automatic work and surface the rejection.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
node --import tsx --test tests/event-rejection.test.ts
npm run typecheck
```

Expected: PASS.

---

### Task 2: Wrap the guarded event boundary

**Files:**
- Modify: `src/application/events.ts`
- Create: `tests/e2e/structured-rejection.test.ts`
- Test: `tests/research-event.test.ts`

- [ ] **Step 1: Write failing event-boundary tests**

Create a clean project and prove:

- malformed `books/book-01/book-strategy.yaml` submitted through `research-update` throws `NovelEventRejection` with `schema-validation`, exact path, canonical stage/hash, and `retryable: true`;
- a ready packet with a missing canon/research reference throws `reference-validation`;
- stale project hash returns `stale-project-hash`, `requiresReload: true`, `retryable: false`;
- an attempted manuscript write through `research-update` returns `allowlist-violation`, exact path, no retry;
- the rejection occurs before mutation: project hash, stage, gates, and manuscript bytes remain unchanged;
- existing message regex assertions remain valid through `rejection.message`.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/e2e/structured-rejection.test.ts tests/research-event.test.ts
```

Expected: FAIL because `applyNovelEvent` still throws ordinary errors.

- [ ] **Step 3: Wrap `applyNovelEvent`**

Split the current body into a private implementation or surround it with one exported boundary. On failure:

1. retain a safely read canonical project stage/hash when available;
2. pass submitted file paths as context only for path-capable validation errors;
3. call `normalizeEventRejection`;
4. throw the returned `NovelEventRejection`.

Do not alter successful return values, transaction order, rollback, checkpoint messages, or validation sequencing.

- [ ] **Step 4: Run event and regression tests**

```bash
node --import tsx --test tests/e2e/structured-rejection.test.ts tests/research-event.test.ts tests/transaction-rollback.test.ts
```

Expected: PASS.

---

### Task 3: Use one envelope for wizard and Pi tool failures

**Files:**
- Modify: `src/application/wizard.ts`
- Modify: `src/wizard/session.ts`
- Modify: `src/pi/extension.ts`
- Test: `tests/wizard-runtime.test.ts`
- Test: `tests/pi-runtime.test.ts`
- Test: `tests/e2e/structured-rejection.test.ts`

- [ ] **Step 1: Write failing wizard and tool tests**

Prove:

- a stale wizard stage/hash throws `NovelEventRejection` with the same code/reload policy as a normal event;
- `/api/apply` returns `{ error, rejection }` for structured failures without exposing project root;
- `novel_apply_event` returns concise text plus `details.rejection` containing the complete detail object;
- successful tool results remain unchanged;
- unknown thrown values normalize to `unknown`, expose no stack, and contain no absolute path.

- [ ] **Step 2: Implement wizard boundary normalization**

Use canonical project stage/hash before handler dispatch. Convert stale checks and handler errors through `normalizeEventRejection`. The HTTP session error response adds `rejection` only when the error is a `NovelEventRejection`.

- [ ] **Step 3: Implement Pi tool envelope**

The rejected result must be:

```ts
{
  content: [{ type: "text", text: `Novel Forge event rejected: ${detail.message}\n${rejectionInstruction(detail)}` }],
  details: { error: detail.message, rejection: detail },
}
```

Do not include stack traces or absolute paths.

- [ ] **Step 4: Run boundary tests**

```bash
node --import tsx --test tests/e2e/structured-rejection.test.ts tests/wizard-runtime.test.ts tests/pi-runtime.test.ts
```

Expected: PASS.

---

### Task 4: Document and prompt the bounded retry policy

**Files:**
- Modify: `src/application/run.ts`
- Modify: `src/application/prompts.ts`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Test: `tests/prompts.test.ts`
- Test: `tests/run.test.ts`

**Interfaces:**

```ts
export function rejectionRunDecision(detail: EventRejectionDetail, previousRetries?: number): RunDecision;
```

- [ ] **Step 1: Write failing policy tests**

Prove:

- schema/reference on retry zero returns a repair/resubmit decision containing “once”;
- schema/reference after retry one returns blocked/no prompt;
- stale stage/hash returns reload-state guidance;
- allowlist, human-gate, integrity, filesystem, and unknown return blocked/no automatic retry;
- generated event prompts tell agents to use the structured rejection code, correct only schema/reference payloads once, reload on stale state, and stop on all other codes.

- [ ] **Step 2: Implement run decision helper**

This helper does not execute retries. It translates `EventRejectionDetail` into author/model guidance while enforcing `canRetryEvent`.

- [ ] **Step 3: Update event prompt contract**

Append a compact structured-rejection policy to `eventRule` so every model-facing workflow receives the same rule. Do not duplicate the policy in every prompt.

- [ ] **Step 4: Update documentation**

Document code meanings, retry eligibility, reload requirements, and the guarantee that unknown failures are sanitized. State explicitly that retry eligibility is not automatic execution.

- [ ] **Step 5: Run full verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass.

- [ ] **Step 6: Inspect and merge exact tested head**

Confirm the final diff contains only the plan, rejection module, event/wizard/tool/run/prompt integration, tests, and documentation. Resolve review threads, record the exact Actions run and head SHA, mark ready, and merge with SHA protection.

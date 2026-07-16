# Novel Forge 1.4-1 Author-Journey Throughput Baselines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish deterministic author-journey throughput measurements before Novel Forge 1.4 changes intake or automation behavior.

**Architecture:** Add one pure evaluation module that reduces an ordered journey trace into stable counts and a final stop reason. Four YAML fixtures record current behavior and limitations without asserting future 1.4 targets already pass. Extend the existing evaluation runner with an independent author-journey section while preserving all architecture and 1.3 release fixtures unchanged.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, YAML, Node test runner, existing `npm run eval` script and GitHub Actions matrix.

## Global Constraints

- Start only after verified tag `v1.3.0` exists.
- Do not change production workflow behavior in this PR.
- Do not add a creative stage, schema migration, runtime dependency, browser route, telemetry, or wall-clock timing.
- Measurements are deterministic counts and state transitions only.
- Duplicate accepted draft events for one chapter count as one completed chapter.
- A pause and resume with the same run ID remains one logical journey and does not reset counters.
- Rejected guarded attempts count in `guardedEvents` and `rejectedEvents`; a later attempt with `retry_of` counts in `retries`.
- `contextCharacters` is the maximum observed bounded-context character count, not a sum and not a token estimate.
- `stopReason` is the last explicit stop event, or `"unknown"` when none exists.
- Fixtures must preserve current limitations as text and must not claim future Author Velocity targets already pass.
- Existing architecture fixtures and Novel Forge 1.3 release fixtures remain byte-for-byte unchanged.
- Use TDD and run the full Node 22.19.0 / Node 24 verification matrix before merge.

---

### Task 1: Define journey trace and metric contracts

**Files:**
- Create: `src/evaluation/author-journey.ts`
- Create: `tests/author-journey.test.ts`

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

export type AuthorJourneyEvent =
  | { type: "author-question"; id: string }
  | { type: "model-prompt"; id: string }
  | { type: "guarded-event"; id: string; action: string; outcome: "accepted" | "rejected"; chapter?: number; retry_of?: string }
  | { type: "writer-approval"; gate: string }
  | { type: "context"; characters: number }
  | { type: "run-state"; run_id: string; state: "started" | "paused" | "resumed" | "completed" }
  | { type: "stop"; reason: string };

export interface AuthorJourneyTrace {
  events: AuthorJourneyEvent[];
}

export interface AuthorJourneyFixture {
  schema_version: "1.0.0";
  id: string;
  description: string;
  limitations: string[];
  trace: AuthorJourneyTrace;
  expected: AuthorJourneyMetrics;
  limits: {
    max_author_questions: number;
    max_model_prompts: number;
    max_rejected_events: number;
    max_retries: number;
  };
}

export interface AuthorJourneyEvaluation {
  id: string;
  metrics: AuthorJourneyMetrics;
  passed: boolean;
  failures: string[];
  limitations: string[];
}

export function evaluateAuthorJourney(fixture: AuthorJourneyFixture, trace: AuthorJourneyTrace): AuthorJourneyMetrics;
export function evaluateAuthorJourneyFixture(fixture: AuthorJourneyFixture): AuthorJourneyEvaluation;
export function loadAuthorJourneyFixtures(root: string): AuthorJourneyFixture[];
```

- [ ] **Step 1: Write the failing metric tests**

Create tests proving:

```ts
const fixture = minimalFixture();
const metrics = evaluateAuthorJourney(fixture, {
  events: [
    { type: "author-question", id: "Q1" },
    { type: "author-question", id: "Q2" },
    { type: "author-question", id: "Q3" },
    { type: "author-question", id: "Q4" },
  ],
});
assert.equal(metrics.authorQuestions, 4);
```

Also prove:

- two accepted `draft-chapter` events for chapter 4 produce `chaptersCompleted: 1`;
- pause and resume events with one `run_id` do not reset question, prompt, event, chapter, or context counts;
- a final `{ type: "stop", reason: "human-gate" }` produces `stopReason: "human-gate"`;
- a rejected guarded event increments `guardedEvents` and `rejectedEvents`;
- a corrected event with `retry_of` increments `guardedEvents` and `retries`;
- context observations `8000`, `12000`, and `9000` produce `contextCharacters: 12000`;
- negative context sizes, blank IDs, missing chapters for accepted `draft-chapter`, retry references to unknown event IDs, and duplicate event IDs fail loudly.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/author-journey.test.ts
```

Expected: FAIL because `src/evaluation/author-journey.ts` does not exist.

- [ ] **Step 3: Implement strict deterministic trace reduction**

Implementation rules:

- validate every event before counting;
- maintain a set of event IDs for guarded attempts and validate `retry_of` against an earlier guarded event;
- count every guarded attempt once, regardless of outcome;
- count rejected outcomes separately;
- count retries only when `retry_of` is present;
- maintain a set of accepted draft chapter numbers specifically where `action === "draft-chapter"` and `outcome === "accepted"`;
- count every `writer-approval` event to populate `writerApprovals`;
- track maximum context characters;
- overwrite `stopReason` for each explicit stop so the last stop wins;
- ignore run-state events for counts while validating each run ID and state transition is nonblank;
- never mutate the fixture or trace.

- [ ] **Step 4: Implement fixture evaluation**

`evaluateAuthorJourneyFixture` must:

1. call `evaluateAuthorJourney(fixture, fixture.trace)`;
2. compare every metric exactly against `fixture.expected`;
3. verify questions, prompts, rejected events, and retries do not exceed fixture limits;
4. require at least one nonblank limitation string;
5. return all failures without throwing for ordinary expectation or limit mismatches;
6. preserve limitations in the result.

- [ ] **Step 5: Run focused tests**

```bash
node --import tsx --test tests/author-journey.test.ts
npm run typecheck
```

Expected: PASS.

---

### Task 2: Record four honest current-state journeys

**Files:**
- Create: `evals/journeys/brief-to-book-plan.yaml`
- Create: `evals/journeys/six-packets-to-ten-chapters.yaml`
- Create: `evals/journeys/resume-after-four-chapters.yaml`
- Create: `evals/journeys/twelve-revision-tickets.yaml`
- Create: `tests/e2e/author-velocity-baseline.test.ts`

- [ ] **Step 1: Write four complete fixtures**

Each fixture must include a full trace, exact expected metrics, explicit maximum limits, and at least one current limitation.

Required scenarios:

1. **brief-to-book-plan**
   - exactly four author questions;
   - one rejected book-plan event followed by one permitted retry;
   - final stop reason `human-gate`;
   - zero completed chapters.
2. **six-packets-to-ten-chapters**
   - ten unique accepted draft chapters;
   - include one duplicate accepted event for chapter 6 to prove deduplication;
   - include a second packet-preparation prompt after chapter 6;
   - final stop reason `milestone`.
3. **resume-after-four-chapters**
   - four chapters, pause, resume with the same run ID, then six more chapters;
   - final `chaptersCompleted: 10` without counter reset;
   - final stop reason `requested-target`.
4. **twelve-revision-tickets**
   - twelve accepted guarded revision attempts;
   - no chapter completion credit;
   - one writer approval before revision;
   - final stop reason `human-gate`.

- [ ] **Step 2: Write failing fixture tests**

Load `evals/journeys`, evaluate every fixture, and assert:

```ts
assert.equal(fixtures.length, 4);
assert.deepEqual(results.filter((result) => !result.passed), []);
assert.ok(results.every((result) => result.limitations.length > 0));
```

Add direct assertions for the exact roadmap behaviors: four questions, chapter deduplication, resume continuity, human-gate stopping, rejection counting, and retry counting.

- [ ] **Step 3: Verify RED**

```bash
node --import tsx --test tests/e2e/author-velocity-baseline.test.ts
```

Expected: FAIL until the loader and evaluator exist and the fixture expectations match their traces.

- [ ] **Step 4: Run focused tests**

```bash
node --import tsx --test tests/author-journey.test.ts tests/e2e/author-velocity-baseline.test.ts
```

Expected: PASS with four evaluated journeys and no failures.

---

### Task 3: Integrate author journeys into `npm run eval`

**Files:**
- Modify: `scripts/evaluate-fixtures.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`

- [ ] **Step 1: Write an evaluation-output regression test**

In `tests/e2e/author-velocity-baseline.test.ts`, execute `npm run eval` and assert the output contains:

```text
# Novel Forge author-journey baseline
- brief-to-book-plan: PASS
- resume-after-four-chapters: PASS
4/4 author journeys passed.
```

The test must also confirm the existing architecture and Novel Forge 1.3 release section headings remain present.

- [ ] **Step 2: Modify the evaluation runner**

After the existing 1.3 release section:

```ts
const journeyFixtures = loadAuthorJourneyFixtures(join(root, "journeys"));
let journeyFailures = 0;
console.log("\n# Novel Forge author-journey baseline\n");
for (const fixture of journeyFixtures) {
  const result = evaluateAuthorJourneyFixture(fixture);
  console.log(`- ${result.id}: ${result.passed ? "PASS" : `FAIL (${result.failures.join("; ")})`}`);
  for (const limitation of result.limitations) console.log(`  limitation: ${limitation}`);
  if (!result.passed) journeyFailures += 1;
}
console.log(`\n${journeyFixtures.length - journeyFailures}/${journeyFixtures.length} author journeys passed.`);
if (failures || releaseFailures || journeyFailures) process.exitCode = 1;
```

Exclude `journeys` from the architecture directory scan exactly as `v1-3-release` is excluded.

- [ ] **Step 3: Add a focused package script**

Add:

```json
"eval:journeys": "node --import tsx --test tests/author-journey.test.ts tests/e2e/author-velocity-baseline.test.ts"
```

Do not change package version or dependency metadata.

- [ ] **Step 4: Document the baseline semantics**

Document that:

- counts are deterministic workflow events, not time measurements;
- `contextCharacters` is the maximum observed context size;
- fixtures record current limitations and are not claims that later 1.4 targets already pass;
- future Author Velocity PRs must update or add fixtures only when behavior intentionally changes.

- [ ] **Step 5: Run complete verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass. The packed package must continue excluding `evals/` and tests.

- [ ] **Step 6: Inspect and merge exact tested head**

Confirm the final diff contains only the plan, evaluator module, four fixtures, tests, evaluation integration, and documentation. Resolve review threads, record the exact Actions run and head SHA, mark ready, and merge with SHA protection.

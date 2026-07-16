# Novel Forge 1.3 Phase 4 Strategy and Research-Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement book-strategy approval hardening, a decision-and-consequence plot ledger, a complete pre-approval stress test, and safe research-item-to-source graph/context integration.

**Architecture:** Add compatibility-first Phase 4 schemas that extend the existing plot grid and Phase 3 book strategy without making old projects unreadable. Put qualitative architecture checks in a typed `plan_stress_test` record and deterministic structural checks in a pure validator. Extend the in-memory graph with `research-item` nodes linked only to their registered sources, then compile only approved book guardrails, explicitly required ready claims, and source provenance into drafting context.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox, YAML, Node test runner, existing Novel Forge transactions and GitHub Actions matrix.

## Global Constraints

- Version remains exactly `1.3.0`; no release tag in this PR.
- `/novel` remains the primary interface; no new command or browser workflow.
- Existing projects without Phase 4 fields remain readable and receive no destructive migration.
- A rebuilt `book-plan` must submit the complete Phase 4 strategy, plot, queue, research, source, remarkability, and story-thread bundle.
- Human approval remains mandatory; the validator may block or report, but may not approve a plan.
- Raw public-review observations, raw influence references, reader-response bodies, and unapproved guardrails never enter drafting context.
- Only ready `RES-NNN` claims may satisfy new chapter packets.
- Research graph integration is limited to research-item-to-source and explicit chapter-to-research-item links.
- Preserve maximum graph depth, explicit-before-discovered ordering, provisional restrictions, inactive-thread restrictions, later-book exclusion, source terminal behavior, and provenance reporting.
- Every accepted mutation uses expected stage/hash validation, typed allowlists, rollback, one Git checkpoint, and refreshed `STATUS.md` and `HANDOFF.md`.
- Use TDD: tests must fail for the intended missing behavior before production changes.

---

### Task 1: Add Phase 4 architecture contracts

**Files:**
- Create: `src/domain/v1-3-architecture-schemas.ts`
- Modify: `src/domain/v1-3-schema-registry.ts`
- Modify: `src/project/templates.ts`
- Test: `tests/phase4-schemas.test.ts`

**Interfaces:**

```ts
export const PLAN_STRESS_CHECK_IDS = [
  "early-genre-promise",
  "middle-repetition",
  "motivated-risk",
  "fair-information",
  "uneven-alternatives",
  "avoidable-silence",
  "redundant-characters",
  "external-ending-contract",
  "emotional-ending-contract",
  "reference-similarity-and-tradeoffs",
] as const;

export interface DecisionLedgerEntry {
  id: string;
  chapter: number;
  choice: string;
  immediate_gain: string;
  deferred_cost: string;
  irreversible_effect: string;
  payoff_window: { start_chapter: number; end_chapter: number };
  status: "planned" | "made" | "paid-off" | "abandoned";
}
```

- [ ] **Step 1: Write failing schema tests**

Create `tests/phase4-schemas.test.ts` proving:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  BookStrategyPhase4Schema,
  PlotGridPhase4Schema,
  defaultPhase4StressTest,
} from "../src/domain/v1-3-architecture-schemas.js";
import { defaultBookStrategy } from "../src/domain/v1-3-schemas.js";

test("legacy plot and strategy remain readable without Phase 4 fields", () => {
  parseYaml(stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [] }), PlotGridPhase4Schema, "plot-grid.yaml");
  parseYaml(stringifyYaml(defaultBookStrategy()), BookStrategyPhase4Schema, "book-strategy.yaml");
});

test("Phase 4 defaults expose all exact stress checks", () => {
  assert.equal(defaultPhase4StressTest().length, 10);
  assert.deepEqual(defaultPhase4StressTest().map((item) => item.id), [
    "early-genre-promise", "middle-repetition", "motivated-risk", "fair-information",
    "uneven-alternatives", "avoidable-silence", "redundant-characters",
    "external-ending-contract", "emotional-ending-contract", "reference-similarity-and-tradeoffs",
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run through the draft PR Actions matrix. Expected failure: `v1-3-architecture-schemas.ts` does not exist.

- [ ] **Step 3: Implement compatibility-first schemas**

Create `src/domain/v1-3-architecture-schemas.ts` with:

```ts
import { Type, type Static } from "@sinclair/typebox";
import { PlotGridSchema } from "./schemas.js";
import { BookStrategyPhase3Schema } from "./v1-3-research-schemas.js";

export const PLAN_STRESS_CHECK_IDS = [
  "early-genre-promise", "middle-repetition", "motivated-risk", "fair-information",
  "uneven-alternatives", "avoidable-silence", "redundant-characters",
  "external-ending-contract", "emotional-ending-contract", "reference-similarity-and-tradeoffs",
] as const;

const DecisionLedgerEntrySchema = Type.Object({
  id: Type.String({ pattern: "^DEC-[0-9]{3}$" }),
  chapter: Type.Integer({ minimum: 1 }),
  choice: Type.String(),
  immediate_gain: Type.String(),
  deferred_cost: Type.String(),
  irreversible_effect: Type.String(),
  payoff_window: Type.Object({
    start_chapter: Type.Integer({ minimum: 1 }),
    end_chapter: Type.Integer({ minimum: 1 }),
  }, { additionalProperties: false }),
  status: Type.Union([
    Type.Literal("planned"), Type.Literal("made"), Type.Literal("paid-off"), Type.Literal("abandoned"),
  ]),
}, { additionalProperties: false });

const PlanStressCheckSchema = Type.Object({
  id: Type.Union(PLAN_STRESS_CHECK_IDS.map((id) => Type.Literal(id))),
  status: Type.Union([Type.Literal("pending"), Type.Literal("pass"), Type.Literal("accepted-tradeoff"), Type.Literal("blocked")]),
  rationale: Type.String(),
  evidence_refs: Type.Array(Type.String()),
  tradeoff_id: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: false });

export const PlotGridPhase4Schema = Type.Object({
  ...PlotGridSchema.properties,
  decisions: Type.Optional(Type.Array(DecisionLedgerEntrySchema)),
}, { additionalProperties: false });

export const BookStrategyPhase4Schema = Type.Object({
  ...BookStrategyPhase3Schema.properties,
  plan_stress_test: Type.Optional(Type.Array(PlanStressCheckSchema)),
}, { additionalProperties: false });

export type PlotGridPhase4 = Static<typeof PlotGridPhase4Schema>;
export type BookStrategyPhase4 = Static<typeof BookStrategyPhase4Schema>;
export function defaultPhase4StressTest(): BookStrategyPhase4["plan_stress_test"] {
  return PLAN_STRESS_CHECK_IDS.map((id) => ({ id, status: "pending", rationale: "", evidence_refs: [], tradeoff_id: null }));
}
```

- [ ] **Step 4: Register the schemas before legacy schemas**

Add these registry entries in `src/domain/v1-3-schema-registry.ts`:

```ts
[/(^|\/)plot-grid\.yaml$/, PlotGridPhase4Schema],
[/(^|\/)book-strategy\.yaml$/, BookStrategyPhase4Schema],
```

Remove the earlier Phase 3-only `book-strategy.yaml` registry entry so the more complete schema owns the path.

- [ ] **Step 5: Update new-project defaults**

In `src/project/templates.ts`, emit `decisions: []` in new plot grids and `plan_stress_test: defaultPhase4StressTest()` in new book strategies.

- [ ] **Step 6: Verify GREEN**

```bash
node --import tsx --test tests/phase4-schemas.test.ts tests/v1-3-schemas.test.ts tests/templates-v1-3.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/v1-3-architecture-schemas.ts src/domain/v1-3-schema-registry.ts src/project/templates.ts tests/phase4-schemas.test.ts
git commit -m "feat: add Phase 4 architecture contracts"
```

---

### Task 2: Add deterministic strategy and architecture validation

**Files:**
- Create: `src/application/book-strategy.ts`
- Test: `tests/book-strategy.test.ts`
- Test: `tests/decision-ledger.test.ts`
- Test: `tests/expectation-map.test.ts`

**Interfaces:**

```ts
export interface BookPlanFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

export function bookPlanFindings(input: {
  strategy: BookStrategyPhase4;
  plot: PlotGridPhase4;
  queue: ChapterQueueState;
}): BookPlanFinding[];

export function renderApprovedBookGuardrails(strategy: BookStrategyPhase4): string;
```

- [ ] **Step 1: Write failing book-strategy tests**

Create tests proving:

```ts
test("book approval requires a reader promise and approved expectation decisions", () => {
  const findings = bookPlanFindings({ strategy: strategyFixture(), plot: plotFixture(), queue: queueFixture() });
  assert.ok(findings.some((item) => item.code === "missing-reader-promise"));
  assert.ok(findings.some((item) => item.code === "unapproved-expectation"));
});

test("all ten stress checks must be resolved", () => {
  const strategy = completeStrategy();
  strategy.plan_stress_test![0]!.status = "pending";
  assert.ok(bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).some((item) => item.code === "unresolved-stress-check"));
});

test("accepted stress tradeoffs must reference a recorded tradeoff", () => {
  const strategy = completeStrategy();
  strategy.plan_stress_test![0] = { ...strategy.plan_stress_test![0]!, status: "accepted-tradeoff", tradeoff_id: "TRADE-404" };
  assert.ok(bookPlanFindings({ strategy, plot: completePlot(), queue: queueFixture() }).some((item) => item.code === "missing-stress-tradeoff"));
});
```

- [ ] **Step 2: Write failing decision-ledger tests**

```ts
test("decision entries link to valid planned chapters and payoff windows", () => {
  const plot = completePlot();
  plot.decisions![0]!.chapter = 99;
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).some((item) => item.code === "invalid-decision-chapter"));
});

test("decision entries require gain cost irreversible effect and a forward payoff", () => {
  const plot = completePlot();
  plot.decisions![0]!.deferred_cost = "";
  plot.decisions![0]!.payoff_window = { start_chapter: 1, end_chapter: 1 };
  const codes = bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).map((item) => item.code);
  assert.ok(codes.includes("incomplete-decision-consequence"));
  assert.ok(codes.includes("invalid-payoff-window"));
});
```

- [ ] **Step 3: Write failing causality and repetition tests**

```ts
test("payoffs require an earlier setup", () => {
  const plot = completePlot();
  plot.chapters[0]!.payoff_ids = ["ST-UNSEEDED"];
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot, queue: queueFixture() }).some((item) => item.code === "payoff-before-setup"));
});

test("three consecutive identical scene engines block the plan", () => {
  const queue = queueFixture();
  queue.packets = [1, 2, 3].map((chapter) => packet(chapter, "interview"));
  assert.ok(bookPlanFindings({ strategy: completeStrategy(), plot: completePlot(), queue }).some((item) => item.code === "middle-scene-repetition"));
});
```

- [ ] **Step 4: Implement minimal validator**

`bookPlanFindings` must:

- reject a blank reader promise or empty required experiences;
- require at least one expectation entry and require every expectation `status: approved`;
- require each moderate/strong friction cluster to have a writer decision;
- require all ten exact stress check IDs exactly once;
- reject `pending` or `blocked` stress checks;
- require rationale and evidence refs for resolved stress checks;
- require `accepted-tradeoff` checks to reference an existing accepted tradeoff;
- require at least one decision ledger entry;
- validate duplicate decision IDs, valid decision chapter, nonblank consequence fields, and a payoff window after the choice within planned chapters;
- reject payoffs without an earlier setup;
- reject three consecutive identical nonblank scene engines;
- preserve existing Phase 3 reader-friction findings by appending `readerFrictionFindings(strategy)`.

`renderApprovedBookGuardrails` returns only nonblank `review_derived_guardrails` with `status: approved`, one rule per line prefixed `BOOK GUARDRAIL:`.

- [ ] **Step 5: Verify GREEN**

```bash
node --import tsx --test tests/book-strategy.test.ts tests/decision-ledger.test.ts tests/expectation-map.test.ts tests/reader-friction.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/application/book-strategy.ts tests/book-strategy.test.ts tests/decision-ledger.test.ts tests/expectation-map.test.ts
git commit -m "feat: validate book strategy and decision consequences"
```

---

### Task 3: Add research items to the safe story graph

**Files:**
- Modify: `src/context/story-graph.ts`
- Test: `tests/story-graph.test.ts`
- Test: `tests/research-graph.test.ts`

**Interfaces:**

```ts
export type StoryGraphNodeType = ExistingNodeTypes | "research-item";
export type StoryGraphRecordNodeType = ExistingRecordTypes | "research-item";

export interface StoryGraphInput {
  // existing fields
  research?: ResearchLedger;
}

export interface StoryGraphResolution {
  // existing fields
  researchIds: string[];
}
```

- [ ] **Step 1: Write failing graph tests**

```ts
test("explicit ready research selects the claim and discovers only supporting sources", () => {
  const input = researchGraphFixture();
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));
  assert.deepEqual(resolution.researchIds, ["RES-001"]);
  assert.deepEqual(resolution.sourceIds, ["SRC-001"]);
  assert.ok(!resolution.researchIds.includes("RES-002"));
});

test("research source remains terminal and cannot pull another claim", () => {
  const input = researchGraphFixture();
  input.sources.sources[0]!.supports_research_ids = ["RES-001", "RES-002"];
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));
  assert.deepEqual(resolution.researchIds, ["RES-001"]);
});

test("legacy source IDs preserve existing explicit source behavior", () => {
  const input = researchGraphFixture();
  currentPacket(input).required_research = ["SRC-001"];
  const resolution = resolveDraftingGraphContext(buildStoryGraph(input), currentPacket(input));
  assert.ok(resolution.sourceIds.includes("SRC-001"));
});
```

- [ ] **Step 2: Verify RED**

Expected failure: graph types and `researchIds` do not exist.

- [ ] **Step 3: Implement graph nodes and edges**

- Add `research-item` node IDs as `research-item:${id}`.
- Add ready and non-ready ledger items with their status and ledger source path.
- Link packet chapters to `RES-NNN` nodes using `requires-research`.
- Preserve legacy `SRC-*` packet links using `requires-source`.
- Link a research item only to the source IDs it declares and that source declares in `supports_research_ids`.
- Keep `research-source` terminal.
- Treat non-ready research as blocked reason `unready-research` when encountered.
- Add research items before sources in deterministic record ordering.
- Return `researchIds` separately from `sourceIds`.

- [ ] **Step 4: Verify existing safety contract**

```bash
node --import tsx --test tests/story-graph.test.ts tests/research-graph.test.ts
```

Expected: all existing graph tests remain unchanged and passing plus new research tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/context/story-graph.ts tests/story-graph.test.ts tests/research-graph.test.ts
git commit -m "feat: add safe research-item graph context"
```

---

### Task 4: Compile approved book strategy and ready claims into drafting context

**Files:**
- Modify: `src/context/context-builder.ts`
- Test: `tests/context.test.ts`
- Test: `tests/phase4-context.test.ts`

- [ ] **Step 1: Write failing context tests**

```ts
test("drafting context includes approved book guardrails and required ready claims", () => {
  const context = buildChapterContext(phase4Project(), 2);
  assert.match(context.text, /Approved book guardrails/);
  assert.match(context.text, /BOOK GUARDRAIL: preserve costly choices/);
  assert.match(context.text, /Required ready research claims/);
  assert.match(context.text, /RES-001/);
  assert.match(context.text, /SRC-001/);
});

test("drafting context excludes public observations and unrequired claims", () => {
  const context = buildChapterContext(phase4Project(), 2);
  assert.doesNotMatch(context.text, /RAW PUBLIC REVIEW BODY/);
  assert.doesNotMatch(context.text, /UNREQUIRED CLAIM MARKER/);
  assert.ok(context.report.excluded.includes("raw public reviews"));
});
```

- [ ] **Step 2: Verify RED**

Expected failure: context has no approved book-guardrail or ready-claim sections.

- [ ] **Step 3: Implement bounded sections**

In `buildChapterContext`:

- parse `book-strategy.yaml` with `BookStrategyPhase4Schema`;
- pass `research` into `buildStoryGraph`;
- use `graphResolution.researchIds` to select only ready ledger items;
- select only source records named by those items or selected by graph resolution;
- add required section `Required ready research claims` with selected claim records;
- add optional/required section `Approved book guardrails` using `renderApprovedBookGuardrails`;
- never include `reader_friction.observations`, cluster paraphrases, raw influence names, or reader responses;
- report included `research RES-NNN`, `source SRC-NNN`, and `approved book guardrails` entries;
- retain existing context budgets and graph provenance.

- [ ] **Step 4: Verify GREEN**

```bash
node --import tsx --test tests/context.test.ts tests/context-integrity.test.ts tests/phase4-context.test.ts tests/story-graph.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/context/context-builder.ts tests/context.test.ts tests/phase4-context.test.ts
git commit -m "feat: compile Phase 4 drafting context"
```

---

### Task 5: Enforce Phase 4 at event and planning boundaries

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/application/prompts.ts`
- Test: `tests/phase4-integration.test.ts`
- Test: `tests/phase4-prompts.test.ts`

- [ ] **Step 1: Write failing event tests**

```ts
test("book-plan rejects an unresolved stress test", () => {
  assert.throws(() => applyNovelEvent(root, bookPlanEvent({ stressStatus: "pending" })), /stress/i);
});

test("book-plan rejects an invalid decision payoff window", () => {
  assert.throws(() => applyNovelEvent(root, bookPlanEvent({ payoffStart: 1, payoffEnd: 1 })), /payoff/i);
});

test("chapter queue rejects a ready packet whose research item is unready", () => {
  assert.throws(() => applyNovelEvent(root, queueEventWithResearch("RES-001", "researching")), /not ready/i);
});
```

- [ ] **Step 2: Write failing prompt tests**

```ts
test("book planning requires the decision ledger and exact stress test", () => {
  const prompt = bookPlanPrompt(root);
  assert.match(prompt, /decision-and-consequence ledger/i);
  assert.match(prompt, /early genre promise/i);
  assert.match(prompt, /avoidable silence/i);
  assert.match(prompt, /reference similarity/i);
});

test("queue planning requires ready RES IDs and approved guardrails", () => {
  const prompt = queuePrompt(root);
  assert.match(prompt, /ready RES-NNN/i);
  assert.match(prompt, /approved book guardrails/i);
});
```

- [ ] **Step 3: Implement event validation**

- Parse plot grids with `PlotGridPhase4Schema` and strategies with `BookStrategyPhase4Schema`.
- For `book-plan`, call `bookPlanFindings`; reject all blockers.
- For `chapter-queue`, validate decision ledger consistency and packet research references without requiring a fresh stress-test rewrite.
- Keep Phase 3 research and reader-friction validation in place.
- Ensure `book-plan` approval hashes continue to cover plot, strategy, research, remarkability, and source provenance through existing gate-evidence paths.

- [ ] **Step 4: Update prompts**

Book planning must explicitly request:

- complete reader promise and approved expectation map;
- all ten stress checks with evidence and author tradeoff links;
- decision entries with gain, cost, irreversible effect, and payoff window;
- fair setup/payoff order and nonrepetitive middle engines;
- only approved review-derived guardrails.

Queue planning must use only ready `RES-NNN` IDs for new packets and carry approved book guardrails into drafting packets without copying raw reviews.

- [ ] **Step 5: Verify GREEN**

```bash
node --import tsx --test tests/phase4-integration.test.ts tests/phase4-prompts.test.ts tests/research-event.test.ts tests/guided-command-prompts.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/application/events.ts src/application/integrity.ts src/application/prompts.ts tests/phase4-integration.test.ts tests/phase4-prompts.test.ts
git commit -m "feat: enforce Phase 4 planning boundaries"
```

---

### Task 6: Documentation, evaluation, and final verification

**Files:**
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Modify: `scripts/evaluate-fixtures.ts` only if existing fixtures require a compatibility adapter
- Test: existing complete suite

- [ ] **Step 1: Document delivered behavior**

Document:

- decision-and-consequence ledger fields;
- the exact ten stress-test concerns;
- approved book guardrails in drafting context;
- required ready research claims plus source provenance;
- research-item-to-source graph limits;
- compatibility for projects without Phase 4 fields;
- continued separation of public observations and human manuscript readers.

- [ ] **Step 2: Run focused Phase 4 gate**

```bash
node --import tsx --test \
  tests/phase4-schemas.test.ts \
  tests/book-strategy.test.ts \
  tests/expectation-map.test.ts \
  tests/decision-ledger.test.ts \
  tests/research-graph.test.ts \
  tests/phase4-context.test.ts \
  tests/phase4-integration.test.ts \
  tests/phase4-prompts.test.ts \
  tests/story-graph.test.ts \
  tests/context.test.ts
```

- [ ] **Step 3: Run full Actions matrix**

Both Node 22.19.0 and Node 24 must pass:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

- [ ] **Step 4: Static safety review**

Confirm:

- no raw review or influence evidence enters context;
- research sources remain graph terminal nodes;
- unready claims cannot satisfy packets;
- old projects parse without Phase 4 fields;
- no temporary workflow, diagnostics, generated package, or imported corpus remains;
- no release tag was created.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md SKILL.md CHANGELOG.md RELEASE.md scripts/evaluate-fixtures.ts
git commit -m "docs: document Novel Forge Phase 4 strategy graph"
```

- [ ] **Step 6: Mark PR ready and merge only after review threads are resolved and the final matrix is green**

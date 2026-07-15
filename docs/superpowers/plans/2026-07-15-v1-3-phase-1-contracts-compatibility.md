# Novel Forge 1.3 Phase 1 Contracts and Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the typed Novel Forge 1.3 evidence contracts, non-transitioning `research-update` event, 1.3 templates, and advisory-only compatibility for existing 1.2 projects.

**Architecture:** Keep the stable `PROJECT.yaml` and `BOOK.yaml` schemas unchanged. Add a focused 1.3 schema module and registry for the new YAML artifacts, extend the existing guarded event engine with one state-neutral event, seed new projects/books from typed defaults, and surface missing 1.3 artifacts as warnings rather than blockers for older workspaces.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, TypeBox, YAML, Node test runner, existing Novel Forge transactions, status/handoff generation, and GitHub Actions.

## Global Constraints

- Version target is exactly `1.3.0`.
- Start from merged planning PR #8 and current `main`.
- Use branch `agent/v1.3-phase-1-contracts-compatibility`.
- Do not add a top-level creative stage.
- `research-update` may operate only during `voice-intake`, `series-planning`, `book-planning`, `drafting`, `act-review`, `revision`, `manuscript-review`, and `packaging`.
- `research-update` must never write manuscript prose, `PROJECT.yaml`, `BOOK.yaml`, `STATUS.md`, `HANDOFF.md`, reader experiment files, publishing files, marketing files, or package outputs.
- `research-update` must not change stage, gates, approvals, active book, or book status.
- Existing 1.2 projects remain readable without mandatory migration.
- Missing 1.3 artifacts are warnings for older projects, not blockers.
- New projects and newly added books receive all 1.3 templates.
- Use TDD: each production behavior starts with a failing test commit.

---

### Task 1: Add strict 1.3 evidence schemas and defaults

**Files:**
- Create: `src/domain/v1-3-schemas.ts`
- Create: `src/domain/v1-3-schema-registry.ts`
- Test: `tests/v1-3-schemas.test.ts`

**Interfaces:**
- Produces `TasteProfileSchema`, `VoiceGuardrailsSchema`, `VoiceExperimentIndexSchema`, `VoiceExperimentFileSchema`, `ResearchLedgerSchema`, `BookStrategySchema`, and `VoiceAuditsSchema`.
- Produces types with matching names minus `Schema`.
- Produces default factories:
  - `defaultTasteProfile(): TasteProfile`
  - `defaultVoiceGuardrails(): VoiceGuardrails`
  - `defaultVoiceExperimentIndex(): VoiceExperimentIndex`
  - `defaultResearchLedger(): ResearchLedger`
  - `defaultBookStrategy(): BookStrategy`
  - `defaultVoiceAudits(): VoiceAudits`
- Produces `v13SchemaForPath(path: string): TSchema | null`.

- [ ] **Step 1: Write the failing schema tests**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  BookStrategySchema,
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceAuditsSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
  defaultBookStrategy,
  defaultResearchLedger,
  defaultTasteProfile,
  defaultVoiceAudits,
  defaultVoiceExperimentIndex,
  defaultVoiceGuardrails,
} from "../src/domain/v1-3-schemas.js";
import { v13SchemaForPath } from "../src/domain/v1-3-schema-registry.js";

test("1.3 defaults validate as strict empty evidence artifacts", () => {
  parseYaml(stringifyYaml(defaultTasteProfile()), TasteProfileSchema, "taste-profile.yaml");
  parseYaml(stringifyYaml(defaultVoiceGuardrails()), VoiceGuardrailsSchema, "voice-guardrails.yaml");
  parseYaml(stringifyYaml(defaultVoiceExperimentIndex()), VoiceExperimentIndexSchema, "voice-experiments/index.yaml");
  parseYaml(stringifyYaml(defaultResearchLedger()), ResearchLedgerSchema, "research-ledger.yaml");
  parseYaml(stringifyYaml(defaultBookStrategy()), BookStrategySchema, "book-strategy.yaml");
  parseYaml(stringifyYaml(defaultVoiceAudits()), VoiceAuditsSchema, "voice-audits.yaml");
});

test("1.3 schemas reject unknown fields and incomplete ready research", () => {
  assert.throws(() => parseYaml(stringifyYaml({ ...defaultTasteProfile(), extra: true }), TasteProfileSchema, "taste-profile.yaml"), /schema validation/i);
  const ledger = defaultResearchLedger() as any;
  ledger.items.push({ id: "RES-001", lane: "story-world", status: "ready" });
  assert.throws(() => parseYaml(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger.yaml"), /schema validation/i);
});

test("voice experiment files require anonymous variants and a stable baseline record", () => {
  const value = {
    schema_version: "1.0.0",
    id: "VE-001",
    status: "accepted",
    source_scene_path: "series/voice-experiments/VE-001/source-scene.md",
    source_scene_hash: "a".repeat(64),
    variants: [
      { id: "A", path: "series/voice-experiments/VE-001/variant-a.md", content_hash: "b".repeat(64) },
      { id: "B", path: "series/voice-experiments/VE-001/variant-b.md", content_hash: "c".repeat(64) },
      { id: "C", path: "series/voice-experiments/VE-001/variant-c.md", content_hash: "d".repeat(64) },
    ],
    scores: [],
    accepted_traits: [],
    baseline_path: "series/voice-experiments/VE-001/baseline.md",
    baseline_hash: "e".repeat(64),
  };
  parseYaml(stringifyYaml(value), VoiceExperimentFileSchema, "experiment.yaml");
});

test("the 1.3 registry recognizes every new canonical YAML path", () => {
  for (const path of [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    "series/voice-experiments/VE-001/experiment.yaml",
    "books/book-01/research-ledger.yaml",
    "books/book-01/book-strategy.yaml",
    "books/book-01/voice-audits.yaml",
  ]) assert.ok(v13SchemaForPath(path), path);
  assert.equal(v13SchemaForPath("books/book-01/manuscript/chapters/001.md"), null);
});
```

- [ ] **Step 2: Commit the tests and verify RED in GitHub Actions**

Expected failures: missing `src/domain/v1-3-schemas.ts` and `src/domain/v1-3-schema-registry.ts`.

- [ ] **Step 3: Implement the strict schemas and defaults**

Use `Type.Object(..., { additionalProperties: false })` for every durable record. Use these exact top-level shapes:

```typescript
export interface EmptyDefaults {
  schema_version: "1.0.0";
}

export function defaultTasteProfile(): TasteProfile {
  return {
    schema_version: "1.0.0",
    precedence: ["explicit-writer-decisions", "writer-samples", "accepted-voice-baseline", "approved-voice-profile", "influence-references", "genre-defaults"],
    influences: [],
    negative_references: [],
    opening_experiment: { status: "not-started", experiment_id: null, baseline_path: null },
  };
}

export function defaultVoiceGuardrails(): VoiceGuardrails {
  return { schema_version: "1.0.0", must: [], prefer: [], avoid: [], monitor: [], baseline: { path: null, content_hash: null, metrics: {} }, pov_signatures: [] };
}

export function defaultVoiceExperimentIndex(): VoiceExperimentIndex {
  return { schema_version: "1.0.0", experiments: [] };
}

export function defaultResearchLedger(): ResearchLedger {
  return { schema_version: "1.0.0", items: [] };
}

export function defaultBookStrategy(): BookStrategy {
  return { schema_version: "1.0.0", reader_promise: { statement: "", required_experiences: [] }, expectation_map: [], reader_friction: { observations: [], clusters: [], accepted_tradeoffs: [] }, originality: { risks: [], mitigations: [] }, review_derived_guardrails: [] };
}

export function defaultVoiceAudits(): VoiceAudits {
  return { schema_version: "1.0.0", audits: [] };
}
```

- [ ] **Step 4: Implement the path registry**

```typescript
const registry: Array<[RegExp, TSchema]> = [
  [/(^|\/)taste-profile\.yaml$/, TasteProfileSchema],
  [/(^|\/)voice-guardrails\.yaml$/, VoiceGuardrailsSchema],
  [/(^|\/)voice-experiments\/index\.yaml$/, VoiceExperimentIndexSchema],
  [/(^|\/)voice-experiments\/VE-[0-9]{3}\/experiment\.yaml$/, VoiceExperimentFileSchema],
  [/(^|\/)research-ledger\.yaml$/, ResearchLedgerSchema],
  [/(^|\/)book-strategy\.yaml$/, BookStrategySchema],
  [/(^|\/)voice-audits\.yaml$/, VoiceAuditsSchema],
];
```

- [ ] **Step 5: Verify GREEN**

Run in CI:

```bash
node --import tsx --test tests/v1-3-schemas.test.ts
npm run typecheck
```

Expected: all focused tests pass.

---

### Task 2: Register 1.3 validation with transactions

**Files:**
- Modify: `src/infrastructure/transaction.ts`
- Modify: `src/domain/v1-2-schema-registry.ts` only if the transaction currently imports one registry directly; otherwise add one small composed registry module.
- Test: `tests/v1-3-schemas.test.ts`

**Interfaces:**
- Every changed YAML file is checked by existing core schemas, then v1.2 schemas, then v1.3 schemas.

- [ ] **Step 1: Add a failing transaction test**

Create a temporary project, attempt a guarded transaction writing `series/taste-profile.yaml` with an unknown property, and assert `/schema validation/i`.

- [ ] **Step 2: Verify RED**

Expected: malformed 1.3 YAML is accepted because the transaction does not know the new registry.

- [ ] **Step 3: Add `v13SchemaForPath` to the transaction schema lookup chain**

Use the existing lookup order and return the first non-null schema. Do not modify the old schema contracts.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --import tsx --test tests/v1-3-schemas.test.ts tests/transaction.test.ts
```

---

### Task 3: Seed 1.3 artifacts in new projects and books

**Files:**
- Modify: `src/project/templates.ts`
- Modify: `src/project/add-book.ts` only if tests reveal template output is filtered.
- Test: `tests/project-store.test.ts`
- Test: `tests/v1-3-compatibility.test.ts`

**Interfaces:**
- `projectTemplateFiles()` adds series-level files.
- `bookTemplateFiles()` adds book-level files.

- [ ] **Step 1: Write failing template tests**

```typescript
test("new projects seed all 1.3 evidence artifacts", () => {
  const root = initializeProject(tempRoot(), { projectName: "Taste Test", projectType: "standalone", profile: "thriller" });
  for (const path of [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    "books/book-01/research-ledger.yaml",
    "books/book-01/book-strategy.yaml",
    "books/book-01/voice-audits.yaml",
  ]) assert.ok(existsSync(join(root, path)), path);
});
```

Add a second test that locks or force-adds `book-02` and asserts the three book-level artifacts exist there.

- [ ] **Step 2: Verify RED**

Expected: new paths are absent.

- [ ] **Step 3: Add typed default files to templates**

Import the new factories and serialize them with `stringifyYaml`. Keep `voice-profile.md` unchanged.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --import tsx --test tests/project-store.test.ts tests/v1-3-compatibility.test.ts
```

---

### Task 4: Add the state-neutral `research-update` event

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/authorization.ts`
- Test: `tests/research-event.test.ts`
- Test: `tests/pi-runtime.test.ts`

**Interfaces:**
- Add `"research-update"` to `NovelEventType`.
- Add `research-update` to the public tool union.
- Add `research-update` to allowed stages exactly as listed in Global Constraints.
- Allowed paths:
  - `series/taste-profile.yaml`
  - `series/voice-guardrails.yaml`
  - `series/voice-experiments/index.yaml`
  - `series/voice-experiments/VE-NNN/experiment.yaml`
  - `series/voice-experiments/VE-NNN/*.md`
  - `books/<active-book>/research-ledger.yaml`
  - `books/<active-book>/book-strategy.yaml`
  - `books/<active-book>/voice-audits.yaml`
  - `research/source-register.yaml`
- Require at least one changed file.
- The switch case performs no project/book mutation.

- [ ] **Step 1: Write failing event tests**

Cover:

```typescript
test("research-update applies typed research files without changing stage or gates", () => { /* initialize, capture PROJECT/BOOK, apply event, compare */ });
test("research-update rejects manuscript and state files", () => { /* assert path errors */ });
test("research-update rejects stale stage and project hash", () => { /* assert existing stale errors */ });
test("research-update is unavailable during complete", () => { /* assert stage error */ });
```

- [ ] **Step 2: Verify RED**

Expected: event type is not assignable/registered.

- [ ] **Step 3: Implement the minimal event support**

In `events.ts`:

```typescript
export type NovelEventType = ExistingNovelEventType | "research-update";

const eventStages = {
  ...existing,
  "research-update": ["voice-intake", "series-planning", "book-planning", "drafting", "act-review", "revision", "manuscript-review", "packaging"],
};
```

Add exact and patterned allowlists. Add:

```typescript
case "research-update":
  break;
```

Do not add required output patterns beyond requiring at least one file.

- [ ] **Step 4: Expose the event through the Pi tool schema**

Add `Type.Literal("research-update")` and mention research evidence in the tool description/guidelines.

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --import tsx --test tests/research-event.test.ts tests/pi-runtime.test.ts
npm run typecheck
```

---

### Task 5: Require 1.3 evidence only when rebuilding relevant plans

**Files:**
- Modify: `src/application/events.ts`
- Test: `tests/research-event.test.ts`
- Test: `tests/v1-3-compatibility.test.ts`

**Interfaces:**
- A new `voice-profile` event must submit:
  - `series/voice-profile.md`
  - `series/taste-profile.yaml`
  - `series/voice-guardrails.yaml`
  - `series/voice-experiments/index.yaml`
- A new `book-plan` event must submit:
  - existing required book-plan files
  - `books/<active-book>/research-ledger.yaml`
  - `books/<active-book>/book-strategy.yaml`
- A review event may write `voice-audits.yaml`, but it is not required in Phase 1.

- [ ] **Step 1: Add failing rebuilt-plan tests**

Assert that a voice event missing `taste-profile.yaml` fails with `voice-profile event is missing required output`, and a book plan missing `book-strategy.yaml` fails similarly.

- [ ] **Step 2: Verify RED**

Expected: old minimal events are still accepted.

- [ ] **Step 3: Expand event allowlists and required-output validation**

Keep compatibility at rest: do not make status require these files for older projects. Requirements apply only when an event rebuilds the corresponding plan.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --import tsx --test tests/research-event.test.ts tests/v1-3-compatibility.test.ts tests/events.test.ts
```

---

### Task 6: Add advisory-only 1.2 compatibility and 1.3 versioning

**Files:**
- Modify: `src/application/version-core.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/version.ts` only if upgrade behavior needs no-op protection.
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/v1-3-compatibility.test.ts`
- Test: `tests/v1.2-version.test.ts`
- Test: `tests/version-guide-handoff.test.ts`

**Interfaces:**
- `NOVEL_FORGE_VERSION` becomes `"1.3.0"`.
- New projects record `1.3.0` through existing templates.
- Older projects receive the existing older-version warning.
- `getProjectStatus()` adds warnings for absent 1.3 artifacts only when `novel_forge_version` is missing or below `1.3.0`.
- Missing 1.3 files never enter `blockers` for older workspaces.

- [ ] **Step 1: Write failing compatibility tests**

```typescript
test("a 1.2 project without 1.3 artifacts remains unblocked", () => {
  const status = getProjectStatus(legacy12Root());
  assert.equal(status.blockers.some((item) => item.includes("taste-profile")), false);
  assert.ok(status.warnings.some((item) => item.includes("Optional Novel Forge 1.3 research setup")));
});

test("new projects record Novel Forge 1.3.0", () => {
  assert.equal(readProject(initialize13Root()).novel_forge_version, "1.3.0");
});
```

- [ ] **Step 2: Verify RED**

Expected: installed version remains 1.2.0 and no 1.3 advisory exists.

- [ ] **Step 3: Implement version and status behavior**

Add a helper that compares recorded versions without exporting a second semantic-version implementation. Add one consolidated warning listing missing optional 1.3 paths and directing the writer to the future research workflow. Do not add each missing file to blockers.

- [ ] **Step 4: Synchronize package files**

Set `package.json` and lockfile package versions to `1.3.0`. Do not add dependencies.

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --import tsx --test tests/v1-3-compatibility.test.ts tests/v1.2-version.test.ts tests/version-guide-handoff.test.ts
npm run typecheck
```

---

### Task 7: Full Phase 1 verification and PR boundary

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md` only to document compatibility and the internal Phase 1 boundary; do not advertise unfinished Phase 2 workflows.

- [ ] **Step 1: Run the focused gate**

```bash
npm ci
npm run typecheck
node --import tsx --test tests/v1-3-schemas.test.ts tests/research-event.test.ts tests/v1-3-compatibility.test.ts tests/project-store.test.ts
```

Expected: all pass on Node 22.19.0 and Node 24.

- [ ] **Step 2: Run the complete repository gate**

```bash
npm test
npm run eval
npm pack --dry-run
```

Expected: zero failures; package contains the new source modules and no generated project artifacts.

- [ ] **Step 3: Inspect changed paths**

Allowed Phase 1 paths are limited to:

```text
CHANGELOG.md
README.md
package.json
package-lock.json
src/application/authorization.ts
src/application/events.ts
src/application/status.ts
src/application/version-core.ts
src/application/version.ts
src/domain/v1-3-schema-registry.ts
src/domain/v1-3-schemas.ts
src/infrastructure/transaction.ts
src/pi/extension.ts
src/project/add-book.ts
src/project/templates.ts
tests/project-store.test.ts
tests/research-event.test.ts
tests/v1-3-compatibility.test.ts
tests/v1-3-schemas.test.ts
tests/v1.2-version.test.ts
tests/version-guide-handoff.test.ts
```

Any other changed path requires an explicit explanation in the PR body.

- [ ] **Step 4: Open a draft PR against `main`**

PR title: `Add Novel Forge 1.3 research contracts and compatibility`

The PR must report the red/green commits, exact CI run IDs, compatibility behavior, path allowlists, complete Node matrix, and final verified head.

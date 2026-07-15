# Author Taste, Research, and Reader Friction Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development where available or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 1.3 typed artifact contracts, default files, guarded research event, and backward-compatible advisories without yet implementing the Influence Palette UI, review clustering, or voice audits.

**Architecture:** New 1.3 YAML schemas live in a dedicated domain module and registry, following the 1.2 pattern. New projects and new books receive empty valid artifacts. A non-transitioning `research-update` event writes only allowlisted evidence files through the existing stage/hash/schema/rollback/Git pipeline. Existing 1.2 projects remain readable; missing 1.3 artifacts are warnings until a 1.3 voice or book plan is intentionally rebuilt.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, TypeBox, YAML, Node test runner, existing Novel Forge transaction and Pi extension layers.

## Global Constraints

- Target package version is `1.3.0-dev` on the feature branch and becomes `1.3.0` only in the release PR.
- Base commit is `49888355c84f9089a95f09a90b58675987ee6be7`.
- Do not add retailer scraping, browser UI, clustering logic, or graph changes in this foundation PR.
- Do not make absent 1.3 files blockers for projects whose recorded version is lower than 1.3.0.
- `research-update` never changes stage, gate, `BOOK.yaml`, manuscript prose, publishing approval, or accepted reader rows.
- Every YAML artifact is strict (`additionalProperties: false`).
- All writes remain expected-stage and expected-project-hash checked and run through the current transactional event path.

---

### Task 1: Add strict 1.3 artifact schemas and defaults

**Files:**
- Create: `src/domain/v1-3-schemas.ts`
- Create: `src/domain/v1-3-schema-registry.ts`
- Modify: `src/infrastructure/transaction.ts`
- Create: `tests/v1.3-schemas.test.ts`

**Interfaces:**
- Produces `TasteProfileSchema`, `VoiceGuardrailsSchema`, `VoiceExperimentIndexSchema`, `ResearchLedgerSchema`, `BookStrategySchema`, and `VoiceAuditsSchema`.
- Produces `defaultTasteProfile()`, `defaultVoiceGuardrails()`, `defaultVoiceExperimentIndex()`, `defaultResearchLedger()`, `defaultBookStrategy()`, and `defaultVoiceAudits()`.
- Produces `v13SchemaForPath(path: string): TSchema | null`.

- [ ] **Step 1: Write failing schema tests**

Create `tests/v1.3-schemas.test.ts` with tests that:

```ts
const taste = defaultTasteProfile();
assert.equal(taste.precedence[0], "explicit-writer-decisions");
assert.throws(() => parseYaml(stringifyYaml({ ...taste, unknown: true }), TasteProfileSchema, "taste-profile.yaml"), /schema validation/i);

const ledger = defaultResearchLedger();
ledger.items.push({
  id: "RES-001",
  lane: "story-world",
  claim: "A pressure door requires two independent confirmations.",
  source_ids: ["SRC-001"],
  confidence: "high",
  verified_on: "2026-07-15",
  story_use: {
    chapters: [4],
    dramatic_functions: ["procedural-constraint"],
    decision_affected: "The protagonist cannot safely open the door alone.",
  },
  knowledge_scope: { known_by: ["protagonist"], incorrectly_believed_by: [], unknown_to: ["antagonist"] },
  fictionalization: { status: "unchanged", reason: "" },
  risks: [],
  status: "ready",
});
assert.doesNotThrow(() => parseYaml(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger.yaml"));
```

Also assert the registry maps each canonical path and rejects unknown keys.

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
node --import tsx --test tests/v1.3-schemas.test.ts
```

Expected: failure because `v1-3-schemas.ts` does not exist.

- [ ] **Step 3: Implement schemas and defaults**

Use TypeBox strict objects. Exact unions:

```ts
export const InfluenceTypeSchema = Type.Union([
  Type.Literal("voice"),
  Type.Literal("reader-experience"),
  Type.Literal("structure"),
  Type.Literal("characterization"),
  Type.Literal("atmosphere"),
  Type.Literal("market-position"),
]);

export const ResearchLaneSchema = Type.Union([
  Type.Literal("taste-and-voice"),
  Type.Literal("story-world"),
  Type.Literal("human-authenticity"),
  Type.Literal("reader-and-market"),
]);

export const DramaticFunctionSchema = Type.Union([
  Type.Literal("obstacle"),
  Type.Literal("false-assumption"),
  Type.Literal("hidden-capability"),
  Type.Literal("deadline"),
  Type.Literal("vulnerability"),
  Type.Literal("forensic-clue"),
  Type.Literal("procedural-constraint"),
  Type.Literal("credibility-detail"),
  Type.Literal("relationship-pressure"),
  Type.Literal("moral-choice"),
]);
```

The default taste precedence is exactly:

```ts
[
  "explicit-writer-decisions",
  "writer-samples",
  "accepted-voice-baseline",
  "approved-voice-profile",
  "influence-references",
  "genre-defaults",
]
```

Use empty valid arrays and blank strings for unknown author values. Do not invent timestamps or hashes in defaults.

- [ ] **Step 4: Register 1.3 paths in transaction validation**

`v13SchemaForPath` maps:

```text
series/taste-profile.yaml
series/voice-guardrails.yaml
series/voice-experiments/index.yaml
series/voice-experiments/VE-NNN/experiment.yaml
books/<book-id>/research-ledger.yaml
books/<book-id>/book-strategy.yaml
books/<book-id>/voice-audits.yaml
```

Modify `validateChange`:

```ts
const schema = v13SchemaForPath(change.path) ?? v12SchemaForPath(change.path) ?? schemaForPath(change.path);
```

- [ ] **Step 5: Run focused tests**

```bash
node --import tsx --test tests/v1.3-schemas.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/v1-3-schemas.ts src/domain/v1-3-schema-registry.ts src/infrastructure/transaction.ts tests/v1.3-schemas.test.ts
git commit -m "feat: add author research artifact schemas"
```

---

### Task 2: Seed new projects and books with 1.3 artifacts

**Files:**
- Modify: `src/project/templates.ts`
- Modify: `src/application/version-core.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/v1.3-compatibility.test.ts`
- Modify: `tests/v1.2-version.test.ts`

**Interfaces:**
- New projects record `novel_forge_version: 1.3.0-dev`.
- `bookTemplateFiles` creates book research, strategy, and audit files.
- `projectTemplateFiles` creates taste, guardrail, and voice-experiment index files.

- [ ] **Step 1: Write failing template and compatibility tests**

Test that a new project contains:

```text
series/taste-profile.yaml
series/voice-guardrails.yaml
series/voice-experiments/index.yaml
books/book-01/research-ledger.yaml
books/book-01/book-strategy.yaml
books/book-01/voice-audits.yaml
```

Parse each with the 1.3 schema. Test that a synthetic 1.2 project returns an older-version warning rather than a blocker.

Update the existing version test to assert `NOVEL_FORGE_VERSION === "1.3.0-dev"` and that a recorded `1.4.0` project blocks.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --import tsx --test tests/v1.2-version.test.ts tests/v1.3-compatibility.test.ts
```

Expected: failure because files and version are still 1.2.

- [ ] **Step 3: Update templates and version metadata**

Import the default functions from `v1-3-schemas.ts` and add the six files. Set package and lockfile versions consistently to `1.3.0-dev`. Set `NOVEL_FORGE_VERSION` to `1.3.0-dev` only if version parsing is extended to accept an optional `-dev` suffix; otherwise use `1.3.0` on the branch and explicitly prohibit release tagging until the final matrix passes.

Preferred implementation: keep semantic comparison numeric by storing `NOVEL_FORGE_VERSION = "1.3.0"` and use Git history, not a prerelease string, to distinguish unreleased work.

- [ ] **Step 4: Run tests**

```bash
node --import tsx --test tests/v1.2-version.test.ts tests/v1.3-compatibility.test.ts tests/project-store.test.ts tests/next-book-v1.2.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/project/templates.ts src/application/version-core.ts package.json package-lock.json tests/v1.2-version.test.ts tests/v1.3-compatibility.test.ts
git commit -m "feat: seed author research foundation files"
```

---

### Task 3: Add the guarded non-transitioning research event

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/authorization.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/prompts.ts`
- Create: `tests/research-event.test.ts`
- Modify: `tests/commands.test.ts`

**Interfaces:**
- Adds `research-update` to `NovelEventType` and Pi tool parameter union.
- Adds `research-update` to `NovelOperation`.
- Adds `researchUpdatePrompt(root: string, scope: string): string` for later guided use.

- [ ] **Step 1: Write failing event tests**

Create a project, capture its stage, gate, book state, and project hash, then apply:

```ts
applyNovelEvent(root, {
  eventType: "research-update",
  expectedStage: project.current_stage,
  expectedProjectHash: projectStateHash(root),
  scope: "taste",
  files: [{ path: "series/taste-profile.yaml", content: stringifyYaml(defaultTasteProfile()) }],
});
```

Assert:

- changed file is accepted;
- stage and next gate are unchanged;
- `BOOK.yaml` semantic content is unchanged;
- stale hashes are rejected;
- manuscript, `PROJECT.yaml`, `BOOK.yaml`, publishing, marketing, and reader-kit response paths are rejected;
- empty `research-update` events are rejected;
- research updates are allowed during pending creative gates;
- malformed YAML is rejected transactionally.

- [ ] **Step 2: Run the tests and confirm failure**

```bash
node --import tsx --test tests/research-event.test.ts tests/commands.test.ts
```

Expected: failure because the event and tool union do not exist.

- [ ] **Step 3: Implement event stages and allowlists**

Allow `research-update` during:

```ts
[
  "voice-intake",
  "series-planning",
  "book-planning",
  "chapter-queue",
  "drafting",
  "act-review",
  "revision",
  "manuscript-review",
  "canon-lock",
  "packaging",
]
```

Allow exact paths:

```text
series/taste-profile.yaml
series/voice-guardrails.yaml
series/voice-experiments/index.yaml
books/<book-id>/research-ledger.yaml
books/<book-id>/book-strategy.yaml
books/<book-id>/voice-audits.yaml
research/source-register.yaml
```

Allow bounded voice-experiment files only under:

```text
series/voice-experiments/VE-NNN/
```

with `.yaml` or `.md` extensions. Require at least one path matching a 1.3 evidence artifact or `source-register.yaml`.

The `switch` case for `research-update` performs no stage, gate, or book-state mutation.

- [ ] **Step 4: Expand planning event contracts**

`voice-profile` accepts and requires:

```text
series/voice-profile.md
series/taste-profile.yaml
series/voice-guardrails.yaml
```

`book-plan` accepts and requires:

```text
books/<book-id>/research-ledger.yaml
books/<book-id>/book-strategy.yaml
```

Update `voicePlanPrompt` and `bookPlanPrompt` to request these files while explicitly stating that empty evidence must remain empty rather than invented.

- [ ] **Step 5: Update authorization and Pi tool union**

Add `research-update` as an operation allowed at the same stages. Pending creative gates do not block this operation. Add the event literal to `novel_apply_event` parameters.

- [ ] **Step 6: Run focused tests**

```bash
node --import tsx --test tests/research-event.test.ts tests/commands.test.ts tests/pi-runtime.test.ts tests/package-smoke.test.ts
npm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/application/events.ts src/application/authorization.ts src/pi/extension.ts src/application/prompts.ts tests/research-event.test.ts tests/commands.test.ts
git commit -m "feat: add guarded research update event"
```

---

### Task 4: Add backward-compatible foundation advisories

**Files:**
- Create: `src/application/research/foundation.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/application/guide.ts`
- Create: `tests/research-foundation-status.test.ts`

**Interfaces:**
- Produces `researchFoundationFindings(root: string): Array<{ severity: "warning"; message: string; path: string }>`.
- Adds a secondary guide action only when backfill is useful; it does not interrupt the primary stage action.

- [ ] **Step 1: Write failing advisory tests**

Create a current 1.3 project and remove one new artifact: status should warn with the exact missing path.

Create a synthetic 1.2 project missing all new artifacts: status should contain advisories, not blockers, and the recommended primary action should remain stage-appropriate.

Create a 1.3 project with all artifacts: no foundation warning.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --import tsx --test tests/research-foundation-status.test.ts
```

- [ ] **Step 3: Implement warnings**

Check the six canonical artifact paths. Do not add them to the existing `required` blocker list. Add warnings after version findings.

The warning text must include a safe repair action such as:

```text
Missing optional 1.3 research foundation file: series/taste-profile.yaml. Run the guided research backfill before rebuilding voice or book planning.
```

Do not add a new blocking stage or gate.

- [ ] **Step 4: Add guide discoverability**

Add a `research` secondary action ID only when at least one foundation file is missing or when the project is in voice or book planning. In this PR the action may queue `researchUpdatePrompt`; the browser workflow is deferred.

- [ ] **Step 5: Run focused tests**

```bash
node --import tsx --test tests/research-foundation-status.test.ts tests/gate-guidance.test.ts tests/guided-command-prompts.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/application/research/foundation.ts src/application/status.ts src/application/integrity.ts src/application/guide.ts tests/research-foundation-status.test.ts
git commit -m "feat: guide research foundation backfill"
```

---

### Task 5: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Review: `docs/superpowers/specs/2026-07-15-author-taste-reader-friction-design.md`
- Review: `docs/superpowers/plans/2026-07-15-author-taste-reader-friction-roadmap.md`

- [ ] **Step 1: Document only foundation behavior**

Document:

- new empty artifacts;
- evidence-class separation;
- guarded research event;
- compatibility advisories;
- no scraping and no direct imitation;
- later PR boundaries.

Do not claim the Influence Palette wizard, clustering, or audits are already available.

- [ ] **Step 2: Run the full local verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected: all pass.

- [ ] **Step 3: Self-review the branch**

```bash
git diff --check main...HEAD
git status --short
```

Confirm:

- no manuscript fixtures were modified unintentionally;
- event allowlists contain no publishing, marketing, reader-response, manuscript, project-state, or book-state paths;
- 1.2 compatibility tests remain green;
- package tarball includes the new domain and application modules.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md SKILL.md CHANGELOG.md RELEASE.md docs/superpowers
git commit -m "docs: document author research foundation"
```

- [ ] **Step 5: Push and open a draft PR**

Open a draft PR titled:

```text
Add author taste and reader friction foundation
```

Target `main`, leave unmerged, and require the complete Node 22.19.0 and Node 24 matrix before review completion.

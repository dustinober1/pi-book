# Novel Forge 1.3 Phase 7 Release Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify the completed Novel Forge 1.3 feature set with deterministic release evaluations, clean-project and packed-extension journeys, final compatibility documentation, a green merged-main matrix, and an annotated `v1.3.0` release tag.

**Architecture:** Keep the existing architecture fixtures and add a second deterministic release-evaluation layer that calls the canonical 1.3 services directly. Add one clean-project acceptance journey that exercises the public application boundaries without fabricating human evidence, and strengthen the packed-extension smoke test so the release artifact proves command registration, wizard assets, project initialization, and guided action loading. Merge the release PR only after both Node jobs pass; then verify merged `main`, create the release tag on that exact commit, and perform a tag-based package smoke workflow.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, Node test runner, TypeBox/YAML, existing Novel Forge application services, npm pack/install, Pi extension registration boundary, GitHub Actions, Git tags/releases.

## Global Constraints

- Version target remains exactly `1.3.0`.
- Work only on `agent/v1.3-phase7-release` until the release PR is merged.
- Do not add a new creative stage, runtime dependency, remote service, scraper, telemetry, analytics, or hosted database.
- `/novel` remains the primary author interface.
- Public market observations never become human reader evidence for the current manuscript.
- Named influence references never enter drafting context or anonymous variant labels.
- Evaluation results are deterministic contract evidence, not claims of objective literary quality.
- No evaluation may invent approvals, human responses, source provenance, manuscript prose, or release evidence.
- Every project mutation used by acceptance tests must pass through existing guarded application boundaries.
- Existing 1.2 projects remain readable without mandatory migration.
- Package metadata remains synchronized at `1.3.0` without dependency re-resolution.
- Do not create `v1.3.0` until the release PR is merged and the exact merged `main` commit passes Node 22.19.0 and Node 24.
- The final release diff must contain no temporary workflow, helper script, generated diagnostics, uploaded source, imported review corpus, generated manuscript, packed tarball, or test project.
- Use TDD and verify RED before production implementation.

---

### Task 1: Add deterministic 1.3 release evaluation fixtures

**Files:**
- Create: `src/evaluation/v1-3-release.ts`
- Create: `tests/v1-3-release-evaluation.test.ts`
- Create: `evals/v1-3-release/influence-translation.yaml`
- Create: `evals/v1-3-release/writer-sample-precedence.yaml`
- Create: `evals/v1-3-release/one-star-noise.yaml`
- Create: `evals/v1-3-release/praise-complaint-pairing.yaml`
- Create: `evals/v1-3-release/intentional-tradeoff.yaml`
- Create: `evals/v1-3-release/voice-drift.yaml`
- Create: `evals/v1-3-release/scene-diversity.yaml`
- Create: `evals/v1-3-release/agency-tracking.yaml`
- Create: `evals/v1-3-release/guardrail-promotion.yaml`
- Modify: `scripts/evaluate-fixtures.ts`
- Modify: `evals/README.md`

**Interfaces:**

```ts
export type ReleaseEvaluationKind =
  | "influence-translation"
  | "writer-sample-precedence"
  | "one-star-noise"
  | "praise-complaint-pairing"
  | "intentional-tradeoff"
  | "voice-drift"
  | "scene-diversity"
  | "agency-tracking"
  | "guardrail-promotion";

export interface ReleaseEvaluationFixture {
  schema_version: "1.0.0";
  id: string;
  kind: ReleaseEvaluationKind;
  input: unknown;
  expected: unknown;
}

export interface ReleaseEvaluationResult {
  id: string;
  kind: ReleaseEvaluationKind;
  passed: boolean;
  evidence: string[];
  failures: string[];
}

export function evaluateV13ReleaseFixture(fixture: ReleaseEvaluationFixture): ReleaseEvaluationResult;
export function loadV13ReleaseFixtures(root: string): ReleaseEvaluationFixture[];
```

- [ ] **Step 1: Write failing unit tests for all nine evaluation kinds**

The tests must assert:

- influence translation accepts neutral traits and rejects direct imitation language;
- writer-sample rules suppress conflicting influence/default rules;
- one-star-only clusters never exceed moderate confidence;
- complaint clusters preserve matching praise as positive counterweights;
- accepted tradeoffs remain visible and do not become prevent/mitigate guardrails;
- voice drift reports numeric evidence without automatic severity;
- more than two consecutive identical scene engines produce a deterministic finding;
- agency tracking requires immediate gain, deferred cost, irreversible effect, and a valid payoff window;
- guardrail promotion is ineligible below threshold and eligible at exactly three chapters or two milestone reviews.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
node --import tsx --test tests/v1-3-release-evaluation.test.ts
```

Expected: FAIL because `src/evaluation/v1-3-release.ts` does not exist.

- [ ] **Step 3: Implement fixture loading and canonical-service evaluation**

Use existing services rather than copying policy:

- `compileVoiceGuardrails` and `voiceSafetyFindings`;
- `buildReviewCluster`, `maximumClusterConfidence`, and `readerFrictionFindings`;
- `bookPlanFindings` / Phase 4 strategy validation;
- `extractVoiceMetrics` and voice-audit comparison helpers;
- `sceneAuditFindings`;
- `revisionLearningCandidates` and `revisionLearningFindings`.

The evaluator must return explicit evidence strings and failures. It must not mutate a project or read network resources.

- [ ] **Step 4: Create nine complete YAML fixtures**

Each fixture contains only the minimum typed inputs required by its canonical service and exact expected evidence. No placeholder prose, invented public-review corpus, author imitation request, or simulated reader response is allowed.

- [ ] **Step 5: Extend `npm run eval`**

Keep the current four architecture fixtures unchanged. After the architecture summary, load `evals/v1-3-release/*.yaml`, evaluate all nine fixtures, print one PASS/FAIL line per fixture, and set a nonzero exit code for any failure.

- [ ] **Step 6: Run focused and complete evaluations**

```bash
node --import tsx --test tests/v1-3-release-evaluation.test.ts
npm run eval
```

Expected: all nine release fixtures and all existing architecture fixtures pass.

---

### Task 2: Add the clean-project 1.3 acceptance journey

**Files:**
- Create: `tests/e2e/v1-3-release-journey.test.ts`
- Create: `src/evaluation/v1-3-journey.ts`
- Test: `tests/project-store.test.ts`
- Test: `tests/research-wizard.test.ts`
- Test: `tests/package-smoke.test.ts`

**Interfaces:**

```ts
export interface V13JourneyReport {
  projectRoot: string;
  initializedVersion: string;
  completedChecks: string[];
  skippedChecks: Array<{ id: string; reason: string }>;
  invariantFailures: string[];
}

export function runV13CleanProjectJourney(parent: string): Promise<V13JourneyReport>;
```

- [ ] **Step 1: Write a failing end-to-end journey test**

The journey must create a clean standalone thriller project and exercise:

1. `/novel-start` equivalent initialization;
2. sanitized research-wizard snapshot;
3. influence preview and guarded save;
4. planned voice experiment save without fabricated variants;
5. planned/researching research item save;
6. public-review CSV preview with identity removal, without claiming human manuscript testing;
7. book-strategy and graph/context service loading from valid project state;
8. no-baseline voice-audit diagnostic;
9. packaging checklist loading;
10. next-book proposal correctly refusing creation before canon lock.

The report must confirm stage/gates/manuscript remain unchanged by evidence-only actions. Capabilities requiring genuine writer-selected prose, real reader responses, a DOCX source, approved manuscript, or locked canon must be listed as explicit skipped checks with reasons rather than fabricated.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/e2e/v1-3-release-journey.test.ts
```

Expected: FAIL because the journey service does not exist.

- [ ] **Step 3: Implement the journey using public application boundaries**

Use `initializeProject`, wizard registry/handler previews and applies, `applyNovelEvent`, status/guide services, context services, voice-audit diagnostic service, packaging checklist, and next-book proposal service. Do not write canonical state directly except where the normal initialization API creates templates.

- [ ] **Step 4: Assert compatibility and non-mutation invariants**

The final report must verify:

- `novel_forge_version` is `1.3.0`;
- stage, gates, approvals, active book, and manuscript bytes are unchanged by `research-update` actions;
- public review observations do not change reader metrics;
- no raw influence reference enters chapter context;
- no generated manuscript or package outputs remain in the test project.

- [ ] **Step 5: Run the focused journey and existing boundary regressions**

```bash
node --import tsx --test tests/e2e/v1-3-release-journey.test.ts tests/project-store.test.ts tests/research-wizard.test.ts tests/package-smoke.test.ts
```

Expected: all pass.

---

### Task 3: Strengthen packed-extension and install smoke coverage

**Files:**
- Modify: `tests/package-smoke.test.ts`
- Create: `tests/e2e/packed-clean-start.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing package assertions**

Prove the tarball contains:

- all 1.3 schema and application modules;
- the research wizard handler and bundled HTML/JS/CSS;
- the release evaluation module;
- README, SKILL, CHANGELOG, and RELEASE;
- no `evals/`, tests, temporary workflows, diagnostics, or generated project output.

- [ ] **Step 2: Write a failing packed clean-start test**

Pack and extract the extension, install production dependencies, import the extension, register commands/tools, initialize a project through the packed source modules, and load the `/novel` guide. Assert `novel-wizard` exposes `research`, the project version is `1.3.0`, and the primary action is not replaced by research.

- [ ] **Step 3: Verify RED**

```bash
node --import tsx --test tests/package-smoke.test.ts tests/e2e/packed-clean-start.test.ts
```

Expected: FAIL until the release evaluation module and package assertions are available.

- [ ] **Step 4: Implement the minimal package metadata/test changes**

Do not add test/eval content to the published `files` list. Keep `package.json` and root lockfile version at `1.3.0`. Add only a deterministic `test:release` script if useful; do not re-resolve dependencies.

- [ ] **Step 5: Run package smoke tests**

```bash
node --import tsx --test tests/package-smoke.test.ts tests/e2e/packed-clean-start.test.ts
npm pack --dry-run
```

Expected: PASS and no forbidden paths in the tarball listing.

---

### Task 4: Finalize release documentation and machine-checkable checklist

**Files:**
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Modify: `evals/README.md`
- Create: `docs/releases/v1.3.0.md`
- Create: `scripts/verify-v1-3-release.ts`
- Create: `tests/v1-3-release-checklist.test.ts`
- Modify: `package.json`

**Interfaces:**

```ts
export interface ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export function verifyV13ReleaseTree(root: string): ReleaseCheck[];
```

- [ ] **Step 1: Write failing checklist tests**

The verifier must check package/lock version synchronization, expected source/docs/assets, absence of duplicate release checklist lines, absence of temporary/generated files, package file allowlist, nine release fixtures, and required release-note boundaries: compatibility, non-scraping, human-evidence separation, originality, local-only browser, no automatic approvals, and installation command.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/v1-3-release-checklist.test.ts
```

Expected: FAIL because the verifier and release notes do not exist.

- [ ] **Step 3: Implement tree verification**

The verifier is read-only and deterministic. It must return all findings instead of stopping at the first failure. Add `npm run verify:release` to print every check and exit nonzero on failure.

- [ ] **Step 4: Update documentation**

- remove duplicate checklist entries;
- mark completed 1.3 contract checks only where automated tests or the release verifier supply evidence;
- state that literary quality still requires human editorial and reader judgment;
- document that the package does not scrape platforms or turn public reviews into manuscript validation;
- document clean installation and the local research wizard;
- add `docs/releases/v1.3.0.md` with compatibility, safety, evaluation, install, and upgrade notes.

- [ ] **Step 5: Run documentation/checklist verification**

```bash
node --import tsx --test tests/v1-3-release-checklist.test.ts
npm run verify:release
```

Expected: all checks pass.

---

### Task 5: Verify, merge, and qualify merged main

**Files:**
- No new production files beyond Tasks 1–4.
- GitHub PR and Actions records.

- [ ] **Step 1: Run the complete branch matrix**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass.

- [ ] **Step 2: Review final diff**

Confirm no temporary workflow, helper script, marker, diagnostics, generated project, imported review corpus, voice experiment output, or tarball is present. Resolve all review threads.

- [ ] **Step 3: Merge with exact head protection**

Mark the PR ready only after the exact head is green. Merge using the tested head SHA.

- [ ] **Step 4: Verify merged `main`**

Use the repository's authoritative `Novel Forge tests` workflow on the merge commit. Do not tag if either Node job is absent, skipped, cancelled, or failed.

---

### Task 6: Create and smoke-test the `v1.3.0` release

**Files:**
- Git annotated tag: `v1.3.0`
- GitHub release notes based on `docs/releases/v1.3.0.md`
- Temporary release-smoke workflow only if required; it must remove itself or live solely in the release PR if retained as a reusable manual workflow.

- [ ] **Step 1: Confirm tag absence and exact release commit**

The tag must not already exist. Its target must be the fully green merged-main commit from Task 5.

- [ ] **Step 2: Create annotated tag and release**

Tag: `v1.3.0`

Title: `Novel Forge 1.3.0 — Author Taste and Research Foundation`

Release notes must come from the committed release document and identify the verified main commit and Actions run.

- [ ] **Step 3: Run tag-based clean package smoke**

Check out `v1.3.0` in GitHub Actions, run:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Then pack/extract/install and run the packed clean-start test against the tag.

- [ ] **Step 4: Verify the published tag**

Confirm `package.json`, `package-lock.json`, generated project metadata, README installation command, and release notes all report `1.3.0`.

- [ ] **Step 5: Record release completion**

Update the roadmap/release checklist only if a follow-up documentation commit is required. Do not move the release tag after publication. If any post-tag defect is found, use a new patch version rather than rewriting `v1.3.0`.

# Constrained Runtime Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add constrained local-inference support for small models and CPU-limited environments while preserving Novel Forge's deterministic project state, guarded events, validation, project-hash protection, continuity safeguards, human gates, and manuscript-quality controls.

**Architecture:** Introduce runtime policy as a backward-compatible, non-canonical execution concern layered over the existing typed application services. Shared stage specifications, runtime-aware deterministic context selection, validated workflow IR, bounded repair, and restricted event patches reduce inference load without making prompts, caches, telemetry, adapters, or generated summaries authoritative. The existing transaction, schema, reference, project-hash, stage, allowlist, status, handoff, and Git-checkpoint boundaries remain final authority.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, ESM/NodeNext, Node test runner, TypeBox, YAML, built-in `fetch`, Node standard library, existing Novel Forge project store, transaction layer, continuity graph, evaluation fixtures, Pi extension, and GitHub Actions.

## Global Constraints

- GitHub repository `dustinober1/pi-book` is the sole source of truth.
- Verified implementation base: branch `main`, commit `14f2e1421121ed4947232463a5d0399da598d480`.
- Implement through focused pull requests; never commit directly to `main`.
- Use test-driven development for every meaningful behavior: failing test, expected failure, minimal implementation, narrow pass, relevant group pass, commit.
- Preserve local YAML and Markdown state, current stage, project hashes, event allowlists, required outputs, schemas, graph safety, canon protections, accepted-mutation regeneration, and Git checkpoints as authoritative.
- Existing projects without runtime fields resolve to `full` and continue to load.
- Runtime profile precedence is explicit run option, project runtime configuration, existing local configuration when introduced, then `full`.
- Unknown runtime profiles fail deterministically; they never silently fall back.
- Runtime capabilities remain separate from runtime policy.
- Add no required production dependency unless repository evidence proves the standard library and current dependencies are insufficient.
- Never write raw prompts, chapter prose, model outputs, private research notes, credentials, or influence evidence into telemetry by default.
- Structured IR applies only to machine-oriented workflow artifacts; creative prose remains freeform and validator-controlled.
- Do not add GraphRAG, vector retrieval, embeddings, graph databases, browser/mobile inference, native inference libraries, arbitrary model diffs, or freeform chapter-prose patching.
- Do not weaken existing tests, schemas, reference checks, event atomicity, or human gates to accommodate small models.
- Every PR must pass the repository's exact available gates before merge: `npm ci`, `npm run typecheck`, `npm test`, `npm run eval`, `npm run verify:release`, and `npm pack --dry-run` where applicable.

---

## Verified Start State

### Repository and branch

- Repository: `dustinober1/pi-book`
- Verified default branch: `main`; `master` does not exist.
- Verified baseline snapshot: `14f2e1421121ed4947232463a5d0399da598d480`.
- Working branch for PR 1: `feat/constrained-runtime-foundation`.
- GitHub branch creation succeeded from the exact baseline commit.
- GitHub metadata endpoints for open pull requests and recent commits returned upstream `502` errors during start-state verification. Before opening or merging PR 1, repeat both checks and record the result in the PR description. Do not infer that no overlapping work exists.

### Package and CI

- Package: `novel-forge-for-pi`, version `1.3.0`, ESM, TypeScript-first.
- TypeScript configuration: ES2022, NodeNext, strict mode, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.
- Existing CI workflow: `.github/workflows/test.yml`.
- Existing CI matrix: Node `22.19.0` and Node `24`.
- Existing full gates: install, typecheck, test, evaluation, release verification, and package dry run.
- Existing package files allowlist includes `src/`, `scripts/`, `README.md`, `SKILL.md`, `CHANGELOG.md`, `RELEASE.md`, profiles, references, extensions, wizard, and agents. The final release PR must confirm any new documentation or fixtures required in the package are intentionally included or intentionally repository-only.

### Baseline command record

The baseline must be run before production behavior changes. Record exact command output, exit code, test counts, evaluation counts, package contents, and wall-clock duration as informational evidence:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

If the implementation environment cannot execute the repository locally, use the unchanged baseline branch's GitHub Actions run as the evidence source. Download and inspect the uploaded `typecheck.log` and `test.log`; do not treat a missing CI result as a pass.

---

## Verified Current Architecture

### Runtime and command flow

- `src/pi/arguments.ts` parses `/novel-run` options, including chapter bounds, stop target, resume, pause, cancel, no-prose, review-only, and warning behavior.
- `src/pi/extension.ts` registers `/novel-start`, `/novel-run`, `/novel-draft`, `/novel-revise`, and the guarded `novel_apply_event` tool.
- `src/application/run.ts` decides the next stage action, resolves the current chapter-run count, selects up to three revision tickets, builds drafting context, and starts or resumes persistent runs.
- `src/application/automation-run.ts` owns persistent run state, creative-state hashes, completed event keys, retry counts, and stop reasons.
- `src/domain/v1-4-schemas.ts` validates the active automation-run record.

### Project configuration and migration behavior

- `src/domain/schemas.ts` owns `ProjectSchema`; its `automation` object currently contains `max_chapters_per_run`, `require_first_chapter_approval`, and `git_checkpoints`.
- `src/domain/v1-4-project-schema.ts` preserves the base project schema while typing `automation.active_run`.
- `src/project/templates.ts` creates new projects with a three-chapter automation default and injects `active_run: null`.
- `src/project/store.ts` loads project state through the typed schema.
- Existing version compatibility treats newly introduced evidence fields as optional until the explicit workflow writes them. Runtime configuration must follow the same compatibility rule.

### Prompts

- `src/application/prompts.ts` currently contains stage-specific template strings and event rules in one module.
- Normative rules are repeated across prompt functions, so PR 2 must extract them into a single declarative source before compact rendering.
- PR 1 must not rewrite prompt wording except for active-profile visibility needed to diagnose execution policy.

### Drafting context and graph selection

- `src/context/context-builder.ts` currently defaults to `72_000` context characters, uses section-level caps, estimates tokens as `ceil(chars / 4)`, and records included/excluded categories.
- `src/context/story-graph.ts` builds a deterministic in-memory graph and already supports `resolveDraftingGraphContext(..., { maxDepth: 1 | 2 })`.
- Graph selection blocks provisional facts/relationships, future-book facts, inactive threads, and unready research. Explicit unsafe records cannot bridge to extra context.
- PR 1 can pass runtime graph depth through the existing safe resolver; it must not redesign traversal.

### Events, validation, hashing, and transactions

- `src/application/events.ts` owns guarded event application and project-state hash checks at the public mutation boundary.
- `src/application/project-hash.ts` hashes normalized project/book state and guarded evidence; its creative hash excludes active-run bookkeeping only.
- `src/infrastructure/transaction.ts` stages changes, validates YAML through existing schema registries, applies atomically with backups, rolls back on failure, and optionally checkpoints Git.
- `src/application/event-rejection.ts` already provides structured rejection categories and a one-corrected-resubmission policy for schema/reference failures.
- Later repair and patch phases must compose with these boundaries instead of replacing them.

### Tests and evaluation

- Existing focused tests include `tests/run-options.test.ts`, `tests/automation-command.test.ts`, `tests/automation-run.test.ts`, `tests/pi-runtime.test.ts`, `tests/project-store.test.ts`, `tests/schema.test.ts`, `tests/story-graph.test.ts`, `tests/phase4-context.test.ts`, `tests/event-application.test.ts`, `tests/transaction.test.ts`, `tests/v1-4-compatibility.test.ts`, and package/release tests.
- Existing synthetic architecture fixtures cover thriller standalone, thriller series, romantasy standalone, and romantasy series.
- Existing author-journey fixtures include chapter and revision workflows and must remain separate from privacy-safe constrained-runtime metrics.

---

## Final Repository File Map

| Concern | Current file(s) | Planned file(s) | Reason |
|---|---|---|---|
| Runtime profile contract | `src/domain/schemas.ts` project automation fields | `src/domain/runtime-profile.ts`; minimal optional runtime field in `src/domain/schemas.ts` | Keep execution policy typed and separate from genre profile |
| Runtime profile resolution | `src/application/run.ts`; `src/pi/arguments.ts` | `src/application/runtime-profile-resolver.ts`; modifications to existing run and argument files | Central precedence, validation, and micro-step limits |
| Run telemetry | No run-report store | `src/domain/run-report.ts`; `src/application/run-telemetry.ts`; `src/infrastructure/run-report-store.ts` | Privacy-safe deterministic diagnostics and atomic local reports |
| Benchmark harness | `scripts/evaluate-fixtures.ts`; `evals/*` | `src/evaluation/constrained-runtime.ts`; `scripts/benchmark-constrained-runtime.ts`; `evals/constrained-runtime/*` when needed | Reuse synthetic fixtures and record deterministic size metrics |
| Stage prompts | `src/application/prompts.ts` | `src/application/prompt-compiler.ts`; `src/application/stage-specs/*.ts`; thin compatibility exports in `prompts.ts` | One normative `StageSpec` source for standard and compact prompts |
| Context builder | `src/context/context-builder.ts` | `src/context/context-builder.ts`; `src/context/context-report.ts`; `src/context/context-distiller.ts`; `src/context/distillers/*.ts`; `src/context/section-policies.ts` | Runtime-aware deterministic compaction and complete reporting |
| Graph traversal | `src/context/story-graph.ts` | Minimal option threading only | Preserve existing safe traversal and blocked-record semantics |
| Context cache | No deterministic cache | `src/infrastructure/context-cache.ts` | Hash-keyed cache of deterministic, non-authoritative products |
| Workflow IR | Existing canonical TypeBox schemas in `src/domain/*.ts` | `src/domain/stage-ir/*.ts`; `src/application/structured-output-parser.ts` | Validate model output before deterministic rendering |
| Deterministic renderers | Existing YAML utility and direct prompt output | `src/application/renderers/*.ts` | Stable canonical YAML/Markdown from validated IR |
| Preflight and repair | Stage checks across `run.ts`, `events.ts`, `event-rejection.ts` | `src/application/preflight.ts`; `src/application/repair.ts`; focused integration in run/event flow | Block impossible inference and bound repair scope |
| Event application | `src/application/events.ts`; `src/infrastructure/transaction.ts` | `src/domain/patch-operation.ts`; `src/application/event-patches.ts`; minimal event integration | Apply restricted patches to an overlay, then reuse full validation/transaction |
| Validation | Schema registries, integrity, profile validators, reference checks | Minimal modifications only | Existing validators remain final authority |
| Project hash | `src/application/project-hash.ts`; event checks | No semantic weakening; cache keys may consume hashes | Preserve stale-run protection and project separation |
| Runtime adapters | Pi-mediated operation only | `src/application/runtime-adapters/runtime-adapter.ts`; `openai-compatible.ts`; `ollama.ts`; `adapter-registry.ts`; `errors.ts` | Thin isolated HTTP backends using built-in `fetch` |
| Runtime options | `src/application/run.ts`; `src/pi/arguments.ts`; `src/pi/extension.ts` | Modify those files; add resolver module | Explicit option overrides project configuration |
| Project defaults | `src/project/templates.ts` | Modify optional template inputs and generated runtime config | New projects can record profile; old projects remain valid |
| Migrations/compatibility | `src/domain/schemas.ts`; version compatibility tests; Genesis migration | Optional schema/default resolution; compatibility tests; no content-manufacturing migration | Existing projects load as `full` without manual edits |
| Tests | Existing `tests/*.test.ts` and `tests/e2e/*.test.ts` | Focused files named in each PR below | TDD and isolated regression evidence |
| Evals | Four genre/project fixtures, author journeys, release fixtures | Constrained-runtime benchmark fixtures/report | Measure size, retention, validation, changed bytes, and repairs |
| CI | `.github/workflows/test.yml` | Extend focused profile matrix, prompt budgets, IR goldens, cache, adapters, performance-size report | Stable deterministic CI without wall-clock flakiness |
| Docs | `README.md`, `SKILL.md`, `CHANGELOG.md`, `RELEASE.md` | Update existing docs plus final benchmark/release record | User-facing operation and migration clarity |
| Local generated data | `.gitignore` lacks `.pi-book` entries | Add `.pi-book/runs/`, `.pi-book/cache/`, benchmark temp output | Keep diagnostics and cache outside canonical/package state |

---

## Locked Public Contracts

### Runtime policy

```ts
export type RuntimeProfileId = "tiny-local" | "local" | "full";
export type PromptStyle = "compact" | "standard";

export interface RuntimeProfile {
  id: RuntimeProfileId;
  maxContextChars: number;
  maxPromptChars: number;
  graphDepth: 1 | 2;
  promptStyle: PromptStyle;
  maxArtifactsPerStage: number | null;
  maxChaptersPerRun: number | null;
  maxRevisionTickets: number | null;
  preferStructuredIR: boolean;
  maxRepairAttempts: number;
  stopOnContextWarning: boolean;
}
```

Built-ins use the exact program values: `tiny-local` 12,000/6,000/depth 1/one artifact/chapter/ticket; `local` 24,000/10,000/depth 2/two artifacts/one chapter/two tickets; `full` 72,000/24,000/depth 2/unbounded stage limits. `full` preserves current behavior by resolving unbounded values through existing project automation limits and current stage behavior.

### Runtime capability report

```ts
export interface RuntimeCapabilities {
  grammar: boolean;
  jsonSchema: boolean;
  streaming: boolean;
  maxContextTokens?: number;
}
```

Capabilities belong to adapters and never alter canonical state.

### Stage specification

```ts
export interface StageSpec {
  id: string;
  role: string;
  objective: string;
  must: readonly string[];
  avoid: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  validation: readonly string[];
  toolRules: readonly string[];
}
```

### Context and telemetry

Use the exact `ContextSectionStatus`, `ContextSectionReport`, `ContextBuildReport`, `RunMetric`, and `RunReport` contracts in the mission. Keep `schemaVersion: "1.0.0"`, exact project hashes, character counts, stable token estimates, changed counts, repair counts, validation categories, and timing/memory metrics. Do not add prompt or prose fields.

### Patch and adapter contracts

Use the exact `PatchOp`, `RuntimeAdapter`, `OpenAICompatibleAdapterConfig`, and `OllamaAdapterConfig` conceptual contracts in the mission. Repository naming may add `Schema` suffixes for TypeBox validators but must not change operation semantics.

---

## Dependency Graph

```text
PR 1 runtime profiles + telemetry + baseline benchmark
  ├── PR 2 shared StageSpec + prompt compiler + prompt budgets
  ├── PR 3 context distillation + reports + deterministic cache
  │     └── PR 4 structured IR + deterministic renderers
  │           └── PR 5 preflight + targeted bounded repairs
  │                 └── PR 6 restricted event patches
  └── PR 7 runtime adapters

PRs 1–7
  └── PR 8 benchmark sweep + CI + docs + migration + release hardening
```

PR 2 depends on profile prompt style and budgets. PR 3 depends on profile context budget and graph depth. PR 4 depends on profile preference for structured IR but does not depend on adapters. PR 5 depends on context reports and IR issue paths. PR 6 depends on preflight allowed paths and existing event transactions. PR 7 depends only on profile/capability interfaces and can be developed after PR 1, but remains seventh in merge order to keep the required sequence. PR 8 depends on every prior public behavior.

---

## Pull Request 1 — Constrained Runtime Foundation

**Branch:** `feat/constrained-runtime-foundation`

**Title:** `Add constrained runtime profiles and baseline telemetry`

**Scope:** Runtime contracts, resolution, optional project configuration, explicit command option, persistent-run profile capture, micro-step normalization, active-profile visibility, privacy-safe run reports, synthetic baseline benchmark, local-state ignore rules. Do not rewrite stage prompts or add context distillation.

### Task 1.1: Capture baseline evidence

**Files:**
- Create: `docs/benchmarks/constrained-runtime-baseline.md`
- Do not modify production behavior.

- [ ] Run the full baseline command set from the verified commit.
- [ ] Record Node version, exact exit codes, test/evaluation counts, package file summary, and command durations.
- [ ] Record open PR and recent commit checks after GitHub metadata recovers.
- [ ] Commit only the evidence file with `test: capture baseline constrained runtime metrics`.

### Task 1.2: Add runtime profile contracts and resolver

**Files:**
- Create: `src/domain/runtime-profile.ts`
- Create: `src/application/runtime-profile-resolver.ts`
- Create: `tests/runtime-profiles.test.ts`

**Produces:**

```ts
export const RUNTIME_PROFILES: Readonly<Record<RuntimeProfileId, RuntimeProfile>>;
export function parseRuntimeProfileId(value: unknown): RuntimeProfileId;
export function resolveRuntimeProfile(input: {
  explicit?: string;
  project?: string;
  local?: string;
}): RuntimeProfile;
export function applyRuntimeLimits(input: {
  profile: RuntimeProfile;
  projectMaxChapters: number;
  requestedMaxChapters?: number;
  availableArtifacts?: number;
  availableRevisionTickets?: number;
}): {
  maxChapters: number;
  maxArtifacts: number | null;
  maxRevisionTickets: number | null;
  graphDepth: 1 | 2;
};
```

- [ ] Write tests for default `full`, explicit precedence, project precedence, local precedence, unknown ID failure, exact built-in values, tiny/local caps, and full preservation.
- [ ] Run `node --import tsx --test tests/runtime-profiles.test.ts` and confirm failure because the modules do not exist.
- [ ] Implement the contracts and pure resolver with no filesystem access.
- [ ] Run the narrow test and confirm all cases pass.
- [ ] Run `npm run typecheck` and the runtime-profile test.
- [ ] Commit `feat: add runtime profile resolution`.

### Task 1.3: Add backward-compatible project runtime configuration

**Files:**
- Modify: `src/domain/schemas.ts`
- Modify: `src/project/templates.ts`
- Modify: `src/domain/v1-4-schemas.ts`
- Modify: `src/domain/v1-4-project-schema.ts` only if typing requires it
- Create: `tests/runtime-profile-compatibility.test.ts`

**Behavior:**

```ts
runtime?: {
  profile?: RuntimeProfileId;
  telemetry?: boolean;
}
```

`AutomationRunStateSchema` receives optional `runtimeProfile`. Existing project and active-run documents remain valid. New projects write `runtime.profile: full` and `runtime.telemetry: true`; template options may override the profile. A metadata-only upgrade does not manufacture runtime telemetry or change creative state.

- [ ] Write tests that load a pre-runtime project, create a new default project, create a tiny-local project, reject an invalid stored profile, and load a pre-runtime active run.
- [ ] Confirm the focused tests fail for the expected schema/template reasons.
- [ ] Add the optional schema and defaults.
- [ ] Confirm the focused tests pass and run existing schema, store, template, and compatibility groups.
- [ ] Commit `feat: add backward-compatible runtime configuration`.

### Task 1.4: Parse and display runtime options

**Files:**
- Modify: `src/application/run.ts`
- Modify: `src/pi/arguments.ts`
- Modify: `src/pi/extension.ts`
- Modify: `src/application/status.ts`
- Modify: `tests/run-options.test.ts`
- Modify: `tests/automation-command.test.ts`
- Create: `tests/runtime-profile-visibility.test.ts`

**Behavior:**

- `/novel-run --runtime-profile tiny-local|local|full` sets the explicit execution profile.
- `/novel-start --runtime-profile ...` records the requested project default.
- Unknown values produce a clear deterministic error.
- `RunDecision` includes a resolved runtime profile ID as data, not only prose.
- Status and command notifications show the active profile without changing genre-profile labels.
- Runtime-control flags retain their current mutual-exclusion behavior.

- [ ] Extend parsing tests first and confirm failure.
- [ ] Implement parsing and command threading.
- [ ] Add visibility tests and confirm failure before updating status/run decisions.
- [ ] Implement active-profile diagnostics.
- [ ] Run focused parser, command, status, and Pi-boundary tests.
- [ ] Commit `feat: expose the active runtime profile`.

### Task 1.5: Enforce micro-step limits

**Files:**
- Modify: `src/application/run.ts`
- Modify: `src/application/automation-run.ts`
- Modify: `src/context/context-builder.ts`
- Modify: `src/pi/extension.ts`
- Create: `tests/runtime-micro-steps.test.ts`
- Modify: `tests/automation-run.test.ts`
- Modify: `tests/phase4-context.test.ts`
- Modify: `tests/story-graph.test.ts` only for option-threading regression coverage

**Behavior:**

- `tiny-local` caps chapters, revision tickets, and stage artifacts at one and passes graph depth one.
- `local` caps chapters at one, revision tickets/artifacts at two, and passes graph depth two.
- `full` preserves existing project chapter limits and existing revision behavior.
- An explicit larger chapter count is normalized downward by the profile, not stored as an impossible request.
- A persistent run stores the resolved runtime profile and normalized chapter budget so resume behavior is stable.
- `tiny-local` treats context warnings as stop conditions by default; an explicit stricter stop option remains honored for all profiles.
- PR 1 threads `maxContextChars` and graph depth into the existing context builder but does not change section rendering or omission rules.

- [ ] Write drafting, revision, persistent-run, and graph-depth tests and confirm expected failures.
- [ ] Implement the smallest limit-threading changes.
- [ ] Run focused tests, then existing automation, context, graph, and run tests.
- [ ] Commit `feat: enforce runtime micro-step limits`.

### Task 1.6: Add privacy-safe telemetry and atomic report storage

**Files:**
- Create: `src/domain/run-report.ts`
- Create: `src/application/run-telemetry.ts`
- Create: `src/infrastructure/run-report-store.ts`
- Create: `tests/run-telemetry.test.ts`
- Modify: `.gitignore`

**Behavior:**

- Reports use the exact locked `RunReport` schema.
- The stable token estimate is `Math.ceil(characterCount / 4)` until the repository introduces a stronger existing estimator.
- Report writes use a sibling temporary file plus atomic rename.
- Default location is `.pi-book/runs/<run-id>/run-report.json`.
- Telemetry can be disabled by project runtime configuration or explicit run option.
- Report builders accept counts, hashes, paths, IDs, categories, and metrics only.
- Tests inject unique sample prose, prompt text, output text, and a fake credential into surrounding execution data and prove none appears in serialized telemetry or error text.
- A report-write failure does not mutate project state and returns a sanitized diagnostic.

- [ ] Write schema, atomic-write, opt-out, gitignore, sanitization, and write-failure tests and confirm failure.
- [ ] Implement report contracts, sanitizing builder, and store.
- [ ] Run focused telemetry tests and transaction/project-hash regression tests.
- [ ] Commit `feat: record privacy-safe run telemetry`.

### Task 1.7: Add deterministic constrained benchmark harness

**Files:**
- Create: `src/evaluation/constrained-runtime.ts`
- Create: `scripts/benchmark-constrained-runtime.ts`
- Create: `tests/constrained-runtime-benchmark.test.ts`
- Modify: `package.json`
- Create: `evals/constrained-runtime/README.md` only when fixture provenance needs explanation

**Scenarios:**

1. Thriller standalone planning fixture
2. Thriller series planning fixture
3. Romantasy standalone planning fixture
4. Romantasy series planning fixture
5. Synthetic drafting-context fixture
6. Synthetic revision-ticket fixture

**Output fields:** scenario, runtime profile, prompt characters, context characters, estimated input tokens, stage success, validation result, files changed, bytes changed, informational duration, and peak RSS when practical. The harness never stores raw fixture prose in reports and does not fail CI on wall-clock values.

- [ ] Write tests for deterministic scenario ordering, all six scenarios, stable size/count fields, successful validation, and absence of raw prose in JSON output.
- [ ] Confirm the benchmark test fails because the evaluator does not exist.
- [ ] Implement the pure evaluator and CLI script.
- [ ] Add `benchmark:constrained-runtime` to `package.json`.
- [ ] Run the focused benchmark test twice and compare deterministic fields.
- [ ] Run `npm run benchmark:constrained-runtime` and record output in the PR.
- [ ] Commit `test: add constrained runtime benchmark matrix`.

### Task 1.8: PR 1 verification and review

- [ ] Repeat open-PR and recent-commit overlap checks.
- [ ] Run all exact gates.
- [ ] Review branch diff for prompt rewrites, validation weakening, raw prose logging, dependencies, and package leakage.
- [ ] Create PR with summary, architecture, exact test commands/results, metrics, risk review, and scope confirmation.
- [ ] Inspect CI on Node 22.19.0 and Node 24.
- [ ] Merge only after every available required gate passes and no unresolved overlap exists.

---

## Pull Request 2 — Declarative Compact Prompt Compiler

**Branch:** `feat/compact-prompt-compiler`

**Title:** `Compile compact and standard prompts from shared stage specs`

### Deliverables

- Create `src/application/stage-specs/` with one verified spec per active stage.
- Create `src/application/prompt-compiler.ts` with standard and compact renderers.
- Keep `src/application/prompts.ts` as the compatibility-facing composition layer.
- Render compact sections in the exact order ROLE, OBJECTIVE, INPUTS, MUST, NEVER, OUTPUT, VALIDATE, TOOL RULES.
- Measure and enforce `maxPromptChars` before inference; never truncate normative rules.
- Emit a prompt-budget error containing stage, profile, actual chars, maximum chars, and largest rendered sections.
- Snapshot current normative requirements before refactoring and prove the standard renderer retains them.
- Add semantic parity tests that compare normalized normative entries, not only brittle full-string snapshots.
- Meet the 30% compact reduction target on representative stages unless a stage is under 2,000 chars or has a documented evidence-supported exception.

### TDD files

- `tests/prompt-compiler.test.ts`
- `tests/prompt-normative-parity.test.ts`
- `tests/prompt-snapshots.test.ts`
- `tests/prompt-budget.test.ts`

### Gates

Run focused prompt tests, full typecheck/test/eval/package gates, and record standard-versus-compact character counts.

---

## Pull Request 3 — Adaptive Context Distillation and Caching

**Branch:** `feat/adaptive-context-distillation`

**Title:** `Add runtime-aware context distillation and deterministic caching`

### Deliverables

- Introduce exact context report contracts and deterministic section candidates.
- Preserve priority order from chapter packet through optional genre guidance.
- Add deterministic compact fact-card renderers for canon, relationships, threads, research, plot state, voice/book guardrails, and prior-chapter endpoint.
- Preserve exact record IDs, names, state, time, prohibitions, and source paths.
- Prefer accepted endpoint/state-change data; fall back to a bounded ending excerpt only when structured endpoint data is unavailable.
- Fail before inference when any required record ID is missing.
- Make `tiny-local` block unresolved context warnings and keep non-blocking warnings visible for `local` and `full`.
- Add deterministic cache under `.pi-book/cache/v1/` with project hash, relevant source hashes, runtime profile, distiller version, and section-policy version in keys.
- Ignore corrupt entries, rebuild on relevant changes, avoid broad invalidation from unrelated files, and never make cache content canonical.

### TDD files

- `tests/context-distillation.test.ts`
- `tests/context-required-ids.test.ts`
- `tests/context-budget.test.ts`
- `tests/context-report.test.ts`
- `tests/context-cache.test.ts`
- `tests/context-cache-invalidation.test.ts`
- Existing graph/context tests for safety regressions

---

## Pull Request 4 — Structured Stage IR and Deterministic Rendering

**Branch:** `feat/structured-stage-ir`

**Title:** `Generate workflow artifacts through validated stage IR`

### Deliverables

- Add validated IR for chapter packet, chapter queue, revision ticket, review verdict, research finding/source record, continuity update, and thread update.
- Map IR to existing canonical schemas; do not create competing canonical state.
- Add strict structured-output extraction: raw JSON or exactly one fenced JSON block, no surrounding prose, one parse, precise schema issues, no heuristic cleanup.
- Use adapter structured generation only when capabilities report support.
- Add stable YAML/Markdown renderers with deterministic field order/headings/final newline and renderer-owned defaults.
- Preserve whole-file generation as a compatibility fallback during migration.
- Keep creative prose outside mandatory IR.

### TDD files

- `tests/stage-ir-validation.test.ts`
- `tests/stage-ir-renderers.test.ts`
- `tests/stage-ir-roundtrip.test.ts`
- `tests/structured-output-parser.test.ts`

Round-trip every fixture through IR schema, renderer, existing loader, existing validator, and normalized semantic comparison.

---

## Pull Request 5 — Preflight Decisions and Targeted Repairs

**Branch:** `feat/preflight-targeted-repair`

**Title:** `Add deterministic preflight checks and targeted repair loops`

### Deliverables

- Add exact `PreflightDecision` and `RepairIssue` contracts.
- Verify stage, project hash, source files, required context IDs, allowed paths, required outputs, profile budgets/counts, IR availability, and adapter health before inference.
- Build repair prompts from only the failing artifact, exact issue, relevant schema excerpt, prior IR, immutable identifiers, and exact output contract.
- Enforce the profile's maximum repair attempts, never exceeding two in built-ins.
- Reject identifier changes, unrelated artifacts, and unrelated paths.
- Record only repair counts/categories in telemetry.
- Leave canonical state unchanged after failed repairs and recommend a larger profile only when evidence identifies budget/capability pressure.

### TDD files

- `tests/preflight.test.ts`
- `tests/repair-issue.test.ts`
- `tests/targeted-repair.test.ts`
- `tests/repair-atomicity.test.ts`

---

## Pull Request 6 — Restricted Patch-Based Event Application

**Branch:** `feat/restricted-event-patches`

**Title:** `Apply validated YAML and controlled Markdown event patches`

### Deliverables

- Add exact `PatchOp` contract with YAML set/append/remove, JSON set, and controlled Markdown section replacement.
- Validate paths and pointers before overlay mutation.
- Apply to an isolated in-memory/disk overlay, serialize complete normalized files, then reuse current event allowlists, required outputs, schemas, domain/reference checks, project hash/stage checks, transaction, status/handoff regeneration, and Git checkpoint.
- Restrict Markdown replacement to renderer-controlled files and approved unique headings.
- Reject same-path whole-file/patch conflicts, pointer conflicts, stale hash, disallowed paths, missing/duplicate headings, required-field removal, and chapter-prose targets.
- Keep whole-file events supported.

### TDD files

- `tests/event-patches.test.ts`
- `tests/event-patch-conflicts.test.ts`
- `tests/event-patch-atomicity.test.ts`
- Existing event/transaction/integrity tests

---

## Pull Request 7 — Local Runtime Adapters

**Branch:** `feat/local-runtime-adapters`

**Title:** `Add OpenAI-compatible and Ollama local runtime adapters`

### Deliverables

- Add the exact core adapter/capability contract.
- Implement generic OpenAI-compatible HTTP and Ollama HTTP adapters with built-in `fetch` and no runtime dependency.
- Normalize base URLs; include bearer auth only when configured; preserve message order; support abort signals; use non-streaming first.
- Map unreachable, timeout/abort, non-success, malformed JSON, and missing text to actionable sanitized errors.
- Detect/report capabilities conservatively; do not assume JSON schema support.
- Keep all backend-specific behavior inside adapter modules.
- Ordinary tests use local mocked HTTP endpoints and never require internet or a live model server.
- Core Pi-mediated workflow remains usable without adapter configuration.

### TDD files

- `tests/runtime-adapters/openai-compatible.test.ts`
- `tests/runtime-adapters/ollama.test.ts`
- `tests/runtime-adapters/adapter-registry.test.ts`
- `tests/runtime-adapters/credential-privacy.test.ts`

---

## Pull Request 8 — Benchmark Sweep, Documentation, CI, and Release Hardening

**Branch:** `chore/constrained-runtime-release`

**Title:** `Document and harden constrained local inference support`

### Deliverables

- Run the full scenario/profile benchmark matrix from the mission.
- Commit deterministic size, retention, validation, repair, changed-byte, and memory results; keep wall-clock values informational.
- Extend `.github/workflows/test.yml` with a focused profile matrix rather than tripling the entire suite.
- Add prompt-budget snapshots, IR golden round trips, cache invalidation, adapter contracts, and deterministic size-regression reporting.
- Update `README.md`, `SKILL.md`, `CHANGELOG.md`, and `RELEASE.md` with profile precedence, micro-steps, budget errors, context reports, IR, repair, patches, cache, telemetry privacy, adapters, troubleshooting, migration, and clearing local data.
- Validate documentation examples using synthetic projects only.
- Audit `npm pack --dry-run` for required modules/docs and exclusion of `.pi-book`, credentials, model files, raw debug prompts, benchmark temp files, and profiling output.
- Produce a final coverage matrix mapping every mission requirement to PR, tests, docs, and evidence.

---

## Test Strategy

### Unit boundaries

- Pure profile resolution and limit normalization.
- Pure prompt compilation and budget accounting.
- Pure context section policy, compact cards, required-ID accounting, and cache keys.
- Strict structured-output extraction, IR validation, and deterministic rendering.
- Pure preflight and repair-prompt construction.
- Pure patch pointer/heading validation and conflict detection.
- Adapter request/response/error mapping with local mocks.

### Integration boundaries

- Project schema/default compatibility with pre-runtime fixtures.
- Pi command parsing through run decision and prompt/context production.
- Graph depth and blocked-record protection under each profile.
- IR renderer through existing canonical loaders/validators.
- Patch overlay through existing guarded event transaction.
- Failed adapter, repair, cache, or telemetry operations leave canonical state unchanged.

### End-to-end boundaries

- Existing clean lifecycle under `full`.
- Tiny/local chapter packet, drafting context, revision, repair, and patch flows.
- Existing release journey and package smoke tests.
- Node 22.19.0 and Node 24 CI matrix.

### Privacy tests

Use unique sentinel strings for chapter prose, private notes, prompts, outputs, API keys, and authorization headers. Search every serialized report, cache metadata record, error, benchmark JSON, and test artifact for each sentinel. Deterministic context caches may contain canonical selected content only inside the local ignored cache, but cache metadata and telemetry must not duplicate raw prose. Credentials must never appear anywhere.

### Determinism tests

Run identical input twice and byte-compare prompt output, context output, reports excluding measured time/RSS, IR rendering, cache keys, and patch results. Sort IDs, paths, sections, issues, and operations before rendering whenever existing canonical order does not carry semantic meaning.

---

## Migration Strategy

1. Add runtime configuration as an optional project field at parse time.
2. Resolve missing configuration to `full` without rewriting `PROJECT.yaml`.
3. New projects write explicit `runtime.profile: full` and telemetry preference.
4. Existing active automation runs without a stored runtime profile resume as `full`; new runs store the resolved profile.
5. An explicit metadata upgrade may add runtime defaults only when the existing version-upgrade policy allows optional operational metadata; it must not alter stage, approvals, prose, canon, evidence, hashes of creative content, or active gates.
6. Shared StageSpec and structured IR are internal generation migrations; canonical file schemas remain the same unless an independently justified optional field is required.
7. Whole-file event generation remains available throughout IR and patch migration.
8. Cache and telemetry directories are disposable and excluded from canonical project hashes, Git, and package output.
9. Adapter configuration remains optional and external to canonical story state.
10. Add fixtures representing projects created before runtime profiles and active runs created before `runtimeProfile` existed.

---

## Benchmark Methodology

### Inputs

- Reuse the four checked-in synthetic genre/project fixtures.
- Build drafting-context and revision-ticket scenarios from synthetic records only.
- Never import private manuscript repositories or author prose.

### Measurements

- Prompt characters
- Context characters
- Estimated input tokens using the repository's stable estimate
- Stage success
- Validation result
- Valid IR on first attempt when applicable
- Repair count
- Validation failure categories
- Files changed
- Bytes changed
- Runtime profile
- Required-ID retention
- Informational duration
- Peak RSS when practical

### Comparison rules

- Compare `full` to the verified pre-change baseline for unexplained regressions.
- Compare compact prompt sizes to standard for the 30% target.
- Assert hard context/prompt budgets deterministically.
- Assert 100% required-ID retention, renderer validity, patch atomicity, and privacy sentinels.
- Do not fail shared CI on strict wall-clock thresholds.
- Report changed-byte locality before and after patches on representative queue, ticket, continuity, and renderer-controlled Markdown updates.

---

## Pull Request Standards

Every PR description must contain:

1. **Summary:** exact changes, phase rationale, deferred work.
2. **Architecture:** interfaces, data flow, compatibility, deterministic authority.
3. **Tests:** exact commands, exit codes, counts, and CI links.
4. **Metrics:** relevant before/after size, retention, repair, changed-byte, memory, or package data.
5. **Risk review:** canon integrity, project hash, prompt regression, context loss, cache staleness, schema compatibility, package size, privacy, adapter failure.
6. **Scope confirmation:** unrelated behavior and files not changed.
7. **Dependency review:** production dependencies added, ideally `none`.
8. **Overlap check:** open PRs and recent commits rechecked immediately before opening and merging.

---

## Completion Checklist

- [ ] Three built-in runtime profiles exist with exact validated values.
- [ ] Missing profiles resolve to compatibility `full`; invalid profiles fail.
- [ ] Explicit run option overrides project and local defaults.
- [ ] Micro-step chapter, ticket, artifact, graph, warning, and repair limits are enforced.
- [ ] Active runtime profile is visible in diagnostics and reports.
- [ ] Telemetry is opt-outable, atomic, ignored, package-excluded, and privacy-safe.
- [ ] Baseline and final benchmark matrices are committed using synthetic data.
- [ ] Every active stage has one shared declarative `StageSpec`.
- [ ] Standard and compact prompts retain the same normative requirements.
- [ ] Prompt budgets fail before inference and compact prompts meet targets or documented exceptions.
- [ ] Context building is runtime-aware and accounts for every candidate section.
- [ ] Required IDs have 100% retention and missing required IDs block inference.
- [ ] Future-book, provisional, inactive, and unready graph records remain safely blocked.
- [ ] Cache keys and invalidation cover project hash, relevant file hashes, profile, distiller version, and policy version.
- [ ] Corrupt/write-failed cache behavior is safe and non-authoritative.
- [ ] Initial stage IR set validates and round-trips through existing canonical validators.
- [ ] Creative prose is not forced through IR.
- [ ] Preflight blocks stale, impossible, over-budget, or disallowed runs before inference.
- [ ] Repair prompts are artifact-bounded, preserve identifiers, and obey retry caps.
- [ ] Failed repair does not mutate canonical state.
- [ ] Patch operations are allowlisted, deterministic, conflict-checked, prose-blocked, and atomic.
- [ ] Whole-file events remain supported.
- [ ] OpenAI-compatible and Ollama adapters pass local contract tests without credential leakage.
- [ ] Pi-mediated operation remains available without adapters.
- [ ] Focused profile CI matrix, prompt budgets, IR goldens, cache tests, adapter tests, and size reports are active.
- [ ] Existing full-profile lifecycle, evaluation, release, and package fixtures have no unexplained regression.
- [ ] Documentation and migration examples are complete and validated.
- [ ] `npm pack --dry-run` contains required runtime files and excludes local data/debug artifacts.
- [ ] Final requirement coverage matrix is committed.
- [ ] All required Node 22.19.0 and Node 24 gates are green before completion is declared.

---

## Decisions Where Repository Reality Differs From the Mission

1. **Current code is already post-1.4 foundation work despite package version 1.3.0.** Runtime implementation must integrate with active-run, intake, premise, structured-rejection, and author-journey modules already on `main`; it must not recreate those abstractions.
2. **The continuity graph already supports depth one or two safely.** Pass the runtime option through the existing resolver rather than adding another graph-selection system.
3. **The context builder already uses 72,000 characters and a stable `chars / 4` estimate.** Preserve those as `full` compatibility values in PR 1.
4. **The repository has no established `.pi-book` local-state directory.** Use `.pi-book/runs/` and `.pi-book/cache/v1/` as specified and add explicit ignore/package tests.
5. **The package does not currently own inference execution outside Pi.** PR 1 telemetry records deterministic preparation/application metrics at owned boundaries; PR 7 adds optional direct adapters without making them required.
6. **Existing structured rejection already permits one corrected resubmission.** PR 5 generalizes this into profile-bounded targeted artifact repair while preserving existing rejection semantics and compatibility.
7. **Existing YAML canonical schemas are already TypeBox-validated.** Stage IR maps to them and renderers must prove round-trip compatibility rather than replacing them.
8. **GitHub metadata calls were intermittently unavailable during initial verification.** Branch/file operations and repository file reads worked, but open-PR/recent-commit checks must be repeated before PR creation and merge. This is an evidence gap, not evidence of no overlap.

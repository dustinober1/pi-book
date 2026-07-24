# Gemma 3 12B QAT Small-Model-First Book Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Novel Forge capable of planning, drafting, validating, repairing, reviewing, and completing a book with `google/gemma-3-12b-it-qat-q4_0-gguf` while preserving deterministic canon authority, bounded resumability, and publication-quality prose that dramatizes important events instead of explaining them.

**Architecture:** Keep canonical YAML, Markdown, project hashes, guarded transactions, human gates, and evidence-backed state as the only authority. Add an exact Gemma execution profile, conservative token accounting, deterministic hybrid story retrieval, accepted-scene handoffs, typed dramatization contracts, concern-specific critics, bounded architecture jobs, a whole-book execution state machine, and real-model qualification gates. Retrieval uses exact IDs, dependency expansion, and deterministic sparse ranking; embeddings and vector databases are excluded from this release.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox, YAML, Node test runner, existing Pi isolated worker, existing story-record index, existing guarded transaction layer, existing quality tiers, and the Gemma 3 12B instruction-tuned QAT Q4_0 model through a Pi-supported local provider.

## Global Constraints

- Repository `dustinober1/pi-book` is the sole source of truth.
- Planning baseline is `main` at commit `9dcf70afd48b687bcc538e3e98be067c486a02b5`; each implementation PR must rebase or explicitly re-verify against the then-current `main`.
- Target model identity is `google/gemma-3-12b-it-qat-q4_0-gguf`; preserve a compatibility alias for `small-12b-q4` without using the alias in new qualification reports.
- Start with a qualified reliable context ceiling of `16_384` tokens even though the model family advertises a larger maximum context. Promotion above `16_384` requires a recorded qualification report.
- New Gemma scene targets are `700` to `1_100` words. A scene may not exceed `1_300` words without a stronger-model or human escalation.
- Canonical files, accepted manuscript prose, chapter deltas, state ledgers, knowledge ledgers, story threads, approved architecture, and approved plan changes remain authoritative.
- Retrieval products, embeddings, caches, prompts, model outputs, handoffs, qualification reports, and generated summaries are non-canonical unless an existing guarded event validates and commits their derived result.
- No graph database, vector database, hosted embedding dependency, browser inference layer, or model-authored direct canonical mutation.
- No model job may receive the full manuscript. Full-book work must use bounded concern windows, chapter deltas, paragraph anchors, and deterministic aggregation.
- Every structured model job gets at most one structured-output correction. Every prose repair remains paragraph- or span-addressed and gets at most two attempts.
- Important dramatic beats must be planned as observable action, resistance, evidence, consequence, and changed choice. Concise telling remains allowed for transitions, elapsed time, and low-value routine.
- Existing projects and persisted v1.7 artifacts must remain readable.
- Paid or local-model qualification is opt-in and never runs in ordinary CI.
- Every implementation PR must pass `npm run typecheck`, focused tests, `npm test`, `npm run eval`, `npm run benchmark:constrained-runtime`, `npm run benchmark:prompts`, `npm run verify:release`, `npm run test:release`, and `npm pack --dry-run` when the change touches packaged files.

---

## Verified Gaps This Program Closes

1. `small-12b-q4` is a generic size profile rather than an exact model/backend fingerprint.
2. Preflight token budgeting uses a general approximation and does not record estimator calibration for Gemma.
3. The live execution capsule does not populate `previousTail` or `optionalRecordIds`.
4. Scene acceptance does not create a compact handoff for the next scene.
5. The story index is dependency-aware but has no deterministic sparse retrieval lane for relevant unlisted records.
6. Scene contracts and scene plans do not require visible dramatization evidence.
7. The style critic is generic and does not isolate over-explanation, abstract emotion, redundant interpretation, or dialogue-plus-explanation failures.
8. Accepted style examples are supported by the compiler but are not selected in the live scene-execution path.
9. Chapter execution assumes a small-model-ready chapter contract already exists.
10. Architecture and deferred book-review jobs are not yet driven through the same one-step resumable small-model execution path.
11. Existing end-to-end execution tests use scripted workers and prove orchestration, not Gemma prose quality or structured-output reliability.

---

## Final File Map

| Concern | Create | Modify |
|---|---|---|
| Exact Gemma identity | `src/domain/model-fingerprint.ts`, `src/application/model-fingerprint.ts` | `src/domain/model-execution-profile.ts`, `src/domain/quality-worker.ts`, `src/pi/pi-print-worker.ts` |
| Conservative token accounting | `src/application/model-token-estimator.ts` | `src/context/active-context-capsule.ts`, scene runners, model profile tests |
| Real-model qualification | `src/domain/gemma-qualification.ts`, `src/evaluation/gemma-qualification.ts`, `scripts/qualify-gemma.ts`, `evals/gemma/README.md`, `evals/gemma/fixtures/*`, `evals/gemma/rubrics/*` | `package.json`, `.gitignore` |
| Scene handoff | `src/domain/scene-handoff-artifact.ts`, `src/application/scene-handoff.ts`, `src/infrastructure/scene-handoff-store.ts` | `src/domain/scene-state-delta-artifact.ts`, `src/application/scene-state-delta-runner.ts`, `src/application/scene-acceptance.ts` |
| Narrative-tail resolution | `src/application/narrative-handoff.ts` | `src/application/execution-context-capsule.ts`, `src/infrastructure/context-capsule-cache.ts` |
| Deterministic RAG | `src/domain/retrieval-manifest.ts`, `src/context/story-retrieval-query.ts`, `src/context/sparse-story-retrieval.ts` | `src/domain/active-context-capsule.ts`, `src/context/active-context-capsule.ts`, `src/application/execution-context-capsule.ts` |
| Retrieval benchmark | `src/evaluation/story-retrieval.ts`, `scripts/benchmark-story-retrieval.ts`, `evals/retrieval/fixtures/*` | `package.json`, release verification |
| Dramatization contracts | `src/domain/scene-dramatization.ts` | `src/domain/chapter-contract.ts`, `src/domain/scene-contract.ts`, contract compilers |
| Dramatized plans | `src/domain/scene-plan-dramatization.ts` | `src/domain/scene-plan-artifact.ts`, `src/application/scene-plan-runner.ts`, `src/application/scene-draft-runner.ts` |
| Style examples | `src/domain/style-example-registry.ts`, `src/application/style-example-selector.ts` | `src/application/style-card-compiler.ts`, `src/application/project-hash.ts`, `src/project/templates.ts` |
| Dramatization review | `src/application/dramatization-evidence.ts` | `src/domain/model-job.ts`, `src/domain/scene-critic-artifact.ts`, `src/application/scene-critic-runner.ts`, `src/application/quality/job-plan.ts` |
| Chapter-contract generation | `src/domain/chapter-contract-proposal.ts`, `src/application/chapter-contract-runner.ts`, `src/application/chapter-contract-validation.ts`, `src/infrastructure/chapter-contract-proposal-store.ts` | `src/application/contracts/chapter-contract-compiler.ts`, transaction/event integration |
| Bounded architecture jobs | `src/domain/architecture-job-artifact.ts`, `src/application/architecture/*`, `src/infrastructure/architecture-run-store.ts` | `src/domain/model-job.ts`, `src/domain/model-execution-profile.ts`, phase-4 validation |
| Whole-book state machine | `src/domain/book-execution-state.ts`, `src/domain/book-execution-manifest.ts`, `src/application/book-execution-stepper.ts`, `src/infrastructure/book-execution-store.ts` | `src/pi/extension.ts`, `extensions/novel-forge.ts`, package tests |
| Concern review and repair | `src/domain/book-concern-review.ts`, `src/application/book-concern-window.ts`, `src/application/book-concern-runner.ts`, `src/application/book-repair-stepper.ts` | quality plans, audit events, revision-ticket flow |
| Release qualification | `scripts/verify-v1-8-release.ts`, `tests/v1-8-release-checklist.test.ts` | `README.md`, `SKILL.md`, `CHANGELOG.md`, `RELEASE.md`, `package.json` |

---

## Recommended Pull-Request Sequence

1. Gemma identity and token budgets.
2. Real-model qualification harness.
3. Accepted-scene handoff and previous-tail context.
4. Deterministic sparse story retrieval and retrieval benchmark.
5. Dramatization contracts and scene-plan expansion.
6. Style examples and dramatization critic.
7. Model-driven chapter-contract generation.
8. Bounded architecture jobs.
9. Whole-book stepper.
10. Concern-specific book review and bounded repair.
11. Full Gemma qualification, documentation, and v1.8 release gate.

Do not combine two sequence entries into one PR. Each PR must be independently reviewable and mergeable.

---

### Task 1: Add an exact Gemma 3 12B QAT execution profile and fingerprint

**Files:**
- Create: `src/domain/model-fingerprint.ts`
- Create: `src/application/model-fingerprint.ts`
- Modify: `src/domain/model-execution-profile.ts`
- Modify: `src/domain/quality-worker.ts`
- Modify: `src/pi/pi-print-worker.ts`
- Test: `tests/gemma-model-profile.test.ts`
- Test: `tests/model-fingerprint.test.ts`

**Interfaces:**
- Consumes: current `ModelExecutionProfile`, `QualityModelCapacity`, and Pi model metadata.
- Produces:

```ts
export const GEMMA_3_12B_QAT_PROFILE_ID = "gemma-3-12b-it-qat-q4_0" as const;

export interface ModelFingerprint {
  schema_version: "1.0.0";
  profile_id: typeof GEMMA_3_12B_QAT_PROFILE_ID;
  provider: string;
  model: string;
  backend: string;
  backend_version: string | null;
  quantization: "Q4_0";
  context_window_tokens: number;
  maximum_output_tokens: number;
  chat_template_hash: string | null;
  model_file_hash: string | null;
}

export function assertGemmaFingerprintMatchesProfile(
  fingerprint: ModelFingerprint,
  profile: ModelExecutionProfile,
): void;
```

- [ ] **Step 1: Write failing profile and fingerprint tests**

```ts
test("Gemma QAT profile is exact and conservative", () => {
  const profile = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"];
  assert.equal(profile.reliable_context_tokens, 16_384);
  assert.deepEqual(profile.preferred_scene_words, { minimum: 700, maximum: 1_100 });
  assert.equal(profile.capabilities.tool_calls, false);
  assert.equal(profile.capabilities.grammar, true);
});

test("fingerprint rejects a non-Q4_0 target", () => {
  assert.throws(() => assertGemmaFingerprintMatchesProfile({
    schema_version: "1.0.0",
    profile_id: "gemma-3-12b-it-qat-q4_0",
    provider: "local",
    model: "google/gemma-3-12b-it",
    backend: "llama.cpp",
    backend_version: "b6000",
    quantization: "Q4_0",
    context_window_tokens: 16_384,
    maximum_output_tokens: 4_096,
    chat_template_hash: null,
    model_file_hash: null,
  }, MODEL_EXECUTION_PROFILES["host-default"]));
});
```

- [ ] **Step 2: Run the focused tests**

Run: `node --import tsx --test tests/gemma-model-profile.test.ts tests/model-fingerprint.test.ts`

Expected: FAIL because the exact profile and fingerprint modules do not exist.

- [ ] **Step 3: Add the profile and compatibility alias**

Add `gemma-3-12b-it-qat-q4_0` to `MODEL_EXECUTION_PROFILE_IDS`. Keep `small-12b-q4` readable and map it through a resolver to the exact Gemma profile with a deprecation advisory. Use these fixed initial policies:

```ts
reliable_context_tokens: 16_384,
maximum_output_tokens: 4_096,
preferred_scene_words: { minimum: 700, maximum: 1_100 },
capabilities: { json_schema: false, grammar: true, tool_calls: false },
```

Set `draft-scene` to `temperature: 0.65`, `topP: 0.90`, `maximumOutputTokens: 2_600`, `repetitionPenalty: 1.08`, and `thinking: "off"`. Set structured jobs to `temperature: 0.05`, `topP: 0.20`, and `thinking: "off"`.

- [ ] **Step 4: Record model identity in worker metadata**

Extend `QualityModelCapacity` with optional `backend`, `backendVersion`, `quantization`, `chatTemplateHash`, and `modelFileHash` fields. Keep them optional so existing test workers remain structurally compatible. Normalize them into `ModelFingerprint` before a Gemma qualification or book run begins.

- [ ] **Step 5: Run profile, worker, and compatibility tests**

Run: `node --import tsx --test tests/gemma-model-profile.test.ts tests/model-fingerprint.test.ts tests/model-execution-profile.test.ts tests/pi-print-worker.test.ts tests/v1-7-release-checklist.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/model-fingerprint.ts src/application/model-fingerprint.ts src/domain/model-execution-profile.ts src/domain/quality-worker.ts src/pi/pi-print-worker.ts tests/gemma-model-profile.test.ts tests/model-fingerprint.test.ts
git commit -m "feat: add exact Gemma QAT execution profile"
```

---

### Task 2: Replace generic token estimates with a Gemma-calibrated conservative estimator

**Files:**
- Create: `src/application/model-token-estimator.ts`
- Modify: `src/domain/model-execution-profile.ts`
- Modify: `src/context/active-context-capsule.ts`
- Modify: `src/application/scene-plan-runner.ts`
- Modify: `src/application/scene-draft-runner.ts`
- Modify: `src/application/scene-critic-runner.ts`
- Modify: `src/application/scene-state-delta-runner.ts`
- Modify: `src/application/scene-span-repair-runner.ts`
- Test: `tests/model-token-estimator.test.ts`
- Test: `tests/gemma-budget-preflight.test.ts`

**Interfaces:**

```ts
export interface TokenEstimationPolicy {
  id: string;
  utf8_bytes_per_token: number;
  fixed_envelope_tokens: number;
  maximum_observed_underestimate_ratio: number;
}

export function estimateModelTokens(text: string, policy: TokenEstimationPolicy): number;

export function assertModelJobFits(input: {
  instruction: string;
  evidence: string;
  profile: ModelExecutionProfile;
  jobType: ModelJobType;
}): { instructionTokens: number; evidenceTokens: number; totalReservedTokens: number };
```

- [ ] **Step 1: Add failing estimator tests**

```ts
test("Gemma estimate uses UTF-8 bytes and a safety envelope", () => {
  const policy = MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"].token_estimation;
  assert.equal(estimateModelTokens("a".repeat(3_000), policy), 1_064);
});

test("Gemma draft preflight rejects total reserved context above 16384", () => {
  assert.throws(() => assertModelJobFits({
    instruction: "x".repeat(3_000),
    evidence: "y".repeat(45_000),
    profile: MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"],
    jobType: "draft-scene",
  }), /reliable context/i);
});
```

Use the initial Gemma policy `utf8_bytes_per_token: 3`, `fixed_envelope_tokens: 64`, and `maximum_observed_underestimate_ratio: 1.10`. The first assertion is `ceil(3000 / 3) + 64`.

- [ ] **Step 2: Run the focused tests**

Run: `node --import tsx --test tests/model-token-estimator.test.ts tests/gemma-budget-preflight.test.ts`

Expected: FAIL because token estimation is still hard-coded as bytes divided by four.

- [ ] **Step 3: Centralize all preflight calculations**

Remove local token-estimation helpers from capsule and scene runners. Every runner must call `assertModelJobFits` before inference and record the returned counts in telemetry. The assertion must reserve instruction, evidence, output, and safety-margin tokens together.

- [ ] **Step 4: Add calibration telemetry**

When worker usage includes `inputTokens`, record `actual_input_tokens / estimated_input_tokens` in the privacy-safe run report. Never record prompt or prose. A ratio greater than the profile allowance emits escalation code `token-estimator-underflow` and blocks later calls in the same run.

- [ ] **Step 5: Run focused and full budget tests**

Run: `node --import tsx --test tests/model-token-estimator.test.ts tests/gemma-budget-preflight.test.ts tests/budget-ledger.test.ts tests/active-context-capsule.test.ts tests/run-telemetry-v3.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/model-token-estimator.ts src/domain/model-execution-profile.ts src/context/active-context-capsule.ts src/application/scene-*-runner.ts tests/model-token-estimator.test.ts tests/gemma-budget-preflight.test.ts
git commit -m "feat: calibrate token budgets for Gemma QAT"
```

---

### Task 3: Add an opt-in real Gemma qualification harness before changing prose behavior

**Files:**
- Create: `src/domain/gemma-qualification.ts`
- Create: `src/evaluation/gemma-qualification.ts`
- Create: `scripts/qualify-gemma.ts`
- Create: `evals/gemma/README.md`
- Create: `evals/gemma/fixtures/structured-jobs.yaml`
- Create: `evals/gemma/fixtures/authority-distraction.yaml`
- Create: `evals/gemma/fixtures/dramatized-scene.yaml`
- Create: `evals/gemma/rubrics/prose-review.md`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/gemma-qualification.test.ts`

**Interfaces:**

```ts
export interface GemmaQualificationCase {
  id: string;
  job_type: ModelJobType;
  prompt: string;
  context: string;
  expected: {
    valid_structured_output: boolean;
    required_record_ids: string[];
    forbidden_record_ids: string[];
    must_stop: boolean;
  };
}

export interface GemmaQualificationReport {
  schema_version: "1.0.0";
  fingerprint: ModelFingerprint;
  case_count: number;
  first_pass_structured_rate: number;
  corrected_structured_rate: number;
  required_record_rate: number;
  forbidden_record_uses: number;
  correct_stop_rate: number;
  severe_failure_count: number;
  report_hash: string;
}
```

- [ ] **Step 1: Add failing harness tests with a scripted worker**

The test must prove deterministic case ordering, one correction maximum, privacy-safe machine output, a separate prose review kit, and a sealed label file.

- [ ] **Step 2: Run the focused test**

Run: `node --import tsx --test tests/gemma-qualification.test.ts`

Expected: FAIL because the qualification harness does not exist.

- [ ] **Step 3: Implement the opt-in command**

Add:

```json
"eval:gemma": "node --import tsx scripts/qualify-gemma.ts"
```

Require all of:

```text
NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1
--provider <exact provider>
--model <exact model>
--fingerprint <fingerprint json path>
--seed <nonblank seed>
```

Write machine reports under `evals/gemma/runs/`, which remains ignored. Store prose only in the blinded review kit, never in the machine report.

- [ ] **Step 4: Enforce the initial promotion gates**

The command exits nonzero unless:

- first-pass structured validity is at least `0.95`;
- validity after one correction is at least `0.99`;
- required-record use is `1.00`;
- forbidden-record use is `0`;
- correct stop/escalation rate is at least `0.95`;
- severe failure count is `0`.

- [ ] **Step 5: Run tests and a dry configuration failure**

Run: `node --import tsx --test tests/gemma-qualification.test.ts`

Run: `npm run eval:gemma -- --provider local --model google/gemma-3-12b-it-qat-q4_0-gguf --fingerprint missing.json --seed dry-run`

Expected: first command PASS; second command exits nonzero because the opt-in environment variable and fingerprint are absent.

- [ ] **Step 6: Commit**

```bash
git add src/domain/gemma-qualification.ts src/evaluation/gemma-qualification.ts scripts/qualify-gemma.ts evals/gemma package.json .gitignore tests/gemma-qualification.test.ts
git commit -m "feat: add opt-in Gemma qualification harness"
```

---

### Task 4: Persist an evidence-backed scene handoff during state extraction

**Files:**
- Create: `src/domain/scene-handoff-artifact.ts`
- Create: `src/application/scene-handoff.ts`
- Create: `src/infrastructure/scene-handoff-store.ts`
- Modify: `src/domain/scene-state-delta-artifact.ts`
- Modify: `src/application/scene-state-delta-runner.ts`
- Modify: `src/application/scene-acceptance.ts`
- Test: `tests/scene-handoff.test.ts`
- Test: `tests/scene-acceptance.test.ts`

**Interfaces:**

```ts
export interface SceneHandoffOutput {
  location: string | null;
  time_marker: string | null;
  present_entity_ids: string[];
  active_state_record_ids: string[];
  object_state_record_ids: string[];
  physical_constraints: Array<{ description: string; evidence_quote: string }>;
  last_spoken_pressure: { quote: string; speaker_id: string | null } | null;
  immediate_intention: { description: string; evidence_quote: string } | null;
  unresolved_question_ids: string[];
}

export interface SceneHandoffArtifact extends SceneHandoffOutput {
  schema_version: "1.0.0";
  run_id: string;
  chapter: number;
  scene_id: string;
  draft_output_hash: string;
  state_delta_hash: string;
  handoff_hash: string;
}
```

- [ ] **Step 1: Write failing extraction and acceptance tests**

Test that an unknown entity ID, unknown state ID, or absent evidence quote rejects the handoff. Test that scene acceptance requires a matching handoff hash for new Gemma runs while legacy persisted runs remain readable.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/scene-handoff.test.ts tests/scene-acceptance.test.ts`

Expected: FAIL because state extraction has no handoff output or store.

- [ ] **Step 3: Extend state-delta output without adding a model call**

Add optional `handoff` to `SceneStateDeltaOutputSchema`. The state-delta prompt must request state mutations, thread changes, and the handoff in the same exact JSON object. Validate all record IDs against the active capsule and all quotes against accepted candidate prose.

- [ ] **Step 4: Write and bind the handoff artifact**

Write `.pi-book/runs/<run-id>/handoffs/<scene-id>.json` atomically. Include its hash in the scene acceptance artifact and verify it during stitch preparation. Do not write it into canonical project hashing.

- [ ] **Step 5: Run state, acceptance, and multi-scene tests**

Run: `node --import tsx --test tests/scene-handoff.test.ts tests/scene-state-delta-runner.test.ts tests/scene-acceptance.test.ts tests/chapter-execution-stepper-multiscene.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scene-handoff-artifact.ts src/application/scene-handoff.ts src/infrastructure/scene-handoff-store.ts src/domain/scene-state-delta-artifact.ts src/application/scene-state-delta-runner.ts src/application/scene-acceptance.ts tests/scene-handoff.test.ts tests/scene-acceptance.test.ts
git commit -m "feat: persist scene-to-scene handoffs"
```

---

### Task 5: Feed the prior accepted prose tail and handoff into every later scene

**Files:**
- Create: `src/application/narrative-handoff.ts`
- Modify: `src/application/execution-context-capsule.ts`
- Modify: `src/context/active-context-capsule.ts`
- Modify: `src/infrastructure/context-capsule-cache.ts`
- Test: `tests/narrative-handoff.test.ts`
- Test: `tests/context-capsule-cache.test.ts`

**Interfaces:**

```ts
export interface NarrativeHandoff {
  previous_tail: string | null;
  scene_handoff: SceneHandoffArtifact | null;
  source_hashes: Array<{ path: string; hash: string }>;
}

export function resolveNarrativeHandoff(input: {
  root: string;
  manifest: ChapterExecutionManifest;
  sceneId: string;
}): NarrativeHandoff;
```

- [ ] **Step 1: Add failing first-scene and later-scene tests**

The first scene of Chapter 1 receives no tail. The first scene of Chapter 2 receives the last two prose paragraphs of the accepted Chapter 1 manuscript. A later scene in the same chapter receives the last two paragraphs of the immediately preceding accepted scene plus its handoff artifact. Limit the tail to `2_400` UTF-8 characters after paragraph selection.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/narrative-handoff.test.ts tests/context-capsule-cache.test.ts`

Expected: FAIL because execution capsules currently pass neither source.

- [ ] **Step 3: Add handoff records to the capsule**

Render handoff data under a dedicated `IMMEDIATE NARRATIVE STATE` section. It must appear after authority-labeled records and before the style card. The tail is evidence, not an instruction, and must retain its source hash.

- [ ] **Step 4: Bind the cache key to handoff identity**

Add the prior tail hash and handoff hash to `contextCapsuleCacheKey`. A new accepted scene must invalidate only later scene capsules, not earlier completed work.

- [ ] **Step 5: Run capsule, cache, and stepper tests**

Run: `node --import tsx --test tests/narrative-handoff.test.ts tests/active-context-renderer.test.ts tests/context-capsule-cache.test.ts tests/chapter-execution-stepper-multiscene.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/narrative-handoff.ts src/application/execution-context-capsule.ts src/context/active-context-capsule.ts src/infrastructure/context-capsule-cache.ts tests/narrative-handoff.test.ts tests/context-capsule-cache.test.ts
git commit -m "feat: carry immediate narrative state into scenes"
```

---

### Task 6: Add deterministic hybrid story retrieval without embeddings

**Files:**
- Create: `src/domain/retrieval-manifest.ts`
- Create: `src/context/story-retrieval-query.ts`
- Create: `src/context/sparse-story-retrieval.ts`
- Modify: `src/domain/active-context-capsule.ts`
- Modify: `src/context/active-context-capsule.ts`
- Modify: `src/application/execution-context-capsule.ts`
- Test: `tests/story-retrieval-query.test.ts`
- Test: `tests/sparse-story-retrieval.test.ts`
- Test: `tests/active-context-capsule.test.ts`

**Interfaces:**

```ts
export interface StoryRetrievalQuery {
  scene_id: string;
  job_type: ModelJobType;
  terms: string[];
  phrases: string[];
  entity_ids: string[];
  thread_ids: string[];
  chapter: number;
}

export interface RetrievalSelection {
  record_id: string;
  score: number;
  reason: string;
  matched_terms: string[];
}

export function compileStoryRetrievalQuery(input: {
  scene: SceneContract;
  jobType: ModelJobType;
  handoff: NarrativeHandoff;
}): StoryRetrievalQuery;

export function selectOptionalStoryRecords(input: {
  index: StoryRecordIndex;
  query: StoryRetrievalQuery;
  excludedIds: ReadonlySet<string>;
  maximumRecords: number;
}): { selected: RetrievalSelection[]; omitted: RetrievalSelection[] };
```

- [ ] **Step 1: Add failing query and ranking tests**

Test exact ID hits, phrase hits, term-frequency ranking, chapter recency, job-specific kind weights, deterministic tie-breaking, unsafe status exclusion, future-chapter exclusion, and no duplicate records.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/story-retrieval-query.test.ts tests/sparse-story-retrieval.test.ts`

Expected: FAIL because no sparse selector exists.

- [ ] **Step 3: Implement deterministic scoring**

Normalize Unicode, lowercase, split alphanumeric terms, remove a versioned stop-word set, and calculate BM25 with `k1 = 1.2` and `b = 0.75`. Add fixed score bonuses:

```ts
const EXACT_ID_BONUS = 100;
const EXACT_PHRASE_BONUS = 25;
const ACTIVE_THREAD_BONUS = 20;
const CURRENT_STATE_BONUS = 15;
const SAME_OR_PRIOR_CHAPTER_BONUS = 5;
```

Use job-specific kind weights. `critic-continuity` prioritizes state, knowledge, relationship, chapter delta, and object-bearing records. `draft-scene` prioritizes current state, active thread, relationship, knowledge, and recent chapter delta. `critic-factuality` prioritizes research records.

- [ ] **Step 4: Add retrieval provenance to capsule schema**

Extend the capsule manifest with a backward-compatible optional `retrieval` object containing query terms, selected scores, omitted scores, excluded unsafe IDs, and source hashes. Replace `optionalRecordIds` with an additional `optionalSelections` input while retaining `optionalRecordIds` for compatibility tests.

- [ ] **Step 5: Wire retrieval into live execution**

Required records and dependencies consume the budget first. Immediate handoff and style card consume the second allocation. Sparse results consume only the remaining evidence budget and never displace required records.

- [ ] **Step 6: Run retrieval and capsule tests**

Run: `node --import tsx --test tests/story-retrieval-query.test.ts tests/sparse-story-retrieval.test.ts tests/active-context-capsule.test.ts tests/pi-context-inspect-command.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/retrieval-manifest.ts src/context/story-retrieval-query.ts src/context/sparse-story-retrieval.ts src/domain/active-context-capsule.ts src/context/active-context-capsule.ts src/application/execution-context-capsule.ts tests/story-retrieval-query.test.ts tests/sparse-story-retrieval.test.ts tests/active-context-capsule.test.ts
git commit -m "feat: add deterministic story retrieval"
```

---

### Task 7: Qualify retrieval against long-range adversarial fixtures

**Files:**
- Create: `src/evaluation/story-retrieval.ts`
- Create: `scripts/benchmark-story-retrieval.ts`
- Create: `evals/retrieval/fixtures/object-owner.yaml`
- Create: `evals/retrieval/fixtures/paraphrased-knowledge.yaml`
- Create: `evals/retrieval/fixtures/future-book-decoy.yaml`
- Create: `evals/retrieval/fixtures/similar-names.yaml`
- Create: `evals/retrieval/fixtures/stale-state.yaml`
- Modify: `package.json`
- Modify: release verification
- Test: `tests/story-retrieval-benchmark.test.ts`

**Interfaces:**

```ts
export interface RetrievalBenchmarkResult {
  fixture_count: number;
  required_recall: number;
  optional_recall_at_8: number;
  unsafe_inclusion_count: number;
  future_book_inclusion_count: number;
  deterministic_hash: string;
}
```

- [ ] **Step 1: Add failing benchmark tests**

The synthetic corpus must contain a correct record twenty chapters earlier, a paraphrased knowledge record, a highly similar future-book fact, two similarly named characters, and a deprecated state beside a current state.

- [ ] **Step 2: Run the focused benchmark test**

Run: `node --import tsx --test tests/story-retrieval-benchmark.test.ts`

Expected: FAIL because the benchmark does not exist.

- [ ] **Step 3: Add the deterministic command**

Add:

```json
"benchmark:retrieval": "node --import tsx scripts/benchmark-story-retrieval.ts"
```

The command must require `required_recall === 1`, `optional_recall_at_8 >= 0.95`, `unsafe_inclusion_count === 0`, and `future_book_inclusion_count === 0`.

- [ ] **Step 4: Record the embedding decision**

If sparse retrieval meets the thresholds, keep embeddings out of v1.8. If optional recall remains below `0.95` solely on paraphrase-only cases, open a separate v1.9 design for a local flat-vector recall plugin. That plugin may suggest candidates but may not bypass authority, boundary, source-hash, or deterministic reranking checks.

- [ ] **Step 5: Run benchmark and release checks**

Run: `npm run benchmark:retrieval`

Run: `npm run eval`

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/evaluation/story-retrieval.ts scripts/benchmark-story-retrieval.ts evals/retrieval package.json tests/story-retrieval-benchmark.test.ts
git commit -m "test: qualify long-range story retrieval"
```

---

### Task 8: Make dramatization a typed chapter and scene obligation

**Files:**
- Create: `src/domain/scene-dramatization.ts`
- Modify: `src/domain/chapter-contract.ts`
- Modify: `src/domain/scene-contract.ts`
- Modify: `src/application/contracts/chapter-contract-compiler.ts`
- Modify: `src/application/contracts/scene-contract-compiler.ts`
- Test: `tests/chapter-contract.test.ts`
- Test: `tests/scene-contract.test.ts`

**Interfaces:**

```ts
export interface SceneDramatization {
  observable_goal: string;
  active_resistance: string;
  causal_chain: string[];
  sensory_anchors: string[];
  information_delivery: string[];
  emotional_behavior_start: string;
  emotional_behavior_end: string;
  subtext: string[];
  summary_budget_sentences: number;
  forbidden_telling: string[];
}

export interface ChapterInformationRelease {
  reader_knows_before_ids: string[];
  pov_knows_before_ids: string[];
  reveal_ids: string[];
  implication_ids: string[];
  conceal_ids: string[];
}
```

- [ ] **Step 1: Add failing schema and compiler tests**

New Gemma-ready contracts must fail when dramatization, information release, or a causal chain is absent. Legacy contracts remain readable but cannot start a new Gemma execution until upgraded.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/chapter-contract.test.ts tests/scene-contract.test.ts`

Expected: FAIL because these fields do not exist.

- [ ] **Step 3: Add backward-compatible optional fields**

Keep persisted schema versions readable. Add optional fields to the existing TypeBox schemas, then make `assertSmallModelChapterContract(contract, profileId)` require them for the exact Gemma profile. Compilers for new Gemma runs must populate them.

- [ ] **Step 4: Enforce useful telling rather than a universal ban**

Require `summary_budget_sentences` from `0` to `3`. The contract must name what may be summarized and what must be dramatized. `forbidden_telling` must describe scene-specific failures such as stating an emotion or explaining a visible consequence; it must not contain universal word bans.

- [ ] **Step 5: Run contract, compatibility, and release tests**

Run: `node --import tsx --test tests/chapter-contract.test.ts tests/scene-contract.test.ts tests/v1-7-release-checklist.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scene-dramatization.ts src/domain/chapter-contract.ts src/domain/scene-contract.ts src/application/contracts/chapter-contract-compiler.ts src/application/contracts/scene-contract-compiler.ts tests/chapter-contract.test.ts tests/scene-contract.test.ts
git commit -m "feat: add typed scene dramatization contracts"
```

---

### Task 9: Expand scene plans into visible action, resistance, evidence, and consequence

**Files:**
- Create: `src/domain/scene-plan-dramatization.ts`
- Modify: `src/domain/scene-plan-artifact.ts`
- Modify: `src/application/scene-plan-runner.ts`
- Modify: `src/application/scene-draft-runner.ts`
- Test: `tests/scene-plan-runner.test.ts`
- Test: `tests/scene-draft-runner.test.ts`

**Interfaces:**

```ts
export interface ScenePlanDramatization {
  observable_action: string;
  resistance: string;
  sensory_evidence: string[];
  information_delivery: string;
  subtext: string;
  consequence: string;
  next_beat_cause: string | null;
}
```

Add `dramatization` to every `ScenePlanStep`. The last step uses `next_beat_cause: null`; every earlier step requires a nonblank cause connecting its consequence to the next beat.

- [ ] **Step 1: Add failing structured-plan tests**

Reject a plan that repeats beat labels without concrete action, uses an unknown evidence record, omits resistance, or creates a list of unrelated events. Accept a plan whose consequence causes the next beat.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/scene-plan-runner.test.ts tests/scene-draft-runner.test.ts`

Expected: FAIL because plans currently expose only `execution` and `pressure`.

- [ ] **Step 3: Update the planning prompt and validator**

The planning prompt must request one exact JSON object and one dramatization record per required beat. The validator must preserve exact beat order and verify that all evidence IDs exist in the capsule.

- [ ] **Step 4: Render the plan directly before the exact draft task**

For each beat render, in this order: required beat, observable action, resistance, sensory evidence, information delivery, subtext, consequence, and next-beat cause. Do not render an essay about show-don't-tell.

- [ ] **Step 5: Run plan, draft, budget, and multi-scene tests**

Run: `node --import tsx --test tests/scene-plan-runner.test.ts tests/scene-draft-runner.test.ts tests/gemma-budget-preflight.test.ts tests/chapter-execution-stepper-multiscene.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scene-plan-dramatization.ts src/domain/scene-plan-artifact.ts src/application/scene-plan-runner.ts src/application/scene-draft-runner.ts tests/scene-plan-runner.test.ts tests/scene-draft-runner.test.ts
git commit -m "feat: plan scenes through dramatic evidence"
```

---

### Task 10: Select paragraph-anchored positive style examples for each scene

**Files:**
- Create: `src/domain/style-example-registry.ts`
- Create: `src/application/style-example-selector.ts`
- Modify: `src/application/style-card-compiler.ts`
- Modify: `src/application/project-hash.ts`
- Modify: `src/project/templates.ts`
- Modify: `src/domain/v1-3-schema-registry.ts`
- Test: `tests/style-example-selector.test.ts`
- Test: `tests/style-card.test.ts`

**Interfaces:**

```ts
export interface StyleExampleRecord {
  id: string;
  pov: string | null;
  tags: Array<"dialogue-subtext" | "dramatization" | "action" | "interiority" | "description">;
  source_path: string;
  paragraph: number;
  paragraph_hash: string;
  quote: string;
  status: "approved" | "retired";
}

export function selectStyleExamples(input: {
  registry: StyleExampleRegistry;
  pov: string;
  scene: SceneContract;
  maximum: 2;
}): StyleExampleRecord[];
```

- [ ] **Step 1: Add failing selection and stale-anchor tests**

Select at most two approved examples. Prefer exact POV, then dramatization tag, then the scene function. Reject a paragraph-hash mismatch. Exclude retired examples.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/style-example-selector.test.ts tests/style-card.test.ts`

Expected: FAIL because the live compiler receives no selected paragraph anchors.

- [ ] **Step 3: Add optional `series/style-examples.yaml`**

New projects receive an empty registry. Existing projects without the file remain valid. Once the file exists, include it in project hashing because selected style examples affect scene execution.

- [ ] **Step 4: Feed selected examples into the live style card**

Replace first-characters-of-file example extraction for new records with exact paragraph anchors. Keep legacy `acceptedExamplePaths` readable. Render only the bounded quote and source identity.

- [ ] **Step 5: Run style, hash, template, and compatibility tests**

Run: `node --import tsx --test tests/style-example-selector.test.ts tests/style-card.test.ts tests/project-hash.test.ts tests/project-templates.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/style-example-registry.ts src/application/style-example-selector.ts src/application/style-card-compiler.ts src/application/project-hash.ts src/project/templates.ts src/domain/v1-3-schema-registry.ts tests/style-example-selector.test.ts tests/style-card.test.ts
git commit -m "feat: select approved scene style examples"
```

---

### Task 11: Add a narrow dramatization critic and deterministic tell-risk evidence

**Files:**
- Create: `src/application/dramatization-evidence.ts`
- Modify: `src/domain/model-job.ts`
- Modify: `src/domain/scene-critic-artifact.ts`
- Modify: `src/application/scene-critic-runner.ts`
- Modify: `src/application/execution-context-capsule.ts`
- Modify: `src/application/quality/job-plan.ts`
- Modify: `src/domain/model-execution-profile.ts`
- Test: `tests/dramatization-evidence.test.ts`
- Test: `tests/scene-critic-runner.test.ts`
- Test: `tests/quality-job-plan.test.ts`

**Interfaces:**

```ts
export interface DramatizationEvidence {
  abstract_emotion_quotes: string[];
  filter_construction_quotes: string[];
  redundant_interpretation_quotes: string[];
  dialogue_explanation_quotes: string[];
  exposition_run_paragraphs: number[];
}

export function collectDramatizationEvidence(prose: string): DramatizationEvidence;
```

Add `critic-dramatization` to `MODEL_JOB_TYPES`, `SCENE_CRITIC_JOB_TYPES`, Gemma budgets, and premium/editorial specialist plans.

- [ ] **Step 1: Add failing evidence and critic tests**

Use fixtures containing abstract emotion, a visible action followed by explanation, dialogue followed by redundant interpretation, and a legitimate transition summary. The deterministic evidence must flag the first three and leave the transition as reviewable rather than an automatic defect.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/dramatization-evidence.test.ts tests/scene-critic-runner.test.ts tests/quality-job-plan.test.ts`

Expected: FAIL because the concern does not exist.

- [ ] **Step 3: Add a concern-specific prompt**

The critic must inspect only:

- abstract emotion replacing behavior;
- narrator explanation of a motive or consequence already visible;
- backstory without a present-scene trigger;
- dialogue followed by redundant interpretation;
- disembodied exchanges without action or environmental interaction;
- important decisions summarized instead of enacted;
- generic sensory detail that does not change pressure or choice.

Each finding still requires exact candidate evidence and a bounded required change. The prompt must explicitly permit concise transition telling within the contract's summary budget.

- [ ] **Step 4: Include deterministic evidence as advisory context**

Render it as `DRAMATIZATION REVIEW CANDIDATES`. It may focus the critic but may not set verdict or severity.

- [ ] **Step 5: Update job-plan ceilings**

Add one `critic-dramatization` call to premium and editorial. Increase the fixed plan ceilings only by its declared maximum output plus one correction reservation. Re-run the exact ceiling tests rather than weakening them.

- [ ] **Step 6: Run critic, repair, and quality-plan tests**

Run: `node --import tsx --test tests/dramatization-evidence.test.ts tests/scene-critic-runner.test.ts tests/scene-critic-aggregation.test.ts tests/scene-span-repair-runner.test.ts tests/quality-job-plan.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/dramatization-evidence.ts src/domain/model-job.ts src/domain/scene-critic-artifact.ts src/application/scene-critic-runner.ts src/application/execution-context-capsule.ts src/application/quality/job-plan.ts src/domain/model-execution-profile.ts tests/dramatization-evidence.test.ts tests/scene-critic-runner.test.ts tests/quality-job-plan.test.ts
git commit -m "feat: add dramatization review lane"
```

---

### Task 12: Generate and validate small-model-ready chapter contracts

**Files:**
- Create: `src/domain/chapter-contract-proposal.ts`
- Create: `src/application/chapter-contract-runner.ts`
- Create: `src/application/chapter-contract-validation.ts`
- Create: `src/infrastructure/chapter-contract-proposal-store.ts`
- Modify: `src/application/contracts/chapter-contract-compiler.ts`
- Modify: guarded transaction/event integration
- Test: `tests/chapter-contract-runner.test.ts`
- Test: `tests/chapter-contract-validation.test.ts`
- Test: `tests/story-control-contract-event.test.ts`

**Interfaces:**

```ts
export interface ChapterContractProposalOutput {
  schema_version: "1.0.0";
  chapter: number;
  start_state_ids: string[];
  required_end_state: StateMutation[];
  forbidden_changes: string[];
  knowledge_boundary_ids: string[];
  dramatization_requirements: SceneDramatization;
  information_release: ChapterInformationRelease;
  evidence_record_ids: string[];
}

export async function runChapterContractCompilation(input: {
  root: string;
  runId: string;
  chapter: number;
  capsule: ActiveContextCapsule;
  worker: QualityWorker;
}): Promise<ChapterContractProposalArtifact>;

export function validateChapterContractProposal(input: {
  packet: ChapterPacket;
  proposal: ChapterContractProposalArtifact;
  index: StoryRecordIndex;
  modelProfile: ModelExecutionProfile;
}): ChapterContract;
```

- [ ] **Step 1: Add failing generation and validation tests**

Reject unknown record IDs, unsafe records, state mutations targeting unknown fields, a changed packet POV, an omitted explicit thread, an impossible knowledge boundary, missing dramatization, and scene word ranges outside the Gemma profile.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/chapter-contract-runner.test.ts tests/chapter-contract-validation.test.ts`

Expected: FAIL because the chapter execution path assumes an approved contract already exists.

- [ ] **Step 3: Add a bounded contract capsule**

The compiler receives one chapter packet, current state records, active scheduled threads, knowledge boundaries, the approved plot chapter, ending contract, and relevant recent chapter deltas. It returns only the missing small-model fields; deterministic code merges them with immutable packet fields.

- [ ] **Step 4: Commit through a guarded control transaction**

Write the proposal under `.pi-book/runs/<run-id>/chapter-contracts/`. After validation, write `books/<book-id>/contracts/chapters/CH-<nnn>.yaml` through a private guarded transaction with project-hash and source-packet-hash checks. Do not expose this write through the generic public model event.

- [ ] **Step 5: Keep chapter execution preparation strict**

`prepareChapterExecution` must still reject a missing or stale contract. The whole-book stepper introduced later is responsible for compiling the contract before calling chapter preparation.

- [ ] **Step 6: Run contract, event, preparation, and integrity tests**

Run: `node --import tsx --test tests/chapter-contract-runner.test.ts tests/chapter-contract-validation.test.ts tests/story-control-contract-event.test.ts tests/chapter-execution-preparation.test.ts tests/canonical-story-integrity.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/chapter-contract-proposal.ts src/application/chapter-contract-runner.ts src/application/chapter-contract-validation.ts src/infrastructure/chapter-contract-proposal-store.ts src/application/contracts/chapter-contract-compiler.ts tests/chapter-contract-runner.test.ts tests/chapter-contract-validation.test.ts tests/story-control-contract-event.test.ts
git commit -m "feat: compile Gemma-ready chapter contracts"
```

---

### Task 13: Add bounded small-model architecture jobs over existing book strategy and plot artifacts

**Files:**
- Create: `src/domain/architecture-job-artifact.ts`
- Create: `src/application/architecture/ending-contract-runner.ts`
- Create: `src/application/architecture/act-plan-runner.ts`
- Create: `src/application/architecture/chapter-window-runner.ts`
- Create: `src/application/architecture/plan-stress-runner.ts`
- Create: `src/application/architecture/architecture-validation.ts`
- Create: `src/infrastructure/architecture-run-store.ts`
- Modify: `src/domain/model-job.ts`
- Modify: `src/domain/model-execution-profile.ts`
- Modify: `src/application/book-strategy.ts`
- Test: `tests/small-model-architecture.test.ts`
- Test: `tests/book-strategy.test.ts`

**Interfaces:**

```ts
export type ArchitectureJobType =
  | "plan-ending-contract"
  | "plan-act"
  | "plan-chapter-window"
  | "stress-test-plan";

export interface ArchitecturePatchOperation {
  path: string;
  operation: "set" | "append";
  value: unknown;
  evidence_refs: string[];
}

export interface ArchitectureJobOutput {
  schema_version: "1.0.0";
  job_type: ArchitectureJobType;
  operations: ArchitecturePatchOperation[];
}
```

- [ ] **Step 1: Add failing bounded-job tests**

Prove that ending work cannot edit chapter packets, act work cannot edit other acts, one chapter-window job can address at most five consecutive chapters, and the stress job cannot silently approve a failed stress check.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/small-model-architecture.test.ts tests/book-strategy.test.ts`

Expected: FAIL because architecture is not represented as resumable model jobs.

- [ ] **Step 3: Add job types and Gemma budgets**

Give each architecture job at most `5_000` evidence tokens and `1_400` output tokens. Require grammar-constrained JSON and one correction maximum.

- [ ] **Step 4: Apply validated patches to an overlay**

Never ask Gemma to reproduce full YAML files. Apply operations to an in-memory overlay, validate it with existing strategy, plot-grid, queue, expectation, decision, and stress checks, then render canonical YAML deterministically.

- [ ] **Step 5: Preserve the writer architecture gate**

The jobs may prepare a complete plan, but the existing writer approval gate remains required before the plan becomes canonical drafting authority.

- [ ] **Step 6: Run architecture, schema, and phase-4 integration tests**

Run: `node --import tsx --test tests/small-model-architecture.test.ts tests/book-strategy.test.ts tests/phase4-schemas.test.ts tests/phase4-integration.test.ts tests/phase4-prompts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/architecture-job-artifact.ts src/application/architecture src/infrastructure/architecture-run-store.ts src/domain/model-job.ts src/domain/model-execution-profile.ts src/application/book-strategy.ts tests/small-model-architecture.test.ts tests/book-strategy.test.ts
git commit -m "feat: add bounded Gemma architecture jobs"
```

---

### Task 14: Add a resumable whole-book execution state machine

**Files:**
- Create: `src/domain/book-execution-state.ts`
- Create: `src/domain/book-execution-manifest.ts`
- Create: `src/application/book-execution-preparation.ts`
- Create: `src/application/book-execution-stepper.ts`
- Create: `src/infrastructure/book-execution-store.ts`
- Modify: `src/pi/extension.ts`
- Modify: `extensions/novel-forge.ts`
- Modify: `src/application/guide.ts`
- Test: `tests/book-execution-stepper.test.ts`
- Test: `tests/pi-book-step-command.test.ts`
- Test: `tests/pi-book-step-tool.test.ts`

**Interfaces:**

```ts
export type BookExecutionNode =
  | "architecture"
  | "awaiting-architecture-approval"
  | "chapter-contract"
  | "chapter-execution"
  | "act-review"
  | "book-review"
  | "book-repair"
  | "proof"
  | "awaiting-human"
  | "complete"
  | "blocked";

export async function advanceBookExecutionStep(input: {
  root: string;
  runId: string;
  worker: QualityWorker;
  provider?: string;
  model?: string;
  qualityTier: "premium" | "editorial";
}): Promise<{ action: string; state: BookExecutionState; artifact?: unknown }>;
```

- [ ] **Step 1: Add a failing two-chapter journey test**

The journey must prepare architecture, stop at approval, resume after an approved fixture, compile Chapter 1's contract, execute Chapter 1 one persisted node at a time, stop at first-chapter approval, resume, complete Chapter 2, route to book review, and finish proofing. Inject a process exit between two steps and prove no model job replays.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/book-execution-stepper.test.ts tests/pi-book-step-command.test.ts tests/pi-book-step-tool.test.ts`

Expected: FAIL because no whole-book execution state exists.

- [ ] **Step 3: Implement one-step composition**

The book stepper may call exactly one lower-level operation per invocation. It composes architecture runners, chapter-contract compilation, `advanceChapterExecutionStep`, existing act gates, concern review, repair, and proof. It stores project hash, model fingerprint hash, active chapter, child run ID, completed action keys, and stop reason.

- [ ] **Step 4: Add rebase and recovery rules**

Project drift stops the run. An explicit book rebase recompiles only future architecture windows and future chapter contracts. Accepted manuscript, completed chapter deltas, state history, and approved plan changes remain untouched.

- [ ] **Step 5: Expose Pi surfaces**

Add `/novel-book-step` and `novel_advance_book_step`. Default to the exact Gemma profile only when the user selects it. Return run ID, node, chapter, child run ID, status, stop reason, and next action. Do not send a host-authored manuscript prompt.

- [ ] **Step 6: Run stepper, recovery, package, and smoke tests**

Run: `node --import tsx --test tests/book-execution-stepper.test.ts tests/pi-book-step-command.test.ts tests/pi-book-step-tool.test.ts tests/package-smoke.test.ts tests/e2e/packed-clean-start.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/book-execution-state.ts src/domain/book-execution-manifest.ts src/application/book-execution-preparation.ts src/application/book-execution-stepper.ts src/infrastructure/book-execution-store.ts src/pi/extension.ts extensions/novel-forge.ts src/application/guide.ts tests/book-execution-stepper.test.ts tests/pi-book-step-command.test.ts tests/pi-book-step-tool.test.ts
git commit -m "feat: add resumable whole-book execution"
```

---

### Task 15: Execute concern-specific book reviews through bounded windows

**Files:**
- Create: `src/domain/book-concern-review.ts`
- Create: `src/application/book-concern-window.ts`
- Create: `src/application/book-concern-runner.ts`
- Create: `src/application/book-concern-aggregation.ts`
- Modify: `src/application/quality/job-plan.ts`
- Modify: `src/domain/model-job.ts`
- Modify: `src/domain/model-execution-profile.ts`
- Modify: `src/application/audit-events.ts`
- Test: `tests/book-concern-window.test.ts`
- Test: `tests/book-concern-runner.test.ts`
- Test: `tests/book-concern-aggregation.test.ts`

**Interfaces:**

```ts
export type BookConcern =
  | "chronology"
  | "knowledge"
  | "character-arcs"
  | "setup-payoff"
  | "object-location"
  | "terminology"
  | "research"
  | "style-drift"
  | "repetition"
  | "dramatization"
  | "dialogue-subtext";

export interface BookConcernFinding {
  id: string;
  concern: BookConcern;
  severity: "blocker" | "high" | "medium" | "low";
  chapter: number;
  paragraph: number;
  paragraph_hash: string;
  evidence_quote: string;
  required_change: string;
  related_record_ids: string[];
}
```

- [ ] **Step 1: Add failing window and aggregation tests**

No window may exceed three chapters or `8_000` estimated evidence tokens. Windows must use chapter deltas and relevant anchored paragraphs rather than full chapters by default. Duplicate findings must aggregate deterministically while preserving all evidence locations.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/book-concern-window.test.ts tests/book-concern-runner.test.ts tests/book-concern-aggregation.test.ts`

Expected: FAIL because editorial book jobs are currently deferred plan entries only.

- [ ] **Step 3: Implement concern-specific selectors**

Chronology selects timeline changes and explicit time anchors. Knowledge selects knowledge ledger changes and reveal paragraphs. Character arcs select decisions, relationship changes, and active-state history. Dramatization selects deterministic tell-risk concentrations and important scene-contract beats. Dialogue-subtext selects dialogue-heavy anchored paragraphs and relationship movement.

- [ ] **Step 4: Run one model call per concern window**

Require exact JSON, exact manuscript quotes, chapter/paragraph anchors, and related record IDs. Validate each anchor against the current manuscript hash. Store window artifacts under `.pi-book/runs/<run-id>/book-review/<concern>/`.

- [ ] **Step 5: Aggregate into existing revision tickets**

Create tickets only after deterministic aggregation. Preserve the existing guarded review event as the only canonical ticket-writing path. One heuristic marker without model-confirmed context may not create a ticket.

- [ ] **Step 6: Run review, quality-plan, and audit tests**

Run: `node --import tsx --test tests/book-concern-window.test.ts tests/book-concern-runner.test.ts tests/book-concern-aggregation.test.ts tests/quality-job-plan.test.ts tests/phase5-integration.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/book-concern-review.ts src/application/book-concern-window.ts src/application/book-concern-runner.ts src/application/book-concern-aggregation.ts src/application/quality/job-plan.ts src/domain/model-job.ts src/domain/model-execution-profile.ts src/application/audit-events.ts tests/book-concern-window.test.ts tests/book-concern-runner.test.ts tests/book-concern-aggregation.test.ts
git commit -m "feat: execute bounded whole-book concern reviews"
```

---

### Task 16: Repair review tickets one paragraph at a time and re-verify the concern

**Files:**
- Create: `src/application/book-repair-stepper.ts`
- Create: `src/domain/book-repair-artifact.ts`
- Modify: `src/application/scene-span-repair-runner.ts`
- Modify: `src/application/events.ts`
- Modify: `src/application/book-execution-stepper.ts`
- Test: `tests/book-repair-stepper.test.ts`
- Test: `tests/e2e/book-review-repair.test.ts`

**Interfaces:**

```ts
export interface BookRepairLimit {
  maximum_paragraphs: 3;
  maximum_changed_words: number;
  maximum_attempts: 2;
}

export async function advanceBookRepairStep(input: {
  root: string;
  runId: string;
  ticketId: string;
  worker: QualityWorker;
}): Promise<BookRepairArtifact>;
```

- [ ] **Step 1: Add failing bounded-repair tests**

Reject stale paragraph hashes, edits outside ticket paragraphs, more than three changed paragraphs, more than `max(120, ceil(original_ticket_words * 0.35))` changed words, and factual or state changes not authorized by the ticket.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/book-repair-stepper.test.ts tests/e2e/book-review-repair.test.ts`

Expected: FAIL because book tickets do not have a one-step repair executor.

- [ ] **Step 3: Reuse span-patch contracts**

Supply exact ticket findings, target paragraphs, one paragraph of context on either side, relevant story records, and protected facts. Return patch operations only. Apply them to an overlay and re-run manuscript, state, style, and evidence-anchor validation before any canonical event.

- [ ] **Step 4: Re-run the originating concern**

A repair is not complete until the affected concern window passes or produces a smaller bounded ticket. A second failed repair routes to stronger-model or human escalation.

- [ ] **Step 5: Commit through the existing revision event**

Do not add direct manuscript writes. The existing guarded revision transaction remains responsible for accepted prose, evidence-anchor refresh, project hash, status, handoff, and Git checkpoint.

- [ ] **Step 6: Run repair, event, and end-to-end tests**

Run: `node --import tsx --test tests/book-repair-stepper.test.ts tests/e2e/book-review-repair.test.ts tests/event-application.test.ts tests/transaction.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/book-repair-stepper.ts src/domain/book-repair-artifact.ts src/application/scene-span-repair-runner.ts src/application/events.ts src/application/book-execution-stepper.ts tests/book-repair-stepper.test.ts tests/e2e/book-review-repair.test.ts
git commit -m "feat: repair book findings through bounded patches"
```

---

### Task 17: Qualify Gemma from individual jobs through a full canary book

**Files:**
- Create: `evals/gemma/fixtures/multiscene-chapter.yaml`
- Create: `evals/gemma/fixtures/ten-chapter-stress-book.yaml`
- Create: `evals/gemma/rubrics/chapter-review.md`
- Create: `evals/gemma/rubrics/book-review.md`
- Create: `src/evaluation/gemma-book-qualification.ts`
- Create: `scripts/qualify-gemma-book.ts`
- Test: `tests/gemma-book-qualification.test.ts`

**Qualification ladder:**

1. Individual job suite.
2. Three-to-five-scene chapter.
3. Ten-chapter stress book.
4. A `30_000`-word qualification novella.
5. An `80_000`-to-`100_000`-word canary novel.

- [ ] **Step 1: Add failing deterministic harness tests**

Prove resume behavior, report hashing, model fingerprint binding, stage thresholds, blinded review-kit generation, and refusal to promote a profile using a report from another model/backend/chat template.

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx --test tests/gemma-book-qualification.test.ts`

Expected: FAIL because no book qualification ladder exists.

- [ ] **Step 3: Enforce chapter and stress-book gates**

A qualified run requires:

- zero illegal canonical mutations;
- zero missing required beats;
- zero unsupported established-canon claims;
- zero forbidden knowledge-boundary crossings;
- zero unresolved high or blocker continuity findings;
- successful forced-process-exit recovery without model-job replay;
- retrieval required recall `1.00` and unsafe inclusion `0`;
- at least `80%` of blind human dramatization ratings at `4/5` or better;
- at least `80%` of blind human voice ratings at `4/5` or better.

- [ ] **Step 4: Enforce novella and canary gates**

The novella and full canary additionally require:

- no manual state-ledger repair;
- all due threads resolved, advanced, or explicitly carried forward;
- every review ticket closed or escalated with a recorded reason;
- final proofing and package checklist pass;
- accepted-prose efficiency and total model usage recorded;
- two successful full canary seeds before the Gemma profile is marked production-qualified.

- [ ] **Step 5: Run scripted harness tests**

Run: `node --import tsx --test tests/gemma-book-qualification.test.ts`

Expected: PASS.

- [ ] **Step 6: Run real Gemma qualification manually**

```bash
NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1 npm run eval:gemma -- \
  --provider <configured-local-provider> \
  --model google/gemma-3-12b-it-qat-q4_0-gguf \
  --fingerprint .pi-book/model-fingerprints/gemma-3-12b-it-qat-q4_0.json \
  --seed gemma-job-001
```

```bash
NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1 node --import tsx scripts/qualify-gemma-book.ts \
  --provider <configured-local-provider> \
  --model google/gemma-3-12b-it-qat-q4_0-gguf \
  --fingerprint .pi-book/model-fingerprints/gemma-3-12b-it-qat-q4_0.json \
  --fixture evals/gemma/fixtures/ten-chapter-stress-book.yaml \
  --seed gemma-book-001
```

Expected: commands write private run artifacts and a privacy-safe signed report. Replace `<configured-local-provider>` at execution time with the exact provider registered in Pi; the report records that exact value.

- [ ] **Step 7: Commit the harness, not private run output**

```bash
git add evals/gemma/fixtures evals/gemma/rubrics src/evaluation/gemma-book-qualification.ts scripts/qualify-gemma-book.ts tests/gemma-book-qualification.test.ts
git commit -m "test: qualify Gemma through complete book runs"
```

---

### Task 18: Add the v1.8 release gate and user-facing operation docs

**Files:**
- Create: `scripts/verify-v1-8-release.ts`
- Create: `tests/v1-8-release-checklist.test.ts`
- Create: `docs/releases/v1.8.0.md`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add failing release-checklist assertions**

Require the exact Gemma profile, token estimator, handoff, retrieval benchmark, dramatization contract, critic lane, chapter-contract compiler, architecture jobs, book stepper, concern reviews, repair stepper, package surfaces, and qualification documentation.

- [ ] **Step 2: Run the focused release test**

Run: `node --import tsx --test tests/v1-8-release-checklist.test.ts`

Expected: FAIL until all required surfaces and docs exist.

- [ ] **Step 3: Update package and CI commands**

Add `benchmark:retrieval`, `eval:gemma`, and `verify:v1-8`. Include `evals/gemma/README.md`, frozen fixtures, and rubrics in package files; exclude run outputs, prose review kits, fingerprints, and local model metadata.

- [ ] **Step 4: Document operation and escalation**

Document:

- exact model target and compatibility alias;
- how to create a fingerprint;
- why `16_384` is the initial reliable context;
- one-step book execution and resume;
- deterministic RAG behavior and retrieval inspection;
- show-don't-tell contract behavior;
- human gates;
- stronger-model escalation;
- qualification commands and privacy boundaries.

- [ ] **Step 5: Run the full release matrix**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run benchmark:constrained-runtime
npm run benchmark:prompts
npm run benchmark:retrieval
npm run verify:release
npm run test:release
npm pack --dry-run
```

Expected: all commands PASS on Node 22.19.0 and Node 24.

- [ ] **Step 6: Review exact changed head**

Confirm no raw prompts, prose, private research, fingerprints, qualification samples, or local model files are tracked. Confirm no unresolved review threads and no weakened compatibility assertions.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-v1-8-release.ts tests/v1-8-release-checklist.test.ts docs/releases/v1.8.0.md package.json README.md SKILL.md CHANGELOG.md RELEASE.md .github/workflows/test.yml
git commit -m "release: qualify Gemma small-model book pipeline"
```

---

## Final Acceptance Criteria

The program is complete only when all of the following are true:

- A fresh project can move from bounded architecture through final proof using the one-step whole-book state machine.
- Every chapter begins from an approved, small-model-ready contract generated or verified by deterministic code.
- Every scene after the first receives the previous accepted prose tail and an evidence-backed immediate handoff.
- Required context is exact and complete; optional context is selected through deterministic sparse retrieval with an auditable manifest.
- Retrieval benchmarks achieve perfect required recall and zero unsafe or future-book inclusion.
- Important scene beats carry typed observable action, resistance, sensory evidence, subtext, consequence, and causal linkage.
- Premium and editorial Gemma runs include a dedicated dramatization critic.
- Repairs remain bounded to exact paragraphs or spans and re-run the originating concern.
- Full-book reviews execute by concern windows rather than a whole-manuscript prompt.
- The exact Gemma model/backend/chat-template fingerprint is bound to qualification and run records.
- Two full canary seeds pass before production qualification is recorded.
- Existing v1.7 projects and artifacts remain readable.
- All release commands pass on both supported Node versions.

## Plan Self-Review

- **Spec coverage:** Exact model identity, token accounting, deterministic RAG, immediate narrative continuity, show-don't-tell, chapter-contract generation, architecture, whole-book execution, book review, bounded repair, real-model qualification, and release documentation each have a task.
- **Scope:** The work is split into eleven mergeable PR increments with explicit dependencies. No PR must implement the entire program.
- **Type consistency:** `ModelFingerprint`, `NarrativeHandoff`, `StoryRetrievalQuery`, `SceneDramatization`, `ScenePlanDramatization`, `ChapterContractProposalOutput`, `BookExecutionState`, and `BookConcernFinding` are defined before downstream use.
- **Authority boundary:** No new model job writes canon or manuscript directly. All canonical changes remain behind guarded validation and transaction paths.
- **RAG decision:** Exact plus graph plus deterministic sparse retrieval is required for v1.8. Embeddings are deferred unless the retrieval benchmark proves the sparse approach misses the declared paraphrase threshold.

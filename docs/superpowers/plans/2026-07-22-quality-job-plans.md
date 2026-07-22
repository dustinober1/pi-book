# Quality Job Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Novel Forge quality tiers compile and execute as explicit bounded job plans rather than as larger prompts or independent policy branches.

**Architecture:** Keep `src/application/quality/job-plan.ts` as the deterministic tier/risk compiler. The existing quality risk selector remains responsible for chapter risk. `runQualityDraft` consumes the compiled plan for candidate count, isolated critic lanes, factuality/claim audit, bounded repair, final verification, runtime call ceilings, and a non-canonical plan manifest. Editorial full-book jobs are scheduled in the plan but deferred from chapter drafting to manuscript review.

**Tech Stack:** TypeScript, TypeBox-compatible domain contracts, Node test runner, existing Novel Forge quality worker, telemetry, cache, guarded event, and GitHub Actions matrix.

## Global Constraints

- Preserve existing public tier IDs: `economy`, `balanced`, `premium`, `editorial`.
- Preserve the existing direct economy workflow.
- No prompt, prose, private evidence, or hidden reasoning may enter the plan manifest.
- Only the existing guarded final event may mutate canonical manuscript or control state.
- Maximum one structured-output correction attempt per model job.
- Maximum two bounded repair attempts for non-economy tiers.
- A second candidate is allowed only for key premium or editorial scenes.
- Risk may select jobs but may not raise the tier's configured call or generated-token ceiling.
- Existing projects and persisted quality settings remain readable.

---

### Task 1: Lock the integration contract

**Files:**
- Modify: `tests/quality-job-plan.test.ts`
- Modify: `tests/quality-job-plan-compatibility.test.ts`
- Create: `tests/quality-job-plan-orchestrator.test.ts`

**Interfaces:**
- Consumes: `buildQualityJobPlan({ tier, risk })`, `runQualityDraft(input)`.
- Produces: assertions that orchestrator candidate count, critic lanes, factuality, final review, deferred book jobs, runtime ceilings, and manifest output match one plan.

- [ ] **Step 1:** Add failing tests for plan-to-orchestrator mapping and runtime ceiling enforcement.
- [ ] **Step 2:** Run the focused tests and confirm they fail because the orchestrator does not consume or expose `QualityJobPlan`.
- [ ] **Step 3:** Commit the RED tests.

### Task 2: Align executable job IDs with existing quality lanes

**Files:**
- Modify: `src/application/quality/job-plan.ts`
- Modify: `src/application/quality-risk.ts`
- Modify: `src/domain/quality-artifacts.ts`
- Modify: `src/application/quality-prompts.ts`

**Interfaces:**
- Produces: `qualityJobCriticLanes(plan)`, `qualityJobIsScheduled(plan, id)`, and lane support for `character-intent`, `style`, and `factuality` while retaining legacy `voice` and `research` readability.

- [ ] **Step 1:** Run the focused tests and confirm the new lane/job assertions fail.
- [ ] **Step 2:** Add the minimal lane schema and plan-query helpers.
- [ ] **Step 3:** Run focused and existing quality-risk/artifact tests.
- [ ] **Step 4:** Commit the green lane integration.

### Task 3: Make `runQualityDraft` consume and enforce the job plan

**Files:**
- Modify: `src/application/quality-orchestrator.ts`
- Modify: `src/application/budgeted-quality-draft.ts` only if needed for result typing.
- Test: `tests/quality-orchestrator.test.ts`
- Test: `tests/e2e/editorial-claim-audit.test.ts`
- Test: `tests/quality-job-plan-orchestrator.test.ts`

**Interfaces:**
- `RunQualityDraftResult` adds `jobPlan: QualityJobPlan` and `jobPlanManifestPath: string`.
- Every worker call reserves one plan call and actual output tokens against `jobPlan.limits` before the next call.
- Candidate count and chapter critic lanes come from `jobPlan`.
- Claim auditing runs only when the plan schedules factuality/claim work.
- Final verification runs only when scheduled.
- Book-scope and human-scope jobs remain deferred and are returned in the manifest.

- [ ] **Step 1:** Run the focused orchestrator test and confirm the result and call sequence fail.
- [ ] **Step 2:** Compile one job plan after risk and claim-audit selection.
- [ ] **Step 3:** Write the deterministic manifest under `.pi-book/runs/<run-id>/quality-job-plan.json` before inference.
- [ ] **Step 4:** Route candidate, critic, claim-audit, and verification behavior from the plan.
- [ ] **Step 5:** Enforce model-call and generated-token ceilings on every call, including corrections.
- [ ] **Step 6:** Run focused orchestrator, claim-audit, budget, telemetry, and persistent-run tests.
- [ ] **Step 7:** Commit the green orchestrator integration.

### Task 4: Release qualification and merge

**Files:**
- Modify: PR description only unless a release-surface regression requires a focused test update.

- [ ] **Step 1:** Run the complete GitHub Actions matrix on Node 22.19.0 and Node 24.
- [ ] **Step 2:** Verify TypeScript, full tests, deterministic evaluation, constrained-runtime benchmark, prompt benchmark, release verifier, release checklist/packed install tests, and `npm pack --dry-run` all pass.
- [ ] **Step 3:** Review changed files and unresolved review threads.
- [ ] **Step 4:** Mark PR ready and merge only the exact verified head.

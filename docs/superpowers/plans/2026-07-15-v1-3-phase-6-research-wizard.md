# Novel Forge 1.3 Phase 6 Guided Research Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loopback-only `research` wizard that previews and applies influence, anonymous voice-calibration, public-review friction, research-readiness, and revision-learning decisions through existing typed transactions.

**Architecture:** Extend the existing wizard workflow union and static browser with one new workflow. Add a focused `research/wizard.ts` handler that builds a sanitized snapshot, stores short-lived preview records in memory, and applies only confirmed typed proposals through `applyNovelEvent(... eventType: "research-update")`. Reuse the existing taste, voice-experiment, review-observation, research-evidence, and revision-learning services; do not duplicate their validation rules in browser JavaScript.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox/YAML, static local HTML/CSS/JavaScript, Node test runner, existing loopback wizard server, existing Novel Forge transactions, GitHub Actions matrix.

## Global Constraints

- Version remains exactly `1.3.0`; no release tag in this PR.
- `/novel` remains the normal author interface; `/novel-wizard research` is optional.
- Add `research` to `WizardWorkflow`; do not add a top-level creative stage.
- Bind only to `127.0.0.1` with the existing fragment credential, exact-origin checks, idle expiration, and session-owned uploads.
- The browser may read sanitized snapshots, request previews, and submit confirmed proposal envelopes only.
- The browser must never write project files directly, invoke arbitrary commands, or submit manuscript paths.
- Every apply action must use the envelope’s expected stage and project hash and return through `research-update` with rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.
- Named influence references may appear only in private taste evidence and the local influence form; anonymous variant labels and prose must not reveal author or book names.
- Public review observations remain identity-stripped market evidence and never affect manuscript reader metrics.
- Research items marked ready must pass the existing provenance/readiness validator.
- Learning candidates may be displayed, but only an explicit writer-confirmed approved record enters future drafting context.
- Snapshots must not expose manuscript prose, reader-response bodies, raw public-review bodies, reviewer identity, source-scene prose, or raw influence-derived drafting instructions.
- Existing adoption, readers, packaging, and next-book workflows must remain unchanged and passing.
- No remote scripts, fonts, analytics, hosted database, new runtime dependency, or web scraping.
- Use TDD and verify RED before production implementation.

---

### Task 1: Extend wizard workflow contracts and sanitized snapshot

**Files:**
- Modify: `src/wizard/types.ts`
- Modify: `src/wizard/session.ts`
- Modify: `src/application/wizard.ts`
- Create: `src/application/research/wizard.ts`
- Test: `tests/research-wizard.test.ts`

**Interfaces:**

```ts
export type WizardWorkflow = "adoption" | "readers" | "packaging" | "next-book" | "research";

export interface ResearchWizardOptions {
  resolveSource?(sourceId: string): { absolutePath: string; originalName?: string } | null;
}

export function createResearchWizardHandler(root: string, options?: ResearchWizardOptions): WizardWorkflowHandler;
export function researchWizardSnapshot(root: string): ResearchWizardSnapshot;
```

- [ ] **Step 1: Write failing workflow and snapshot tests**

Prove:

- `research` is accepted by the session workflow parser;
- the research snapshot contains project stage/hash, taste entries, experiment metadata, observation/cluster summaries, research item/source summaries, and eligible learning candidates;
- the snapshot excludes manuscript text, voice source/variant/baseline prose, reader response bodies, reviewer identity fields, and raw unimported review bodies;
- existing workflow snapshots remain unchanged.

- [ ] **Step 2: Verify RED through draft PR Actions**

Expected: `research` is not assignable to `WizardWorkflow` and `createResearchWizardHandler` does not exist.

- [ ] **Step 3: Extend the workflow union and server allowlist**

Add `research` to `WizardWorkflow` and the session’s workflow set. Do not change upload extensions or security checks.

- [ ] **Step 4: Implement the sanitized snapshot**

Read and validate:

- `series/taste-profile.yaml`;
- `series/voice-experiments/index.yaml` and experiment metadata only;
- active-book `book-strategy.yaml`;
- active-book `research-ledger.yaml`;
- `research/source-register.yaml`;
- active-book `revision-tickets.yaml`.

Return only typed summaries. Use `revisionLearningCandidates` for eligible patterns. Never read manuscript chapter bytes or reader response CSV/body data for the snapshot.

- [ ] **Step 5: Register the snapshot and run focused tests**

```bash
node --import tsx --test tests/research-wizard.test.ts tests/wizard-runtime.test.ts
```

Expected: PASS.

---

### Task 2: Add typed previews for all research surfaces

**Files:**
- Modify: `src/application/research/wizard.ts`
- Test: `tests/research-wizard.test.ts`

**Preview actions and outputs:**

```ts
preview("influence", payload) -> { preview_id, candidate, findings }
preview("voice-comparison", { experiment_id }) -> { preview_id, experiment_id, variants: { id, prose }[], existing_scores, summary }
preview("review-csv", { source_id | csv_text }) -> { preview_id, observations, discarded_identity_fields, warnings }
preview("review-cluster", { label, observation_ids }) -> { preview_id, cluster, positive_counterweights }
preview("research-item", payload) -> { preview_id, item, sources, findings }
preview("learning-decision", payload) -> { preview_id, record, candidate, findings }
```

- [ ] **Step 1: Write failing preview tests**

Prove:

- influence preview requires reference, influence type, admired qualities, excluded qualities, and neutral derived traits;
- voice comparison returns A/B/C only and excludes source scene, baseline, influence names, and experiment file paths;
- review CSV preview strips identity and preserves 1–2 negative, 3 mixed, 4–5 positive bands;
- cluster preview uses existing deterministic confidence and positive-counterweight rules;
- research preview reports blockers for unsupported ready claims and permits incomplete planned/researching claims;
- learning preview rejects an approval below threshold and accepts exact eligible evidence;
- every preview receives an opaque session-local `preview_id`.

- [ ] **Step 2: Verify RED**

Expected: preview actions are unavailable.

- [ ] **Step 3: Implement in-memory preview entries**

Use `randomBytes` IDs and a discriminated preview-entry union. Never trust apply payload creative data when a preview exists; apply from the stored preview candidate plus the explicit decision fields allowed by that action.

- [ ] **Step 4: Reuse canonical services**

Use:

- `voiceSafetyFindings` and typed schemas for influence candidates;
- `summarizeVoiceScores`, `voiceExperimentFindings`, and `stableContentHash` for calibration;
- `importReviewObservationCsv`, `buildReviewCluster`, and `readerFrictionFindings` for market evidence;
- `researchEvidenceFindings` for research readiness;
- `revisionLearningCandidates` and `revisionLearningFindings` for learning decisions.

- [ ] **Step 5: Run focused preview tests**

```bash
node --import tsx --test tests/research-wizard.test.ts
```

Expected: PASS.

---

### Task 3: Apply confirmed proposals through guarded research-update events

**Files:**
- Modify: `src/application/research/wizard.ts`
- Modify: `src/application/wizard-launch.ts`
- Test: `tests/research-wizard.test.ts`
- Test: `tests/e2e/research-wizard.test.ts`

**Apply actions:**

```text
save-influence
save-voice-scores
accept-voice-baseline
import-review-observations
save-review-cluster
save-friction-decision
save-research-item
save-learning-decision
```

- [ ] **Step 1: Write failing guarded-apply tests**

Prove:

- stale stage/hash fails before mutation;
- unknown/expired preview IDs fail;
- applying influence changes only `taste-profile.yaml`;
- scoring voice updates only experiment evidence;
- accepting baseline updates experiment YAML/baseline, index, taste selection, and guardrail baseline consistently;
- review import updates only `book-strategy.yaml`, never `reader-experiments.yaml`;
- friction prevent/mitigate requires a concise guardrail and creates/updates the approved review-derived guardrail only after confirmation;
- ready research cannot be applied without valid source support;
- learning approval requires exact threshold evidence and never changes manuscript files;
- each successful action keeps stage and gates unchanged and produces one `Novel Forge: research-update` checkpoint.

- [ ] **Step 2: Verify RED**

Expected: research apply handler is unavailable.

- [ ] **Step 3: Implement guarded apply helpers**

For every action:

1. retrieve the stored preview;
2. load current canonical state;
3. build complete replacement YAML/text files;
4. call `applyNovelEvent` using envelope stage/hash and `eventType: "research-update"`;
5. delete the preview after success;
6. return changed paths, stage, and new project hash.

Do not write files directly.

- [ ] **Step 4: Implement voice baseline acceptance safely**

Allow selection of A/B/C or writer-supplied combined baseline text. Require 600–900 words, no raw influence reference, and exact hashes. Store baseline metrics with `extractVoiceMetrics`. Preserve anonymous variant labels and writer scores; scores never choose the baseline automatically.

- [ ] **Step 5: Register handler in `launchNovelWizard`**

Add `research: createResearchWizardHandler(...)`, passing only the existing session upload resolver.

- [ ] **Step 6: Run focused handler and HTTP tests**

```bash
node --import tsx --test tests/research-wizard.test.ts tests/e2e/research-wizard.test.ts
```

Expected: PASS.

---

### Task 4: Add the local research browser surface

**Files:**
- Modify wizard markup: `wizard/index.html`
- Modify wizard behavior: `wizard/app.js`
- Modify wizard presentation: `wizard/styles.css`
- Test: `tests/research-wizard-assets.test.ts`
- Test: `tests/e2e/research-wizard.test.ts`

- [ ] **Step 1: Write failing static-asset tests**

Prove:

- index contains a `data-workflow="research"` tab;
- app recognizes `research` and renders five sections: Influence Palette, Anonymous Voice Comparison, Reader Friction, Research Ledger, Revision Learning;
- browser code calls only `/api/snapshot`, `/api/preview`, `/api/apply`, `/api/upload`, and `/api/close`;
- no remote URLs, scripts, fonts, analytics, `eval`, dynamic script insertion, filesystem paths, or arbitrary commands appear;
- UI labels clearly distinguish public market evidence from real manuscript reader evidence;
- voice variants display only A/B/C labels.

- [ ] **Step 2: Verify RED**

Expected: research tab/form assertions fail.

- [ ] **Step 3: Add the workflow tab and forms**

Build an accessible compact interface that:

- adds/edits influences and excluded qualities;
- shows anonymous A/B/C prose and writer scoring fields;
- imports a CSV and previews identity removal;
- groups observations and records cluster decisions;
- edits research readiness/provenance;
- displays eligible learning candidates and explicit approve/reject controls.

- [ ] **Step 4: Keep preview-before-apply controls**

All mutation buttons stay disabled until their corresponding preview succeeds. Use the existing `applyAction` confirmation and proposal envelope.

- [ ] **Step 5: Run static and HTTP tests**

```bash
node --import tsx --test tests/research-wizard-assets.test.ts tests/e2e/research-wizard.test.ts tests/wizard-runtime.test.ts
```

Expected: PASS.

---

### Task 5: Commands, guided labels, package smoke, and final verification

**Files:**
- Modify command registration: `src/pi/extension.ts`
- Modify guided action labels: `src/application/guide.ts`
- Modify status guidance: `src/application/status.ts`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Test: `tests/commands.test.ts`
- Test: `tests/gate-guidance.test.ts`
- Test: `tests/package-smoke.test.ts`

- [ ] **Step 1: Write failing command and guidance tests**

Prove:

- `/novel-wizard research` launches the research workflow;
- unknown wizard names still fail;
- `/novel` offers a context-sensitive research action when taste, calibration, research, friction, or learning evidence needs attention;
- primary drafting/gate actions remain primary; research is optional except when an existing deterministic blocker requires repair;
- package smoke contains updated wizard HTML/JS/CSS and the research handler.

- [ ] **Step 2: Verify RED**

Expected: command/guidance/package assertions fail.

- [ ] **Step 3: Update command completion and guided labels**

Add `research` to documented and runtime wizard choices. Keep `/novel` primary. Use author-facing labels such as `Review voice and research evidence` rather than schema terminology.

- [ ] **Step 4: Update documentation and release checklist**

Document local-only security, sanitized snapshots, preview/apply boundary, each research surface, and evidence separation. Add Phase 6 release checks.

- [ ] **Step 5: Run complete final matrix**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass.

- [ ] **Step 6: Inspect final diff and merge exact tested head**

Confirm no temporary workflow, helper script, snapshot artifact, uploaded source, generated voice experiment, review corpus, manuscript, or package output remains. Resolve review threads, update PR with the final run/SHA, mark ready, and merge with head protection.

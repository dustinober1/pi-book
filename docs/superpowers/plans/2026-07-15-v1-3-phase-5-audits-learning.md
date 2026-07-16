# Novel Forge 1.3 Phase 5 Audits and Revision Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic voice evidence, milestone-aware voice-audit scheduling, scene/state-change diversity checks, exact revision recurrence thresholds, and writer-approved guardrail promotion without automatically rewriting prose.

**Architecture:** Add one compatibility-first audit schema layer and three pure services: `voice-drift.ts` extracts and compares non-prescriptive metrics, `scene-diversity.ts` diagnoses packet/plot repetition, and `revision-learning.ts` tracks recurring ticket patterns and produces writer-decision proposals. Existing `review` and state-neutral `research-update` events remain the only mutation paths; `/novel` schedules due audits and promotion decisions without adding a creative stage.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox, YAML, Node test runner, existing Novel Forge transactions and GitHub Actions matrix.

## Global Constraints

- Version remains exactly `1.3.0`; no release tag in this PR.
- `/novel` remains the normal interface.
- No new top-level creative stage or remote service.
- Metrics are evidence, never prose quotas or automatic severity conclusions.
- Required audit milestones are Chapter 1, Chapter 3, act boundaries, manuscript review, and explicit recalibration.
- More than two consecutive identical scene engines must be flagged.
- Dialogue/interview scenes without case, relationship, power, character, pressure, or plot-state movement must be flagged.
- A recurrence becomes eligible after exactly three distinct chapters or two distinct milestone reviews.
- Promotion requires an explicit writer approve/reject decision.
- Proposed or rejected guardrails never enter drafting context.
- Promotion never writes manuscript prose or retroactively edits earlier chapters.
- Existing 1.2 and earlier 1.3 audit/ticket/strategy files remain readable.
- Use TDD: every behavior begins with a failing test confirmed in GitHub Actions.

---

### Task 1: Compatibility-first Phase 5 contracts

**Files:**
- Create: `src/domain/v1-3-audit-schemas.ts`
- Modify: `src/domain/v1-3-schema-registry.ts`
- Modify: `src/project/templates.ts`
- Test: `tests/phase5-schemas.test.ts`

**Interfaces:**

```ts
export interface VoiceMetricVector {
  sample_words: number;
  sentence_count: number;
  paragraph_count: number;
  sentence_mean: number;
  sentence_median: number;
  sentence_p90: number;
  paragraph_mean: number;
  paragraph_median: number;
  dialogue_ratio: number;
  fragment_ratio: number;
  rhetorical_question_rate: number;
  filter_word_rate: number;
  body_language_repetition_rate: number;
  interiority_density: number;
}

export type VoiceAuditMilestone = "chapter-1" | "chapter-3" | "act-boundary" | "manuscript-review" | "recalibration";
```

- [ ] Write failing tests proving old voice-audit, revision-ticket, and book-strategy YAML still parse; extended records parse; malformed recurrence and metric rates fail.
- [ ] Run the draft PR matrix and confirm RED because the new module does not exist.
- [ ] Add `VoiceAuditsPhase5Schema`, `RevisionTicketsPhase5Schema`, and `BookStrategyPhase5Schema` using optional extension fields.
- [ ] Register Phase 5 schemas before legacy schemas.
- [ ] Keep new-project templates empty and backward compatible.
- [ ] Commit with `feat: add Phase 5 audit contracts`.

### Task 2: Deterministic voice evidence

**Files:**
- Create: `src/application/voice-drift.ts`
- Create: `scripts/voice-drift-audit.ts`
- Modify: `package.json`
- Test: `tests/voice-drift.test.ts`

**Interfaces:**

```ts
export function extractVoiceMetrics(text: string): VoiceMetricVector;
export function compareVoiceMetrics(input: {
  baseline: VoiceMetricVector;
  observed: VoiceMetricVector;
  protectedSignals?: string[];
}): {
  deltas: Record<string, number>;
  protected_signals: string[];
  interpretation: "evidence-only";
};
```

- [ ] Write failing tests for deterministic metrics, project versus optional POV baselines, protected exceptions, and absence of automatic severity/verdict fields.
- [ ] Confirm RED.
- [ ] Implement sentence/paragraph distributions, dialogue ratio, short-fragment ratio, rhetorical questions, filter words, repeated body-language vocabulary, and interiority density.
- [ ] Implement evidence-only comparison with stable rounding.
- [ ] Add `npm run audit:voice -- <project-root> [milestone]` that prints JSON and never writes files.
- [ ] Commit with `feat: add deterministic voice evidence`.

### Task 3: Milestone scheduling and gate enforcement

**Files:**
- Modify: `src/application/voice-drift.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/gates.ts`
- Modify: `src/application/gate-metadata.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/authorization.ts`
- Modify: `src/pi/extension.ts`
- Test: `tests/gate-guidance.test.ts`
- Test: `tests/voice-milestones.test.ts`

**Interfaces:**

```ts
export interface VoiceAuditRequirement {
  milestone: VoiceAuditMilestone;
  milestone_ref: string;
  chapter_refs: number[];
  scope: string;
}

export function nextVoiceAuditRequirement(root: string): VoiceAuditRequirement | null;
export function assertVoiceAuditCompleteForGate(root: string, gate: string): void;
export function voiceAuditPrompt(root: string, requirement: VoiceAuditRequirement): string;
```

- [ ] Write failing tests for Chapter 1, Chapter 3, act-boundary, manuscript-review, and recalibration scheduling.
- [ ] Prove a pending gate cannot be approved while its audit is missing, but an older project without `voice-audits.yaml` remains compatible.
- [ ] Implement due-audit detection using approved audit records and stable milestone refs.
- [ ] Make `/novel` queue a due voice audit before normal continuation.
- [ ] Add `recalibration` to `/novel-review` completions and authorization.
- [ ] Add `voice-audits.yaml` to relevant gate evidence hashes.
- [ ] Commit with `feat: schedule milestone voice audits`.

### Task 4: Scene and state-change diversity

**Files:**
- Create: `src/application/scene-diversity.ts`
- Test: `tests/scene-engine.test.ts`

**Interfaces:**

```ts
export interface SceneDiversityFinding {
  code: string;
  severity: "high" | "medium" | "low";
  chapters: number[];
  evidence: string;
  problem: string;
  required_change: string;
}

export function sceneDiversityFindings(queue: ChapterQueueState, plot: PlotGridPhase4): SceneDiversityFinding[];
```

- [ ] Write failing tests for three consecutive identical engines, whole-book dominance, state-neutral interviews/conversations, and indistinguishable adjacent chapter state vectors.
- [ ] Confirm two consecutive identical engines do not trigger the consecutive rule.
- [ ] Implement normalized engine and state-vector analysis from existing packet and plot fields.
- [ ] Commit with `feat: add scene diversity audits`.

### Task 5: Revision recurrence and promotion

**Files:**
- Modify: `src/review/review.ts`
- Create: `src/application/revision-learning.ts`
- Modify: `src/application/book-strategy.ts`
- Test: `tests/guardrail-promotion.test.ts`

**Interfaces:**

```ts
export interface SynthesizeTicketOptions { milestoneReviewId?: string; }
export function synthesizeTickets(existing: RevisionTicketsState, findings: ReviewFinding[], bookNumber?: number, options?: SynthesizeTicketOptions): RevisionTicketsState;
export function promotionCandidates(tickets: RevisionTicketsPhase5): GuardrailPromotionCandidate[];
export function applyGuardrailDecision(strategy: BookStrategyPhase5, candidate: GuardrailPromotionCandidate, decision: "approved" | "rejected", decidedAt: string): BookStrategyPhase5;
```

- [ ] Write failing tests proving eligibility begins at three distinct chapters or two milestone reviews, not before.
- [ ] Prove repeated findings in one chapter count once.
- [ ] Prove candidate guardrails do not render before approval and approved rules render afterward.
- [ ] Prove strategy promotion changes no manuscript file.
- [ ] Implement stable pattern keys, recurrence refresh, deduplicated candidates, and explicit decisions.
- [ ] Commit with `feat: learn guardrails from recurring tickets`.

### Task 6: Transaction and review integration

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/application/run.ts`
- Modify: `src/application/status.ts`
- Modify: `src/application/project-hash.ts`
- Test: `tests/phase5-integration.test.ts`
- Test: `tests/phase5-prompts.test.ts`

- [ ] Write failing tests proving review events validate audit/ticket recurrence data and research-update can approve/reject a proposed book guardrail without manuscript writes.
- [ ] Validate changed `voice-audits.yaml`, `revision-tickets.yaml`, and `book-strategy.yaml` through one Phase 5 validator.
- [ ] Add scene and voice evidence instructions to milestone review prompts.
- [ ] Surface one pending promotion decision through `/novel` after blocking work is clear.
- [ ] Keep automatic drafting from running heavyweight audits after every chapter.
- [ ] Commit with `feat: integrate Phase 5 review learning`.

### Task 7: Documentation, review, and final verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `RELEASE.md`
- Create: `docs/novel-forge-phase5-audits-and-learning.md`

- [ ] Document evidence-only metrics, milestone rules, scene findings, exact recurrence thresholds, writer approval, and no-retroactive-rewrite behavior.
- [ ] Resolve every actionable review thread.
- [ ] Remove temporary workflows, RED markers, diagnostics, and generated audit output.
- [ ] Run the exact final head under Node 22.19.0 and Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

- [ ] Mark the PR ready and merge only the tested SHA.

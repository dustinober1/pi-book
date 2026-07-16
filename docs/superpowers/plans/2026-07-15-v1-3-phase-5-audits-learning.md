# Novel Forge 1.3 Phase 5 Voice, Scene, and Revision-Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic voice-drift evidence, scene/state-change audits, and exact recurrence-based revision learning that can propose—never automatically approve—future drafting guardrails.

**Architecture:** Add compatibility-first Phase 5 schemas for richer voice audits, recurrence metadata, and revision-learning guardrails. Implement three pure services: `voice-audit.ts` extracts and compares non-prescriptive prose metrics; `scene-audit.ts` detects repeated scene engines and state-neutral conversations; `revision-learning.ts` groups recurring tickets and validates promotion thresholds. Integrate them at existing draft/review/research-update boundaries without adding a stage, remote service, or automatic prose rewrite.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox, YAML, Node test runner, existing Novel Forge transactions, GitHub Actions matrix.

## Global Constraints

- Version remains exactly `1.3.0`; no release tag in this PR.
- `/novel` remains the primary author interface; do not add a top-level creative stage.
- Voice metrics are evidence, not prose quotas and not automatic severity conclusions.
- Never automatically rewrite manuscript prose from an audit.
- Run voice audits after Chapter 1, Chapter 3, act-boundary review, manuscript review, and explicit recalibration when a usable accepted baseline exists.
- Intentional exceptions may be recorded and protected.
- More than two consecutive identical scene engines is a deterministic finding.
- Dialogue/interview/meeting scenes without a case, relationship, power, or knowledge state change are findings.
- Consecutive chapters with indistinguishable state changes are findings.
- A recurrence becomes promotion-eligible after exactly three distinct-chapter occurrences or exactly two distinct milestone reviews.
- Eligibility never activates a guardrail. Promotion requires explicit writer approval stored in `book-strategy.yaml`.
- Approved learning guardrails affect future drafting context only; earlier unaffected prose remains unchanged.
- Existing projects and legacy voice-audit/revision-ticket files remain readable.
- Every accepted mutation preserves stage/hash checks, typed allowlists, rollback, one Git checkpoint, and regenerated `STATUS.md` and `HANDOFF.md`.
- Use TDD: every production behavior must be preceded by a failing behavioral test.

---

### Task 1: Add Phase 5 compatibility contracts

**Files:**
- Create: `src/domain/v1-3-audit-schemas.ts`
- Modify: `src/domain/v1-3-schema-registry.ts`
- Modify: `src/project/templates.ts`
- Test: `tests/phase5-schemas.test.ts`

**Interfaces:**

```ts
export interface TicketRecurrence {
  pattern_id: string;
  milestone_review: string | null;
}

export interface RevisionLearningGuardrail {
  id: string;
  pattern_id: string;
  rule: string;
  source_ticket_ids: string[];
  distinct_chapters: number[];
  milestone_reviews: string[];
  status: "proposed" | "approved" | "rejected";
}
```

- [ ] **Step 1: Write failing compatibility and schema tests**

Create `tests/phase5-schemas.test.ts` proving:

```ts
test("legacy Phase 4 strategy, revision tickets, and voice audits remain readable", () => {
  parseYaml(stringifyYaml(completeStrategy()), BookStrategyPhase5Schema, "book-strategy.yaml");
  parseYaml(stringifyYaml({ schema_version: "1.0.0", tickets: [] }), RevisionTicketsPhase5Schema, "revision-tickets.yaml");
  parseYaml(stringifyYaml({ schema_version: "1.0.0", audits: [] }), VoiceAuditsPhase5Schema, "voice-audits.yaml");
});

test("Phase 5 contracts accept recurrence, metric deltas, exceptions, and proposed learning rules", () => {
  const tickets = { schema_version: "1.0.0", tickets: [ticketWithRecurrence("PAT-dialogue-loop", 2)] };
  parseYaml(stringifyYaml(tickets), RevisionTicketsPhase5Schema, "revision-tickets.yaml");
});
```

- [ ] **Step 2: Verify RED in GitHub Actions**

Expected: imports from `v1-3-audit-schemas.ts` fail because the module does not exist.

- [ ] **Step 3: Implement compatibility-first Phase 5 schemas**

Create schemas that extend existing structures with optional fields:

```ts
const RecurrenceSchema = Type.Object({
  pattern_id: Type.String({ minLength: 1 }),
  milestone_review: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
}, { additionalProperties: false });

const RevisionLearningGuardrailSchema = Type.Object({
  id: Type.String({ pattern: "^LRN-[0-9]{3}$" }),
  pattern_id: Type.String({ minLength: 1 }),
  rule: Type.String({ minLength: 1 }),
  source_ticket_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  distinct_chapters: Type.Array(Type.Integer({ minimum: 1 })),
  milestone_reviews: Type.Array(Type.String({ minLength: 1 })),
  status: Type.Union([Type.Literal("proposed"), Type.Literal("approved"), Type.Literal("rejected")]),
}, { additionalProperties: false });
```

Voice-audit records add optional `pov`, `chapters`, `baseline_metrics`, `deltas`, `protected_exceptions`, and `assessment: evidence-only | writer-reviewed` while retaining the existing required fields and verdicts.

- [ ] **Step 4: Register Phase 5 schemas before older schemas**

Map `book-strategy.yaml`, `revision-tickets.yaml`, and `voice-audits.yaml` to their Phase 5 schemas in `v1-3-schema-registry.ts`.

- [ ] **Step 5: Update new-book defaults**

New strategies receive `revision_learning_guardrails: []`; existing files do not require backfill.

- [ ] **Step 6: Run focused schema tests and commit**

```bash
node --import tsx --test tests/phase5-schemas.test.ts
```

Expected: PASS.

---

### Task 2: Implement deterministic voice metrics and drift evidence

**Files:**
- Create: `src/application/voice-audit.ts`
- Create: `scripts/voice-audit.ts`
- Modify: `package.json`
- Test: `tests/voice-drift.test.ts`

**Interfaces:**

```ts
export interface VoiceMetrics {
  word_count: number;
  sentence_count: number;
  average_sentence_words: number;
  median_sentence_words: number;
  average_paragraph_sentences: number;
  dialogue_ratio: number;
  fragment_ratio: number;
  rhetorical_question_ratio: number;
  filter_word_rate_per_1000: number;
  body_language_repeat_rate_per_1000: number;
  interiority_rate_per_1000: number;
}

export function extractVoiceMetrics(text: string): VoiceMetrics;
export function compareVoiceMetrics(current: VoiceMetrics, baseline: Record<string, number>): Record<string, number>;
export function buildVoiceAuditRecord(input: VoiceAuditInput): VoiceAuditRecord;
export function isVoiceAuditMilestone(input: { chapter?: number; scope?: string; explicit?: boolean }): boolean;
```

- [ ] **Step 1: Write failing metric and milestone tests**

Prove deterministic extraction, stable rounding, baseline delta calculation, Chapter 1/3 and act/manuscript milestone selection, and protected exceptions.

```ts
test("metric changes produce evidence-only deltas without ticket severity", () => {
  const audit = buildVoiceAuditRecord({ currentText, baselineMetrics, baselineHash, scope: "chapter-3", pov: "Mara", protectedExceptions: [] });
  assert.equal(audit.assessment, "evidence-only");
  assert.ok("dialogue_ratio" in audit.deltas);
  assert.equal(JSON.stringify(audit).includes("severity"), false);
});
```

- [ ] **Step 2: Verify RED**

Expected: `voice-audit.ts` does not exist.

- [ ] **Step 3: Implement deterministic extraction**

Use Unicode-aware word tokens, paragraph splitting, sentence-terminal punctuation, line-leading dialogue detection, and fixed term lists for filter words, body-language vocabulary, and interiority. Round rates and averages to four decimals. Do not use a model, network, external NLP package, or randomness.

- [ ] **Step 4: Implement evidence-only comparison**

Deltas are `current - baseline`, rounded to four decimals. Findings describe material changes but contain no severity and create no ticket by themselves. A protected exception changes the verdict to `accepted-variation` only when explicitly supplied.

- [ ] **Step 5: Add the `audit:voice` script**

```json
"audit:voice": "node --import tsx scripts/voice-audit.ts"
```

The script accepts an optional project root, reads the active book, compiles current manuscript prose, compares it with approved baseline metrics, and prints JSON evidence without mutating project files.

- [ ] **Step 6: Run focused tests and script smoke test**

```bash
node --import tsx --test tests/voice-drift.test.ts
npm run audit:voice -- .
```

Expected: tests pass; script returns a clear no-baseline diagnostic or valid JSON.

---

### Task 3: Implement scene-engine and state-change audits

**Files:**
- Create: `src/application/scene-audit.ts`
- Test: `tests/scene-engine.test.ts`

**Interfaces:**

```ts
export interface SceneAuditFinding {
  code: "consecutive-scene-engine" | "scene-engine-dominance" | "state-neutral-conversation" | "indistinguishable-state-change";
  chapters: number[];
  evidence: string;
  problem: string;
  recurrenceKey: string;
}

export function sceneAuditFindings(queue: ChapterQueueState, plot: PlotGridPhase4): SceneAuditFinding[];
```

- [ ] **Step 1: Write failing deterministic scene tests**

Prove:

- three consecutive identical scene engines are flagged, while two are allowed;
- a dominant engine is flagged only with enough planned chapters;
- interview/conversation/meeting engines with blank, `none`, `unchanged`, or equivalent state change are flagged;
- adjacent equal normalized state changes are flagged;
- meaningful state changes suppress the conversation finding.

- [ ] **Step 2: Verify RED**

Expected: `scene-audit.ts` does not exist.

- [ ] **Step 3: Implement normalized deterministic checks**

Normalize case, punctuation, and whitespace. Treat `interview`, `conversation`, `dialogue`, `meeting`, `debrief`, and `questioning` as conversational engines. Whole-book dominance requires at least six planned packets and greater than 50% usage.

- [ ] **Step 4: Run focused tests and commit**

```bash
node --import tsx --test tests/scene-engine.test.ts
```

Expected: PASS.

---

### Task 4: Add exact recurrence learning and promotion validation

**Files:**
- Create: `src/application/revision-learning.ts`
- Modify: `src/review/review.ts`
- Test: `tests/guardrail-promotion.test.ts`

**Interfaces:**

```ts
export interface LearningCandidate {
  patternId: string;
  ticketIds: string[];
  distinctChapters: number[];
  milestoneReviews: string[];
  eligible: boolean;
}

export function revisionLearningCandidates(tickets: RevisionTicketsPhase5): LearningCandidate[];
export function revisionLearningFindings(strategy: BookStrategyPhase5, tickets: RevisionTicketsPhase5): LearningFinding[];
export function renderApprovedLearningGuardrails(strategy: BookStrategyPhase5): string;
```

- [ ] **Step 1: Write failing exact-threshold tests**

Prove:

- two distinct chapters are not eligible;
- exactly three distinct chapters are eligible;
- duplicate tickets in one chapter count once;
- one milestone review is not eligible;
- exactly two distinct milestone reviews are eligible;
- a proposed candidate does not render into drafting context;
- an approved candidate requires threshold evidence and exact source-ticket linkage;
- approved rules render; rejected/proposed rules do not.

- [ ] **Step 2: Verify RED**

Expected: `revision-learning.ts` does not exist.

- [ ] **Step 3: Extend ticket synthesis without changing legacy behavior**

Add optional fields to `ReviewFinding`:

```ts
recurrenceKey?: string;
milestoneReview?: string;
```

When supplied, new tickets receive `recurrence: { pattern_id, milestone_review }`. Existing duplicate-ticket merge behavior remains unchanged.

- [ ] **Step 4: Implement grouping and eligibility**

Group by `recurrence.pattern_id`. Count unique non-null chapters and unique non-null milestone reviews. Eligibility is `distinctChapters.length >= 3 || milestoneReviews.length >= 2`.

- [ ] **Step 5: Validate writer-approved strategy records**

Approved learning guardrails must reference an eligible pattern, include every supporting ticket ID for that pattern, and store the exact sorted distinct chapters and milestone review IDs. Proposed and rejected candidates may remain incomplete and never render.

- [ ] **Step 6: Run focused tests and commit**

```bash
node --import tsx --test tests/guardrail-promotion.test.ts
```

Expected: PASS.

---

### Task 5: Integrate audits with draft, review, strategy, and context

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/book-strategy.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/context/context-builder.ts`
- Modify: `src/application/gate-metadata.ts`
- Test: `tests/phase5-integration.test.ts`
- Test: `tests/gate-guidance.test.ts`
- Test: `tests/phase5-prompts.test.ts`

**Interfaces:**

- `review` events parse Phase 5 revision-ticket and voice-audit schemas.
- `research-update` validates approved revision-learning guardrails against current tickets.
- Chapter 1 and Chapter 3 draft events may append deterministic voice-audit evidence automatically when approved baseline metrics exist.
- Act and manuscript review events may append deterministic voice-audit evidence automatically from current manuscript prose.
- Review events synthesize deterministic scene-audit tickets with recurrence keys and milestone IDs.

- [ ] **Step 1: Write failing integration tests**

Prove:

- Chapter 1 and 3 produce audit evidence when a baseline exists, but Chapter 2 does not;
- missing baseline skips the audit without blocking drafting;
- act/manuscript review produces audit evidence;
- scene findings become revision tickets, not prose edits;
- review recurrence metadata records the milestone scope;
- approving an ineligible learning rule through `research-update` is rejected;
- approving an eligible rule succeeds without modifying manuscript files;
- future chapter context includes approved learning rules only;
- review gates list `voice-audits.yaml` as evidence.

- [ ] **Step 2: Verify RED**

Expected: event and context assertions fail because Phase 5 services are not integrated.

- [ ] **Step 3: Add safe event helpers**

Implement focused helpers inside or adjacent to `events.ts`:

```ts
appendMilestoneVoiceAudit(root, changes, book, input): void
appendSceneAuditTickets(root, changes, book, input): void
validateRevisionLearning(root, changes, book): void
```

Never overwrite model-supplied audit IDs; allocate the next `VA-NNN` deterministically. Do not create an audit when baseline hash or baseline metrics are absent.

- [ ] **Step 4: Integrate scene findings into tickets**

Convert deterministic scene findings to medium-severity `ReviewFinding` records with category `scene-diversity`, explicit evidence, protected constraints, acceptance tests, recurrence key, and milestone scope. Use `synthesizeTickets`; never edit prose.

- [ ] **Step 5: Extend approved book guardrail rendering**

`renderApprovedBookGuardrails` combines approved review-derived rules and approved revision-learning rules, de-duplicates exact text, and excludes proposed/rejected candidates.

- [ ] **Step 6: Update prompts and gate evidence**

Review prompts explain voice metrics as evidence, require scene/state-change checks, and require recurrence metadata. They must say that candidates require writer approval and cannot trigger retroactive rewrites. Review gate evidence includes `voice-audits.yaml`.

- [ ] **Step 7: Run focused integration tests**

```bash
node --import tsx --test tests/phase5-integration.test.ts tests/gate-guidance.test.ts tests/phase5-prompts.test.ts tests/context.test.ts
```

Expected: PASS.

---

### Task 6: Documentation, compatibility, and final verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `RELEASE.md`
- Create: `docs/novel-forge-phase5-audits-and-learning.md`

- [ ] **Step 1: Document author-facing behavior**

Explain:

- when voice audits run;
- what metrics mean and do not mean;
- intentional exceptions;
- scene/state-change findings;
- exact recurrence thresholds;
- proposed versus approved rules;
- future-context-only effect;
- no automatic prose rewrite.

- [ ] **Step 2: Run the complete final matrix**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24: all pass.

- [ ] **Step 3: Inspect the final diff**

Confirm no temporary workflow, diagnostics, generated manuscript, imported review corpus, audit output, or package output remains.

- [ ] **Step 4: Resolve review threads and merge exact tested head**

Update the PR with the authoritative Actions run ID and exact tested SHA. Mark ready and merge with `expected_head_sha` protection.

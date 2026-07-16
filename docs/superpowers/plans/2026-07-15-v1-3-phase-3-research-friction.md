# Novel Forge 1.3 Phase 3 Research and Reader-Friction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement provenance-complete research ledgers and privacy-safe public-review observation analysis, including CSV/manual intake, deterministic confidence rules, positive counterweights, writer decisions, and strict separation from real manuscript reader evidence.

**Architecture:** Keep the existing 1.3 typed artifacts and state-neutral `research-update` event. Add two pure application services: `research-evidence.ts` validates research/source contracts, while `review-observations.ts` sanitizes imports, derives rating bands, builds clusters, and validates reader-friction strategy. Integrate both at the existing `applyGuidedProjectEvent` boundary so every model or future wizard mutation receives the same stale-write, schema, rollback, guidance, and Git guarantees.

**Tech Stack:** TypeScript 5.9, Node.js 22.19.0 and Node 24, TypeBox, YAML, Node test runner, existing Novel Forge transactions, GitHub Actions matrix.

## Global Constraints

- Version remains exactly `1.3.0`; no release tag in this PR.
- `/novel` remains the normal interface; no new command or wizard workflow in Phase 3.
- No retailer or social scraping.
- Public-review observations are paraphrase-first and never count as human evidence about the current manuscript.
- Reviewer names, handles, and profile URLs are discarded before project storage.
- One- and two-star ratings are negative, three-star is mixed, four- and five-star are positive.
- Weak confidence: fewer than three observations or only one title.
- Moderate confidence: at least three observations across two titles.
- Strong confidence: at least six observations across three titles, specific execution relevance, and at least one positive counterweight.
- Evidence containing only one-star observations can never exceed moderate confidence.
- Every negative cluster must preserve positive counterweights before it can justify a strong recommendation.
- Ready research requires source provenance, verification date, confidence, fictionalization, knowledge scope, risk, and at least one dramatic use.
- Existing 1.2/early-1.3 projects remain readable; new source-register fields are optional at schema parse time and enforced only when the corresponding evidence is used as ready support.
- `research-update` remains state-neutral and may not write manuscript prose, project/book state, gates, reader experiments, publishing, marketing, or package outputs.
- Use TDD: tests must fail for the intended missing behavior before production changes.

---

### Task 1: Extend source and research contracts

**Files:**
- Modify: `src/domain/schemas.ts`
- Modify: `src/domain/v1-3-schemas.ts`
- Create: `tests/research-ledger.test.ts`

**Interfaces:**

```ts
export type SourceReliability = "unknown" | "low" | "medium" | "high" | "primary";

export interface ResearchEvidenceFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}
```

- [ ] **Step 1: Write failing schema and validation tests**

Create `tests/research-ledger.test.ts` proving:

```ts
test("all four research lanes parse", () => {
  for (const lane of ["taste-and-voice", "story-world", "human-authenticity", "reader-and-market"] as const) {
    const ledger = defaultResearchLedger();
    ledger.items.push(researchItem({ id: `RES-${String(ledger.items.length + 1).padStart(3, "0")}`, lane, status: "researching" }));
    parseYaml(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger.yaml");
  }
});

test("ready research requires a supporting registered source and dramatic use", () => {
  const findings = researchEvidenceFindings(readyLedger("RES-001", ["SRC-001"]), sourceRegister([]));
  assert.ok(findings.some((item) => item.code === "missing-source"));
});

test("legacy source-register records remain schema-readable", () => {
  parseYaml(stringifyYaml({ schema_version: "1.0.0", sources: [{ id: "SRC-001", type: "book", title: "Legacy", location: "local", verified_on: null, supports: [], notes: "" }] }), SourceRegisterSchema, "source-register.yaml");
});
```

- [ ] **Step 2: Verify RED**

Run through GitHub Actions after opening the draft PR. Expected failure: `researchEvidenceFindings` does not exist and source-register extensions are unavailable.

- [ ] **Step 3: Extend `SourceRegisterSchema` compatibly**

Add optional fields to each source item:

```ts
reliability: Type.Optional(Type.Union([
  Type.Literal("unknown"), Type.Literal("low"), Type.Literal("medium"),
  Type.Literal("high"), Type.Literal("primary"),
])),
observed_on: Type.Optional(Type.Union([Type.String(), Type.Null()])),
supports_research_ids: Type.Optional(Type.Array(Type.String({ pattern: "^RES-[0-9]{3}$" }))),
```

Do not remove legacy `supports`; Phase 4 may migrate graph semantics later.

- [ ] **Step 4: Export research enums and narrow IDs**

In `src/domain/v1-3-schemas.ts`, export `ResearchLaneSchema`, `DramaticUseSchema`, and `FrictionCategorySchema`. Require `source_ids` in ready items to match `^SRC-[0-9]{3}$`; keep draft items permissive so incomplete work remains writable.

- [ ] **Step 5: Commit**

```bash
git add src/domain/schemas.ts src/domain/v1-3-schemas.ts tests/research-ledger.test.ts
git commit -m "test: specify research provenance contracts"
```

---

### Task 2: Add research evidence validation

**Files:**
- Create: `src/application/research-evidence.ts`
- Modify: `tests/research-ledger.test.ts`

**Interfaces:**

```ts
export interface ResearchEvidenceFinding {
  severity: "blocker" | "warning";
  code: "duplicate-research-id" | "duplicate-source-id" | "missing-source" |
    "source-support-mismatch" | "missing-source-reliability" |
    "missing-source-observation-date" | "missing-dramatic-use" |
    "missing-story-decision" | "legacy-source-reference";
  message: string;
}

export function researchEvidenceFindings(
  ledger: ResearchLedger,
  sources: SourceRegisterState,
): ResearchEvidenceFinding[];
```

- [ ] **Step 1: Add failing behavior tests**

Add tests for duplicate IDs, missing sources, missing `supports_research_ids`, ready sources without reliability/date, and research items with blank `story_use.decision_affected`.

- [ ] **Step 2: Verify RED**

Expected failure: module missing.

- [ ] **Step 3: Implement minimal deterministic validation**

Rules:

```ts
- duplicate research or source IDs are blockers;
- every ready research source ID must exist;
- every supporting source must list the research ID in supports_research_ids;
- ready-supporting sources require reliability other than unknown and an observation/verification date;
- ready research requires at least one dramatic use and a nonblank decision_affected;
- non-ready items may be incomplete and produce warnings only;
- legacy source fields remain parseable but cannot support a new ready claim without the extended provenance fields.
```

- [ ] **Step 4: Verify GREEN**

```bash
node --import tsx --test tests/research-ledger.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/application/research-evidence.ts tests/research-ledger.test.ts
git commit -m "feat: validate research provenance and dramatic use"
```

---

### Task 3: Add privacy-safe manual and CSV review intake

**Files:**
- Create: `src/application/review-observations.ts`
- Create: `tests/review-import.test.ts`

**Interfaces:**

```ts
export interface RawReviewObservation {
  title: string;
  sourceLocation: string;
  observedOn: string;
  rating: number | null;
  paraphrase: string;
  shortExcerpt?: string;
  category: FrictionCategory;
  genreRelevance: "low" | "medium" | "high";
  executionRelevance: "low" | "medium" | "high";
  sentiment?: "negative" | "mixed" | "positive";
  reviewerName?: string;
  reviewerHandle?: string;
  reviewerProfileUrl?: string;
}

export interface ReviewImportResult {
  observations: BookStrategy["reader_friction"]["observations"];
  discardedIdentityFields: number;
  warnings: string[];
}

export function sanitizeReviewObservation(
  id: string,
  input: RawReviewObservation,
): BookStrategy["reader_friction"]["observations"][number];

export function importReviewObservationCsv(
  csv: string,
  existingIds?: readonly string[],
): ReviewImportResult;
```

- [ ] **Step 1: Write failing import tests**

Tests must prove:

```ts
- names, handles, and reviewer profile URLs never appear in serialized observations;
- explicit names/handles are removed from paraphrase and excerpt text;
- rating 1 and 2 derive negative, rating 3 mixed, rating 4 and 5 positive;
- an unrated observation requires an explicit sentiment;
- quoted commas and escaped quotes parse correctly;
- duplicate or malformed rows produce precise errors;
- only the allowlisted review columns enter stored observations.
```

- [ ] **Step 2: Verify RED**

Expected failure: module missing.

- [ ] **Step 3: Implement a local RFC-4180-style parser**

Reuse the reader-kit parser behavior: quoted fields, doubled quotes, CRLF handling, exact row/header validation. Do not add a dependency.

CSV headers:

```text
title,source_location,observed_on,rating,paraphrase,short_excerpt,category,genre_relevance,execution_relevance,sentiment,reviewer_name,reviewer_handle,reviewer_profile_url
```

- [ ] **Step 4: Implement identity stripping and rating bands**

Strip each supplied name/handle from paraphrase and excerpt using escaped, Unicode-aware boundary patterns. Never copy `reviewer_profile_url`. Keep `source_location` only as review-level provenance; reject values equal to the supplied profile URL.

- [ ] **Step 5: Verify GREEN**

```bash
node --import tsx --test tests/review-import.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/application/review-observations.ts tests/review-import.test.ts
git commit -m "feat: import de-identified public review observations"
```

---

### Task 4: Add clustering, counterweights, and confidence rules

**Files:**
- Modify: `src/application/review-observations.ts`
- Create: `tests/reader-friction.test.ts`

**Interfaces:**

```ts
export type FrictionObservation = BookStrategy["reader_friction"]["observations"][number];
export type FrictionCluster = BookStrategy["reader_friction"]["clusters"][number];

export function deriveReviewSentiment(
  rating: number | null,
  explicit?: "negative" | "mixed" | "positive",
): "negative" | "mixed" | "positive";

export function maximumClusterConfidence(
  observations: readonly FrictionObservation[],
  positiveCounterweightIds: readonly string[],
): "weak" | "moderate" | "strong";

export function buildReviewCluster(
  input: { id: string; label: string; observationIds: string[] },
  observations: readonly FrictionObservation[],
): FrictionCluster;

export function readerFrictionFindings(
  strategy: BookStrategy,
): Array<{ severity: "blocker" | "warning"; code: string; message: string }>;
```

- [ ] **Step 1: Write failing confidence tests**

Cover:

```ts
- fewer than three observations => weak;
- three observations across two titles => moderate;
- six observations across three titles plus high execution relevance and a positive counterweight => strong;
- one-star-only evidence caps at moderate;
- three-star observations remain sentiment mixed;
- positive observations are stored as counterweight IDs, not collapsed into the complaint text;
- recorded confidence above the computed maximum is blocked;
- `accept-as-tradeoff` requires a linked accepted-tradeoff record;
- approved guardrails may reference only project-relevant prevent/mitigate clusters.
```

- [ ] **Step 2: Verify RED**

Expected failure: clustering APIs missing.

- [ ] **Step 3: Implement deterministic clustering helpers**

`buildReviewCluster` receives the negative/mixed observation IDs. It derives affected titles, finds positive observations with matching category and affected title, stores their IDs in `positive_counterweights`, calculates maximum confidence, and initializes `decision` and `guardrail` to null.

- [ ] **Step 4: Extend accepted tradeoff linkage compatibly**

In `BookStrategySchema`, add optional `source_cluster_ids` to accepted tradeoffs. Existing records remain readable. `readerFrictionFindings` requires linkage for any newly accepted tradeoff decision.

- [ ] **Step 5: Verify GREEN**

```bash
node --import tsx --test tests/reader-friction.test.ts tests/review-import.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/v1-3-schemas.ts src/application/review-observations.ts tests/reader-friction.test.ts
git commit -m "feat: derive evidence-bounded reader friction clusters"
```

---

### Task 5: Enforce evidence at guarded transaction and chapter-packet boundaries

**Files:**
- Modify: `src/application/handoff.ts`
- Modify: `src/application/integrity.ts`
- Modify: `src/application/events.ts`
- Modify: `tests/research-event.test.ts`
- Modify: `tests/context-integrity.test.ts`
- Modify: `tests/reader-impact-validation.test.ts`

**Interfaces:**

```ts
export function packetReferenceFindings(
  packet: ChapterPacket,
  canon: CanonState,
  threads: StoryThreadsState,
  sources: SourceRegisterState,
  plot: PlotGridState,
  research?: ResearchLedger,
): IntegrityFinding[];
```

- [ ] **Step 1: Add failing integration tests**

Prove:

```ts
- research-update rejects a ready ledger with missing or incomplete source provenance;
- research-update rejects a strategy whose recorded cluster confidence exceeds evidence;
- research-update leaves reader-experiments.yaml byte-for-byte unchanged;
- a ready packet referencing an existing but non-ready RES ID is blocked;
- a ready packet referencing a ready RES ID passes;
- legacy SRC IDs remain accepted with an advisory until Phase 4 migration;
- accepted tradeoffs remain serialized and visible after a guarded update.
```

- [ ] **Step 2: Verify RED**

Expected failures: guarded events currently schema-check only, and packet integrity interprets all research references as source IDs.

- [ ] **Step 3: Integrate application validation in `handoff.ts`**

Replace `validateGuidedVoiceEvidence` with `validateGuidedEvidence`. Parse overlays for source register, active-book research ledger, and book strategy only when watched paths change. Throw grouped blocker messages from `researchEvidenceFindings` and `readerFrictionFindings`. Warnings do not block writes.

- [ ] **Step 4: Update packet integrity compatibly**

For each `required_research` entry:

```ts
- if it matches a research-ledger item, require status ready;
- if it matches a source-register item, accept but emit a legacy-source-reference warning;
- otherwise block as missing required research.
```

Load the active research ledger in both event drafting validation and project integrity collection.

- [ ] **Step 5: Verify GREEN**

```bash
node --import tsx --test tests/research-event.test.ts tests/context-integrity.test.ts tests/reader-impact-validation.test.ts tests/research-ledger.test.ts tests/reader-friction.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/application/handoff.ts src/application/integrity.ts src/application/events.ts tests/research-event.test.ts tests/context-integrity.test.ts tests/reader-impact-validation.test.ts
git commit -m "feat: enforce research and friction evidence at guarded boundaries"
```

---

### Task 6: Update author prompts, documentation, and evaluation fixtures

**Files:**
- Modify: `src/application/prompts.ts`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASE.md`
- Modify: `scripts/evaluate-fixtures.ts`
- Create: `evals/research-friction/fixture.yaml`
- Create: `tests/guided-command-prompts.test.ts`

**Behavior:**

- `bookPlanPrompt` and review/research guidance describe the four lanes, privacy-safe observation storage, rating bands, confidence caps, positive counterweights, and writer decisions.
- Prompts explicitly forbid inventing public-review evidence and forbid converting public observations into project reader metrics.
- README explains manual/pasted/CSV intake as an application capability that will receive its browser surface in Phase 6.
- Release checklist marks Phase 3 requirements as implemented but does not claim Phase 4 graph integration or Phase 6 wizard completion.
- Evaluation fixture includes one ready research claim, two supporting sources, negative/mixed/positive observations, a moderate cluster, and an accepted tradeoff.

- [ ] **Step 1: Add failing prompt/evaluation tests**

Assert required privacy and separation phrases are present and evaluation rejects one-star-only strong confidence.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Update prompts and docs**

- [ ] **Step 4: Verify focused Phase 3 suite**

```bash
node --import tsx --test \
  tests/research-ledger.test.ts \
  tests/review-import.test.ts \
  tests/reader-friction.test.ts \
  tests/reader-impact-validation.test.ts \
  tests/research-event.test.ts \
  tests/context-integrity.test.ts \
  tests/guided-command-prompts.test.ts
npm run eval
```

- [ ] **Step 5: Run the full matrix**

GitHub Actions must pass on Node 22.19.0 and Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

- [ ] **Step 6: Commit**

```bash
git add src/application/prompts.ts README.md SKILL.md CHANGELOG.md RELEASE.md scripts/evaluate-fixtures.ts evals/research-friction/fixture.yaml tests/guided-command-prompts.test.ts
git commit -m "docs: complete Novel Forge 1.3 phase 3 research friction"
```

## Self-review checklist

- [ ] Every Phase 3 deliverable maps to a task.
- [ ] No task adds research graph nodes or drafting context; those remain Phase 4.
- [ ] No task adds browser UI; that remains Phase 6.
- [ ] Existing source-register entries remain parseable.
- [ ] Reader experiments are neither imported nor modified by public-review services.
- [ ] All stored review observations are de-identified and paraphrase-first.
- [ ] Strong confidence cannot be reached by one-star-only evidence.
- [ ] Accepted tradeoffs remain explicit and linked to source clusters.
- [ ] Full Node matrix and package dry-run pass before merge.

# Deterministic Prose Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Novel Forge's deterministic manuscript scanners into one typed, read-only prose-lint engine that supplies bounded evidence to act and manuscript reviews while preserving every existing audit command.

**Architecture:** Pure TypeScript lint rules consume normalized manuscript documents and optional canonical project context, then return stable typed findings. A project loader and report renderer adapt the engine to a new CLI, the existing `.mjs` scanner entry points forward to filtered views of that CLI, and `reviewPrompt` injects a bounded summary with visible fail-open behavior.

**Tech Stack:** Node.js 22+, TypeScript 5.9 in ESM/NodeNext mode, `tsx`, Node's built-in test runner, existing `yaml` and TypeBox-based project parsers.

## Global Constraints

- The engine is local and read-only: no network requests, manuscript edits, project mutation, stage changes, or direct revision tickets.
- Never emit `AI detected`, `AI-written`, `AI probability`, or authorship scores.
- Identical manuscript input, baseline metrics, and rule versions produce stable finding order and byte-stable JSON when timestamps are omitted.
- Style patterns are review evidence, never prose quotas or automatic ticket severity.
- Act and manuscript review prompts receive bounded evidence; chapter drafting does not automatically run the full suite.
- Keep all eight current package-script commands and direct `.mjs` entry points callable.
- Existing thriller, romantasy, and historical-fiction projects require no migration or new artifact.

---

## File Structure

- Create `src/application/prose-lint/types.ts`: public document, rule, finding, evidence, context, and result contracts.
- Create `src/application/prose-lint/normalize.ts`: Markdown-aware line, token, sentence, paragraph, and fenced-code normalization.
- Create `src/application/prose-lint/rules/mechanics.ts`: exact mechanical defect rules.
- Create `src/application/prose-lint/rules/repetition.ts`: phrase, opening, exact duplicate, and near-duplicate rules.
- Create `src/application/prose-lint/rules/style-patterns.ts`: rhetorical and punctuation concentration rules.
- Create `src/application/prose-lint/rules/project-consistency.ts`: spelling, chapter structure, temporal, canon-number, and reference-integrity findings.
- Create `src/application/prose-lint/engine.ts`: isolated rule execution, stable sorting, failure collection, and result assembly.
- Create `src/application/prose-lint/project.ts`: project/directory loading, baseline loading, canonical-context assembly, and scope selection.
- Create `src/application/prose-lint/report.ts`: complete Markdown/JSON rendering and bounded review summaries.
- Create `src/application/prose-lint/index.ts`: stable public exports and default rule registry.
- Create `scripts/prose-lint.ts`: explicit CLI with `--format` and `--rules` support.
- Create `scripts/lib/prose-lint-forwarder.mjs`: shared compatibility launcher for existing `.mjs` scripts.
- Modify all eight existing scanner scripts to forward to a filtered engine report.
- Modify `src/application/prompts.ts` and `src/application/stage-specs/index.ts`: automatic read-only lint evidence at act/manuscript review.
- Modify `package.json`, `README.md`, and `tests/scanners.test.ts` for the public command and compatibility contract.
- Create focused `tests/prose-lint-*.test.ts` files for rules, project loading, rendering, CLI behavior, and prompt integration.

---

### Task 1: Typed engine and mechanical rules

**Files:**
- Create: `src/application/prose-lint/types.ts`
- Create: `src/application/prose-lint/normalize.ts`
- Create: `src/application/prose-lint/rules/mechanics.ts`
- Create: `src/application/prose-lint/engine.ts`
- Test: `tests/prose-lint-mechanics.test.ts`

**Interfaces:**
- Produces: `normalizeDocument(path: string, text: string, order: number): ManuscriptDocument`
- Produces: `runProseLint(input: ProseLintInput): ProseLintResult`
- Produces: `mechanicalRules: readonly LintRule[]`
- Produces: `LintFinding`, `LintRule`, `ManuscriptDocument`, `ProseLintInput`, and `ProseLintResult` types used by every later task.

- [ ] **Step 1: Write failing mechanical-rule and determinism tests**

Create fixtures that contain a doubled word, punctuation spacing, malformed punctuation, `[[TODO: repair]]`, standalone `TKTK`, unbalanced paired punctuation, fenced-code false positives, and an intentional Markdown scene break. Assert exact rule IDs, line numbers, bounded excerpts, class/confidence, stable sorting, and no mutation of the source strings.

```ts
const result = runProseLint({
  documents: [normalizeDocument("01-opening.md", source, 1)],
  rules: mechanicalRules,
});
assert.deepEqual(result.findings.map((item) => item.ruleId), [
  "mechanics/doubled-word",
  "mechanics/punctuation-spacing",
  "mechanics/drafting-marker",
]);
assert.equal(result.findings[0]?.location.line, 2);
assert.equal(source, original);
```

- [ ] **Step 2: Run the focused test and confirm red state**

Run: `node --import tsx --test tests/prose-lint-mechanics.test.ts`

Expected: FAIL because the prose-lint modules do not exist.

- [ ] **Step 3: Define the typed contracts and Markdown-aware normalization**

Implement these stable contracts:

```ts
export type LintClass = "mechanical" | "consistency" | "repetition" | "style-pattern";
export type LintConfidence = "high" | "medium" | "review";
export interface LintFinding {
  ruleId: string;
  ruleVersion: string;
  class: LintClass;
  confidence: LintConfidence;
  location: { path: string; line?: number };
  excerpt: string;
  message: string;
  evidence: Record<string, string | number | boolean>;
  reviewAction: string;
}
export interface ManuscriptDocument {
  path: string;
  order: number;
  text: string;
  scanText: string;
  lines: readonly string[];
  tokens: readonly string[];
  sentences: readonly { text: string; line: number }[];
  paragraphs: readonly { text: string; line: number; tokens: readonly string[] }[];
  wordCount: number;
}
export interface ProseLintInput {
  documents: readonly ManuscriptDocument[];
  baselineMetrics?: Readonly<Record<string, number>>;
  rules: readonly LintRule[];
}
export interface LintRule {
  id: string;
  version: string;
  run(input: ProseLintInput): LintFinding[];
}
export interface ProseLintResult {
  findings: LintFinding[];
  failures: Array<{ ruleId: string; message: string }>;
  counts: Record<LintClass, number>;
  wordCount: number;
}
```

Normalization must retain original lines for excerpts, replace fenced-code bodies with blank lines to preserve line numbers, expose lowercase word tokens, sentences, paragraphs, total word count, and document order, and never mutate caller input.

- [ ] **Step 4: Implement exact mechanical rules and isolated execution**

Implement doubled adjacent words, whitespace before punctuation, repeated `!?` runs longer than three marks, the three approved drafting-marker syntaxes, and only unambiguous same-line bracket/parenthesis imbalance. Exclude fenced code, Markdown headings, and lines whose trimmed content is `***`, `---`, or `___`.

`runProseLint` catches each rule's exception, records `{ ruleId, message }`, continues remaining rules, computes class counts and word count, and sorts by class order, rule ID, document order, line, then excerpt.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node --import tsx --test tests/prose-lint-mechanics.test.ts && npm run typecheck`

Expected: PASS with zero TypeScript errors.

- [ ] **Step 6: Commit the independently working engine**

```bash
git add src/application/prose-lint tests/prose-lint-mechanics.test.ts
git commit -m "feat: add typed prose lint engine"
```

---

### Task 2: Repetition and baseline-aware style patterns

**Files:**
- Create: `src/application/prose-lint/rules/repetition.ts`
- Create: `src/application/prose-lint/rules/style-patterns.ts`
- Modify: `src/application/prose-lint/types.ts`
- Modify: `src/application/prose-lint/index.ts`
- Test: `tests/prose-lint-patterns.test.ts`

**Interfaces:**
- Consumes: `ProseLintInput`, `LintFinding`, `LintRule`, and normalized documents from Task 1.
- Produces: `repetitionRules`, `stylePatternRules`, and `defaultProseLintRules`.
- Extends: `ProseLintInput.baselineMetrics?: Record<string, number>`.

- [ ] **Step 1: Write failing repetition and concentration tests**

Cover three cross-chapter phrase uses, four same-chapter phrase uses, ignored common function phrases, repeated three-word sentence/paragraph openings, exact duplicate locations, near-duplicate passages of at least 12 tokens with token-trigram Jaccard similarity `>= 0.85`, and a below-threshold pair. Add a 2,000-word fixture that exercises negative parallelism, `not X but Y`, three-part cadence, aphoristic closes, rhetorical questions, fragments, em dashes, filter words, transitions, paragraph shapes, and repeated ending syntax.

```ts
assert.ok(result.findings.some((item) =>
  item.ruleId === "repetition/ngram" &&
  item.evidence.count === 3 &&
  item.evidence.chapterCount === 2
));
assert.ok(result.findings.every((item) => !/AI[- ]written|AI probability/i.test(item.message)));
```

- [ ] **Step 2: Run the focused test and confirm red state**

Run: `node --import tsx --test tests/prose-lint-patterns.test.ts`

Expected: FAIL because repetition and style rule registries do not exist.

- [ ] **Step 3: Implement repetition rules with fixed thresholds**

Use normalized lowercase tokens and a versioned stop-phrase set. Report two- through five-token phrases only after three uses across two documents or four uses in one document. Record full count, document count, densest-document count, and at most five locations. Exact duplicates report both locations. Near duplicates use token-trigram Jaccard similarity and skip identical passages.

- [ ] **Step 4: Implement style concentration and baseline deltas**

Reuse `extractVoiceMetrics` for fragments, rhetorical questions, filter words, and body-language repetition. Add deterministic pattern counters for negative parallelism, `not X but Y`, three-part cadence, aphoristic closes, em dashes, repeated transitions, paragraph sentence-count shapes, and normalized final-sentence syntax.

Without a baseline, require at least 2,000 words, four matches, and a local per-thousand rate at least twice the corpus rate. With a baseline metric, report a pattern when the absolute delta is at least `2` per thousand and the current rate is at least `1.5` times the baseline, treating a zero baseline as satisfied when the current rate is at least `2`.

- [ ] **Step 5: Register default rules and verify stable output**

Create `src/application/prose-lint/index.ts` exporting all public contracts and:

```ts
export const defaultProseLintRules: readonly LintRule[] = [
  ...mechanicalRules,
  ...repetitionRules,
  ...stylePatternRules,
];
```

Task 3 appends `projectConsistencyRules` after that module exists.

- [ ] **Step 6: Run focused tests and commit**

Run: `node --import tsx --test tests/prose-lint-mechanics.test.ts tests/prose-lint-patterns.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add src/application/prose-lint tests/prose-lint-patterns.test.ts
git commit -m "feat: detect prose repetition and pattern drift"
```

---

### Task 3: Project loading, consistency rules, and reports

**Files:**
- Create: `src/application/prose-lint/project.ts`
- Create: `src/application/prose-lint/rules/project-consistency.ts`
- Create: `src/application/prose-lint/report.ts`
- Modify: `src/application/prose-lint/types.ts`
- Modify: `src/application/prose-lint/index.ts`
- Test: `tests/prose-lint-project.test.ts`
- Test: `tests/prose-lint-report.test.ts`

**Interfaces:**
- Produces: `loadProseLintInput(target: string, options?: { scope?: string }): ProseLintInput`
- Produces: `renderProseLintMarkdown(result: ProseLintResult, options?: ReportOptions): string`
- Produces: `renderProseLintJson(result: ProseLintResult): string`
- Produces: `renderReviewLintEvidence(result: ProseLintResult, options?: { maxFindings?: number; maxCharacters?: number }): string`
- Extends: `ProseLintInput.projectContext?: ProjectLintContext` with canonical facts, known names, chapter numbers, and precomputed reference records.

Define the adapter contracts explicitly:

```ts
export interface ProjectLintContext {
  projectRoot: string;
  bookId: string;
  chapterFiles: readonly { path: string; number: number | null }[];
  canonEntries: readonly { id: string; subject: string; fact: string; locked: boolean }[];
  canonNames: readonly string[];
  canonIds: readonly string[];
  threadIds: readonly string[];
  sourceIds: readonly string[];
  packetReferences: readonly { chapter: number; kind: "canon" | "thread" | "source"; id: string }[];
  plotThreadReferences: readonly { chapter: number; id: string }[];
}
export interface ReportOptions {
  title?: string;
  rulePrefixes?: readonly string[];
}
```

- [ ] **Step 1: Write failing loader and consistency tests**

Initialize a temporary thriller project, write two manuscript chapters, baseline metrics, locked canon names/numbers, mixed spelling variants, missing structured references, and temporal markers. Assert numeric chapter ordering, manuscript-relative paths, baseline loading, missing/duplicate chapter findings, mixed spelling, canon-name case variation, canon-number divergence, unresolved references, and temporal markers classified as review evidence rather than proven errors.

- [ ] **Step 2: Write failing Markdown/JSON/bounded-summary tests**

Assert the complete Markdown title and class sections, valid timestamp-free stable JSON, bounded excerpts, failed-rule disclosure, a review summary that keeps all high-confidence mechanical findings before patterns, omitted counts, and a hard character ceiling.

```ts
const summary = renderReviewLintEvidence(result, { maxFindings: 12, maxCharacters: 6000 });
assert.match(summary, /Deterministic prose-lint evidence/);
assert.ok(summary.length <= 6000);
assert.match(summary, /omitted/);
```

- [ ] **Step 3: Run focused tests and confirm red state**

Run: `node --import tsx --test tests/prose-lint-project.test.ts tests/prose-lint-report.test.ts`

Expected: FAIL because project and report adapters do not exist.

- [ ] **Step 4: Implement project and directory loading**

When `PROJECT.yaml` exists, use `readProject`, `readBook`, and `listChapterFiles` to load only the active book's manuscript. Parse `series/voice-guardrails.yaml` when present and copy only accepted baseline metrics. Assemble canonical IDs, locked facts, relationships, thread IDs/status, source IDs, packet references, plot references, and numbered chapter filenames without changing any artifact.

When the target is a plain directory, recursively load `.md` files using existing exclusion rules and omit project-only context and baseline metrics. Throw a concise error for an unreadable target or zero Markdown files.

- [ ] **Step 5: Port consistency scanners into pure rules**

Port the existing spelling-pair, temporal-reference, structure, continuity-number, chapter sequence, duplicate-ID, and missing-reference behavior. Add case-variant findings for canon-defined subject/name strings of at least two letters. Preserve the current distinctions: temporal references are `review` confidence, missing IDs and duplicate chapter numbers are `high`, and canon-number divergence is `medium` because nearby numbers can be legitimate.

- [ ] **Step 6: Implement complete and bounded renderers**

Markdown groups findings by class and prints path/line, rule ID, message, excerpt, evidence, and review action. JSON excludes timestamps by default and uses a final newline. Review selection keeps every high-confidence mechanical finding up to the hard cap, then cross-document repetition, consistency, and baseline-relative patterns. When required findings alone exceed the cap, truncate excerpts before dropping locations and report exact omitted totals.

- [ ] **Step 7: Run focused tests, all prose-lint tests, and commit**

Run: `node --import tsx --test tests/prose-lint-*.test.ts && npm run typecheck`

Expected: PASS.

```bash
git add src/application/prose-lint tests/prose-lint-project.test.ts tests/prose-lint-report.test.ts
git commit -m "feat: add project-aware prose lint reports"
```

---

### Task 4: CLI and scanner compatibility

**Files:**
- Create: `scripts/prose-lint.ts`
- Create: `scripts/lib/prose-lint-forwarder.mjs`
- Modify: `scripts/ngram-audit.mjs`
- Modify: `scripts/rhetorical-pattern-audit.mjs`
- Modify: `scripts/continuity-scan.mjs`
- Modify: `scripts/integrity-audit.mjs`
- Modify: `scripts/structure-audit.mjs`
- Modify: `scripts/spelling-consistency-audit.mjs`
- Modify: `scripts/temporal-reference-audit.mjs`
- Modify: `scripts/copy-mechanics-audit.mjs`
- Modify: `package.json`
- Modify: `tests/scanners.test.ts`
- Test: `tests/prose-lint-cli.test.ts`

**Interfaces:**
- Consumes: project loader, engine, default rules, and renderers from Tasks 1–3.
- Produces: `npm run audit:prose -- <target> [--format markdown|json] [--rules <comma-list>]`.
- Preserves: every existing `npm run audit:*` command and direct `.mjs` invocation.

- [ ] **Step 1: Write failing CLI and compatibility tests**

Execute the CLI against a temporary project in Markdown and JSON modes. Assert valid output, stable JSON across two runs, no file changes by comparing hashes before/after, nonzero exit for a missing target, and nonzero exit when a synthetic rule failure is requested through a test-only injected engine call rather than a public CLI flag.

Update the existing scanner test to assert each legacy title plus at least one rule-family-specific finding, not merely `# Novel Forge`.

- [ ] **Step 2: Run focused tests and confirm red state**

Run: `node --import tsx --test tests/prose-lint-cli.test.ts tests/scanners.test.ts`

Expected: FAIL because the unified CLI does not exist and legacy scripts are not forwarding.

- [ ] **Step 3: Implement CLI parsing and exit behavior**

Accept one positional target defaulting to `process.cwd()`, `--format markdown|json`, and `--rules` as a comma-separated list of exact rule-ID prefixes. Unknown flags, formats, or rule prefixes print a concise error to stderr and set exit code `1`. Successful rule failures still print the partial report and set exit code `1`.

- [ ] **Step 4: Implement the shared legacy forwarder**

`prose-lint-forwarder.mjs` resolves `scripts/prose-lint.ts` from `import.meta.url`, launches the current Node executable with `--import tsx`, forwards the target and a fixed rule prefix list, relays stdout/stderr, and copies the child exit status.

Each legacy entry point becomes a declarative call such as:

```js
import { forwardProseLint } from "./lib/prose-lint-forwarder.mjs";
forwardProseLint({ title: "Novel Forge n-gram audit", rulePrefixes: ["repetition/ngram"] });
```

The CLI accepts an internal `--title` value only from the forwarder so legacy headings remain exact.

- [ ] **Step 5: Add package command and verify non-mutation**

Add:

```json
"audit:prose": "node --import tsx scripts/prose-lint.ts"
```

Run: `node --import tsx --test tests/prose-lint-cli.test.ts tests/scanners.test.ts && npm run typecheck`

Expected: PASS, with unchanged temporary project hashes.

- [ ] **Step 6: Commit the public command surface**

```bash
git add package.json scripts tests/scanners.test.ts tests/prose-lint-cli.test.ts
git commit -m "feat: unify deterministic audit commands"
```

---

### Task 5: Automatic review integration

**Files:**
- Modify: `src/application/prompts.ts`
- Modify: `src/application/stage-specs/index.ts`
- Modify: `tests/phase5-prompts.test.ts`
- Modify: `tests/prompt-normative-parity.test.ts`
- Test: `tests/prose-lint-review.test.ts`

**Interfaces:**
- Consumes: `loadProseLintInput`, `runProseLint`, and `renderReviewLintEvidence`.
- Extends: `ReviewStageInput` with `lintEvidence: string`.
- Preserves: `reviewPrompt(root, scope, runtimeProfile?)` signature.

- [ ] **Step 1: Write failing act/manuscript/noise/failure prompt tests**

For `act`, `act-1`, and `manuscript` scopes, write a detectable defect and assert the prompt includes a bounded `Deterministic prose-lint evidence` input, exact path/line evidence, the non-authorship boundary, and instructions to verify guardrails/exceptions before tickets. For a chapter scope, assert no automatic lint section. Rename the manuscript directory temporarily to force lint failure and assert a visible `lint unavailable` advisory while the prompt still compiles.

- [ ] **Step 2: Run focused tests and confirm red state**

Run: `node --import tsx --test tests/prose-lint-review.test.ts tests/phase5-prompts.test.ts tests/prompt-normative-parity.test.ts`

Expected: FAIL because review prompts have no lint input.

- [ ] **Step 3: Add scoped, runtime-budgeted, fail-open lint preparation**

In `prompts.ts`, resolve the runtime profile before assembling the review stage and add a private `reviewLintEvidence(root, scope, maxCharacters)` helper. Run lint only when normalized scope is `act`, begins with `act-`, or equals `manuscript`. Use caps of `5_000` characters for `full`, `1_400` for `local`, and `700` for `tiny-local`, each also bounded by the caller's `maxCharacters`. Catch loader/engine/report errors and return `Deterministic prose lint unavailable: <concise message>. Continue normal manuscript and structured-integrity review; do not imply that the lint passed.`

- [ ] **Step 4: Add normative reviewer boundaries**

Pass the bounded text as a required input. Add mandatory rules that deterministic patterns do not establish authorship, findings must be verified in manuscript context against approved guardrails and protected exceptions, and no style-pattern finding creates a ticket by itself. Add validation that every lint-derived ticket cites the exact manuscript location and confirmed problem.

- [ ] **Step 5: Run prompt budget and parity coverage**

Run: `node --import tsx --test tests/prose-lint-review.test.ts tests/phase5-prompts.test.ts tests/prompt-normative-parity.test.ts tests/prompt-budget.test.ts tests/prompt-tiny-budget.test.ts`

Expected: PASS under full, compact, and tiny runtime profiles without truncating normative rules.

- [ ] **Step 6: Commit review integration**

```bash
git add src/application/prompts.ts src/application/stage-specs/index.ts tests/phase5-prompts.test.ts tests/prompt-normative-parity.test.ts tests/prose-lint-review.test.ts
git commit -m "feat: supply prose lint evidence to reviews"
```

---

### Task 6: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-07-18-prose-lint-implementation.md`
- Test: existing full suite.

**Interfaces:**
- Documents: automatic act/manuscript behavior, explicit command, legacy commands, finding classes, non-authorship language, read-only behavior, and failure semantics.

- [x] **Step 1: Document the public behavior**

Add a concise README section after voice/scene audits with:

```bash
npm run audit:prose -- /path/to/novel-project
npm run audit:prose -- /path/to/novel-project --format json
```

Explain that the engine is deterministic, local, read-only, automatically summarized at act/manuscript review, and never detects authorship or rewrites prose. List the four finding classes and state that legacy audit commands remain available.

- [x] **Step 2: Add an unreleased changelog entry**

Record the unified prose-lint command, automatic bounded review evidence, scanner compatibility, and explicit non-authorship boundary without assigning a release version that the user did not request.

- [x] **Step 3: Run focused lint and scanner tests**

Run: `node --import tsx --test tests/prose-lint-*.test.ts tests/scanners.test.ts tests/phase5-prompts.test.ts`

Expected: PASS.

- [x] **Step 4: Run the complete repository verification**

Run:

```bash
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected: every command exits `0`; the packed file list includes `scripts/prose-lint.ts`, the compatibility forwarder, and `src/application/prose-lint/`.

- [x] **Step 5: Inspect mutation and repository state**

Run: `git diff --check && git status --short`

Expected: only intentional implementation and documentation changes remain; no generated manuscript, audit report, package archive, or temporary fixture is present.

- [x] **Step 6: Commit documentation and final verification state**

```bash
git add README.md CHANGELOG.md docs/superpowers/plans/2026-07-18-prose-lint-implementation.md
git commit -m "docs: explain deterministic prose lint"
```

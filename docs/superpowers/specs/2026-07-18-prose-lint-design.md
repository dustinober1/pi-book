# Novel Forge Deterministic Prose Lint Design

## Purpose

Novel Forge will consolidate and strengthen its existing deterministic manuscript scanners into one prose-lint system. The system catches mechanical defects, consistency risks, repeated language, and unusual concentrations of rhetorical patterns before editorial review. It supplies reproducible evidence; it does not decide whether prose was written by AI or whether a stylistic choice is bad.

The lint pass runs automatically, in memory, when an act or manuscript review prompt is prepared. Writers may also run it explicitly at any time. Both paths inspect the same manuscript text with the same versioned rules and produce the same ordered findings.

## Product boundary

The lint system is read-only. It never edits manuscript prose, changes project state, advances a gate, or creates a revision ticket directly. Review may convert a finding into a ticket only after confirming the problem in manuscript context and preserving intentional exceptions.

The product must not use labels such as `AI detected`, `AI-written`, or `AI probability`. Human writers use every commonly cited "AI-ism," and deterministic text patterns cannot establish authorship. User-facing language will describe repeated phrases, cadence concentration, baseline drift, or mechanical defects.

This feature extends the existing voice audit and eight scanner entry points rather than introducing a parallel review system. Voice audit remains the durable baseline-comparison record. Prose lint provides location-specific evidence for review.

## Approaches considered

Three approaches were considered:

1. Expand each existing script independently. This preserves simple tools but duplicates tokenization, reporting, thresholds, and tests, and leaves review without a coherent input.
2. Build one shared lint engine and retain existing scripts as compatibility wrappers. This gives the CLI and review pipeline one deterministic source of truth while preserving current commands. This is the selected approach.
3. Replace deterministic checks with a persona or model reviewer. This can assess context but is not reproducible, cannot reliably identify AI authorship, and duplicates the existing editorial-review path.

## Architecture

A focused prose-lint application module owns corpus loading, normalization, rule execution, baseline comparison, stable ordering, and report rendering. Individual rules are small pure units with declared IDs and versions. Rules receive normalized manuscript documents and return typed findings; they do not read files or print output themselves.

The engine exposes two adapters:

- a CLI adapter that renders complete Markdown by default and structured JSON on request;
- a review adapter that selects a bounded summary for the existing act- and manuscript-review prompt.

The existing `ngram`, `rhetorical-pattern`, `continuity`, `integrity`, `structure`, `spelling`, `temporal`, and `copy-mechanics` scripts remain callable. Each becomes a thin filtered view over the shared engine. Their current package-script names and human-readable report headings remain compatible.

The existing voice-audit metric extractor remains authoritative for accepted-baseline metrics. Prose lint may consume those metrics, but it must not duplicate durable voice-audit records or invent a second baseline format.

## Finding contract

Every finding contains:

- a stable rule ID and rule version;
- a class: `mechanical`, `consistency`, `repetition`, or `style-pattern`;
- confidence: `high`, `medium`, or `review`;
- the manuscript-relative path and, when applicable, line number;
- a short excerpt with enough surrounding text to verify the match;
- a plain-language explanation;
- deterministic evidence such as count, rate, chapter concentration, or baseline delta;
- a suggested review action, never replacement prose.

Confidence is not ticket severity. `High` means the detector is confident that the textual condition exists, not that the condition is a serious literary problem. Style-pattern rules always use `review` confidence unless they report an exact mechanical condition.

Findings sort by class, rule ID, manuscript order, and line number. Identical manuscript input, baseline metrics, and rule versions must yield byte-stable JSON apart from an optional run timestamp added by the adapter.

## Initial rule families

### Mechanical defects

High-confidence rules detect doubled adjacent words, whitespace before punctuation, malformed repeated punctuation, unresolved `[[TODO: ...]]`, `[[FIXME: ...]]`, and standalone `TKTK` drafting markers outside fenced code, and unbalanced paired punctuation or quotation marks when the match is unambiguous. Markdown headings and intentional scene-break markers are excluded.

Exact duplicate paragraphs and sentences are reported with both locations. Near-duplicate prose requires at least 12 tokens and token-trigram Jaccard similarity of at least 0.85 after case, punctuation, and whitespace normalization. It is classified as `repetition`, not as a defect.

### Consistency risks

Rules retain mixed US/UK spelling checks and add case-insensitive spelling variants for canon-defined names, places, and project glossary terms. Chapter numbering, missing or duplicate chapter files, structured-reference integrity, canon-number divergence, and explicit temporal references continue to use canonical project artifacts when available.

Temporal words such as `tomorrow` and `last night` remain review markers unless the structured chronology proves a contradiction. A marker is not described as an error merely because it requires chronology review.

### Repetition

The engine reports repeated two- through five-word phrases after stop-phrase filtering, repeated sentence or paragraph openings, repeated gestures and body-language nouns, and exact or near-exact sentence reuse. Results include total count, affected chapters, and the densest local cluster.

Common function-word phrases and dialogue necessities are filtered through versioned rule data. The report favors cross-chapter repetition and dense local clusters over isolated reuse. It limits each rule's output without hiding the full count.

### Style-pattern concentration

The initial pattern set includes negative parallelism, `not X but Y`, three-part cadence, aphoristic scene closes, rhetorical questions, fragments, em dashes, filter words, repeated transition phrases, paragraph-shape repetition, and repeated chapter-ending syntax.

These rules report concentration rather than prohibition. When an accepted voice baseline is available, the engine compares per-thousand-word or per-sentence rates against that baseline and reports the delta. Without a baseline, it reports counts and local concentration without claiming drift.

Novel Forge will not ship a universal blacklist of fashionable words such as `delve`, `tapestry`, or `testament`. Existing free-form voice guardrails remain editorial context; the deterministic engine does not attempt to interpret them as literal phrases or executable rules.

## Thresholds and exceptions

Thresholds are deterministic, documented, versioned, and scaled to corpus size. Rules that need a minimum sample must return no finding when the sample is too small. Reports show the measured value and the threshold that caused the finding. Initial phrase-repetition rules require either three uses across at least two chapters or four uses in one chapter. Pattern-concentration rules require at least 2,000 corpus words and four matches; without a baseline, they report a local concentration only when its per-thousand-word rate is at least twice the corpus rate.

Accepted voice exceptions and project guardrails take precedence during editorial review, not inside the lint engine. Free-form guardrails cannot deterministically identify exact rule scopes. The engine therefore reports the measured condition unchanged; the reviewer may decline a ticket or record a protected exception after checking the intended scope. The engine does not create, approve, or suppress exceptions.

Generic thresholds identify review candidates only. They must not instruct a writer to hit a target sentence length, dialogue ratio, fragment rate, or punctuation count.

## Review integration and data flow

When an act or manuscript review prompt is requested:

1. the review application loads the active manuscript scope and the current accepted voice baseline metrics;
2. the shared lint engine runs in memory without writing files;
3. the review adapter selects a bounded set of findings, preserving all high-confidence mechanical findings and then the strongest cross-chapter or baseline-relative patterns;
4. the prompt receives a clearly labeled `Deterministic prose-lint evidence` section plus counts of omitted findings;
5. the independent reviewer verifies findings against manuscript context, approved guardrails, and protected exceptions before including them in `review-report.md` or proposing revision tickets;
6. the existing guarded review event remains the only mutation path.

Chapter drafting does not run the full lint suite automatically. This avoids per-chapter noise and latency. Writers may run the explicit diagnostic on a chapter or directory whenever they want earlier feedback.

The primary command is:

```bash
npm run audit:prose -- /path/to/novel-project
```

An optional `--format json` returns the typed finding envelope. Existing audit commands continue to return their filtered Markdown reports.

## Failure behavior

An explicit lint command exits nonzero for invalid input, an unreadable project, invalid configuration, or an internal rule failure. It prints a concise error without modifying files.

Automatic review integration must never skip a failure silently. If supplemental lint cannot run, the review prompt receives a visible `lint unavailable` advisory and continues with normal editorial and structured-integrity review. Existing schema, reference, stage, and transaction validations remain authoritative and may still block an event independently.

One rule failure is isolated from other rules. The report names the failed rule and continues with successful findings, while the CLI exits nonzero to make regressions visible in development and automation.

Large manuscripts use bounded excerpts and per-rule result caps. The engine still computes full counts, reports how many locations were omitted, and uses stable selection rules so repeated runs do not reshuffle evidence.

## Security and privacy

The lint engine is local and deterministic. It makes no network requests, sends no manuscript text to a remote service, executes no manuscript content, and reads only the selected manuscript plus the canonical project artifacts required by enabled rules.

Reports use manuscript-relative paths. Excerpts are bounded, and the review adapter includes only the evidence necessary for the selected review scope.

## Compatibility and migration

Existing projects require no migration and receive no new mandatory artifact. Existing audit package scripts remain available. The feature does not change stage schemas, approvals, reader evidence, research evidence, or accepted voice baselines.

Projects without a voice baseline still receive mechanical, consistency, repetition, and raw pattern-concentration findings. Projects without Novel Forge canonical artifacts may run text-only rules against a directory, matching the current scanner behavior.

## Testing and acceptance criteria

Implementation follows test-driven development. Coverage includes:

- one focused fixture for every rule, including non-matches and intentional Markdown constructs;
- line numbers, excerpts, counts, chapter concentration, and stable ordering;
- corpus-size thresholds and baseline-relative deltas;
- proof that free-form guardrails and exceptions do not change deterministic findings, plus editorial-prompt coverage requiring reviewers to honor them;
- exact and near-duplicate behavior with documented boundaries;
- canonical name, number, chapter, reference, and temporal checks;
- byte-stable structured output for identical inputs;
- bounded review-prompt selection and omitted-finding counts;
- visible, non-blocking automatic-audit failure behavior;
- nonzero explicit-command failure behavior;
- proof that lint and compatibility commands do not mutate project files;
- compatibility snapshots for all eight existing scanner entry points;
- review-prompt budget and normative-parity coverage;
- regression coverage for thriller, romantasy, and historical-fiction projects.

Full verification uses the repository's supported checks:

```bash
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Acceptance requires deterministic output, no prose or project mutation, preserved compatibility commands, and no direct revision ticket created solely by a style-pattern finding.

## Explicit non-goals

- AI-authorship detection or probability scoring
- Plagiarism or external-corpus comparison
- Automatic prose rewriting or replacement suggestions
- Automatic revision tickets from unconfirmed style heuristics
- Universal bans on words, punctuation, sentence lengths, or rhetorical devices
- Human editorial, sensitivity, expert, or reader-validation replacement
- Persona reviewers or simulated reader evidence
- A new top-level creative stage or required project artifact

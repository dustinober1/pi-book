# Novel Forge for Pi

Novel Forge is a guided, series-capable production workflow for high-quality **thriller** and **romantasy** novels. It protects author-specific voice, canon, story threads, causal architecture, memorable book identity, and evidence-backed revision without chasing AI-detector scores.

## Install

After the verified 1.3.0 release tag is published:

```bash
pi install git:github.com/dustinober1/pi-book@v1.3.0
```

## Two-minute quick start

```text
/novel-start My Novel --profile thriller --type planned-series --target-words 110000
/novel
```

Run `/novel` whenever the current action finishes. It reads project state and shows only the choices that matter now: continue, review a gate, request changes, inspect evidence, adopt an existing manuscript, use real-reader evidence, package the book, recover safely, or create the next installment.

The primary author-facing files are:

- `STATUS.md` — the current decision, reason, blockers, warnings, and progress.
- `HANDOFF.md` — the exact resume state and a continuation prompt for another session.
- `books/<book-id>/manuscript/chapters/` — accepted chapter files.

## 1.3 author-taste and research foundation

Novel Forge 1.3 adds typed evidence contracts beneath the existing `/novel` workflow. New projects receive:

```text
series/taste-profile.yaml
series/voice-guardrails.yaml
series/voice-experiments/index.yaml
books/book-01/research-ledger.yaml
books/book-01/book-strategy.yaml
books/book-01/voice-audits.yaml
```

These files keep raw author preferences, neutral voice rules, research claims, reader-facing strategy, and later voice-audit evidence separate from manuscript prose and real-reader experiments.

A guarded `research-update` event may save only allowlisted evidence files during active creative stages. It does not advance the project, change gates or approvals, alter book status, or write manuscript prose. Every accepted update still requires the current stage and project hash, strict schema validation, rollback, one Git checkpoint, and regenerated `STATUS.md` and `HANDOFF.md`.

Rebuilding a voice profile now submits the readable voice profile, taste profile, voice guardrails, and voice-experiment index together. Rebuilding a book plan submits its research ledger and book strategy with the existing architecture files. Planning prompts must translate named influences into neutral craft traits and must not invent public-review evidence.

Existing 1.2 projects remain readable when these files are absent. Novel Forge reports one optional-backfill warning; it does not invalidate existing approvals or manuscript prose. A metadata-only upgrade records the installed version but does not manufacture evidence or hide the warning.

### Influence palette and anonymous voice calibration

Names and titles stay private inside `series/taste-profile.yaml`. Every influence records what it contributes, what must not be borrowed, and the neutral craft traits derived from it. Evidence is resolved in this order: explicit writer decisions, writer samples, accepted baseline, approved voice profile, influence references, then genre defaults.

When calibration is useful, Novel Forge uses one 600–900-word source scene and anonymous variants A, B, and C. The source, variants, typed experiment record, scores, and accepted or combined baseline live under `series/voice-experiments/VE-NNN/` and are saved through `research-update`. Variants are never labeled with author or book names, and aggregate scores summarize evidence without automatically choosing prose.

Source, variant, and baseline hashes must match normalized content. Experiment assets cannot point outside their own directory. Selecting a baseline for final voice approval requires the taste profile, experiment index, experiment record, guardrail baseline, and baseline bytes to agree exactly.

Drafting context receives a bounded **Approved voice guardrails** section containing only neutral must/prefer/avoid/monitor rules and the matching POV signature. Raw influence references, experiment source prose, variants, scores, and unapproved material are excluded. Unsafe existing voice files block drafting instead of leaking into the chapter prompt.

### Research provenance and reader-friction analysis

Research is separated into four lanes: **taste-and-voice**, **story-world**, **human-authenticity**, and **reader-and-market**. Planned and researching items may remain incomplete. A claim marked `ready` must identify registered source IDs, source reliability, an observation or verification date, confidence, fictionalization, knowledge scope, risks, at least one dramatic use, and the exact story decision it affects.

Public-review observations are market evidence, not human reader evidence for the current manuscript. Novel Forge accepts user-supplied manual or CSV observations, stores paraphrases with optional short excerpts, and removes reviewer names, handles, and profile URLs before project mutation. Ratings remain distinct: 1–2 negative, 3 mixed, and 4–5 positive.

Complaint and mixed observations may be clustered only with their supporting IDs. Matching praise remains attached as explicit positive counterweights. Confidence is bounded by sample coverage: fewer than three observations or only one title is weak; at least three observations across two titles is moderate; strong requires at least six observations across three titles, high execution relevance, and a positive counterweight. One-star-only evidence can never exceed moderate.

For each relevant cluster, the writer chooses **prevent**, **mitigate**, **accept as tradeoff**, or **irrelevant to project**. Only prevent and mitigate decisions may become approved review-derived guardrails. Accepted tradeoffs keep their source-cluster provenance. Public observations never update `reader-experiments.yaml`, reader metrics, verdicts, or claims that the manuscript was tested.

New ready chapter packets reference `RES-NNN` research-ledger items. Existing `SRC-NNN` references remain readable as compatibility advisories until the next plan rebuild migrates them. Research-to-graph discovery, voice/scene audits, and the browser research wizard remain later 1.3 phases.

## Voice, scene, and revision-learning audits

Novel Forge treats audits as evidence rather than scoring machinery. When an accepted voice baseline contains both a content hash and baseline metrics, the guarded workflow records deterministic voice evidence after Chapter 1, Chapter 3, act reviews, manuscript review, and explicit recalibration. Missing baseline evidence simply skips the audit; it never blocks drafting.

Voice evidence includes sentence and paragraph distributions, dialogue ratio, fragment and rhetorical-question frequency, filter-word rate, repeated body-language vocabulary, and interiority rate. The stored audit records current signals, baseline metrics, numeric deltas, POV and chapter scope when available, protected intentional exceptions, and an evidence-only assessment. These values are not prose quotas and do not create severity or revision tickets by themselves. A read-only diagnostic is also available:

```bash
npm run audit:voice -- /path/to/novel-project
```

The scene audit uses existing chapter packets and plot-grid state changes. It flags:

- more than two consecutive chapters with the same scene engine;
- one engine occupying more than half of a plan with at least six packets;
- interview, conversation, dialogue, meeting, debrief, or questioning scenes that do not change case, relationship, power, or knowledge state;
- adjacent chapters with indistinguishable normalized state changes.

Deterministic scene findings become revision tickets; they never edit manuscript prose. Tickets may carry a stable recurrence pattern and milestone-review identifier. A pattern becomes eligible for a reusable learning rule only after **three distinct chapters** or **two distinct milestone reviews**. Eligibility is not approval. The writer must explicitly approve the rule in `book-strategy.yaml`, and only approved rules enter future chapter context. Promotion never launches a retroactive rewrite of earlier chapters.

## Guided voice and research wizard

Use the normal `/novel` workflow and choose **Review voice and research evidence**, or open the optional surface directly:

```text
/novel-wizard research
```

The local wizard provides five evidence workspaces:

- **Influence Palette** — capture private references, admired qualities, explicit exclusions, and neutral derived craft traits;
- **Anonymous Voice Comparison** — review only variants A, B, and C, record writer scores, and explicitly accept one or a custom combined baseline;
- **Reader Friction** — preview identity-stripped public-review CSV evidence, build evidence-backed clusters, and record prevent, mitigate, accepted-tradeoff, or irrelevant decisions;
- **Research Ledger** — inspect and validate planned, researching, or ready claims against registered source provenance;
- **Revision Learning** — inspect eligible recurrence patterns and explicitly propose, approve, or reject future drafting rules.

The browser receives a sanitized project snapshot. It does not receive manuscript prose, reader-response bodies, source-scene prose, anonymous variant prose until the writer explicitly opens a comparison, reviewer identity, or arbitrary filesystem access. Every mutation requires a successful preview and returns through the existing `research-update` event with stage/hash checks, typed validation, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.

Public market observations remain separate from real manuscript reader evidence. Scores never choose a voice baseline automatically, readiness findings never invent source support, and learning eligibility never approves a rule on the writer's behalf.

## Graph-aware continuity context

When Novel Forge prepares an approved chapter for drafting, it derives a local continuity graph from the validated project files already in use: canon facts, relationship state, story threads, chapter packets, plot setup/payoff IDs, and research sources.

The resolver starts with the chapter packet's explicit canon, thread, character, and research references, then follows at most two safe links. It may add locked facts and relationships, open or advancing threads, and supporting source provenance that the packet did not list directly. Chapter and source nodes are terminal, so a shared chapter or research document cannot pull unrelated records into the prompt.

Automatic discovery blocks provisional relationships and facts, inactive threads, and canon introduced in a later `book-NN`. An explicitly referenced provisional record retains the existing packet behavior but cannot act as a bridge to additional context. Every selected or blocked graph record carries its depth, source path, and traversal path in the context report.

The graph is deterministic, rebuilt in memory, and disposable. Canonical YAML remains the only source of truth. No graph database, hosted service, embeddings, Python runtime, schema migration, or additional dependency is required.

## Temporary local browser wizard

Novel Forge opens a browser when a workflow is materially easier to review visually:

```text
/novel-wizard adoption
/novel-wizard readers
/novel-wizard packaging
/novel-wizard next-book
```

The wizard:

- binds only to `127.0.0.1` on an ephemeral port;
- uses a random credential carried in the URL fragment and required on every API request;
- rejects unexpected origins;
- expires after inactivity and deletes its temporary upload directory;
- serves no remote scripts, fonts, analytics, or third-party assets;
- can read sanitized project state, create previews, and assemble proposals;
- cannot write project files directly or invoke arbitrary commands.

Every confirmed action returns to Novel Forge's typed application services and preserves expected-stage and project-hash checks, schema validation, rollback, one Git checkpoint, `STATUS.md`, `HANDOFF.md`, and guarded undo.

## Adopt an existing project

Use `/novel`, `/novel-adopt`, or `/novel-wizard adoption`.

Supported sources:

- DOCX;
- EPUB;
- one Markdown or text manuscript;
- a directory of ordered Markdown or text chapters.

Pandoc is preferred when available. A Node fallback keeps DOCX and EPUB workflows usable without Pandoc and records any fidelity limitations.

Before mutation, the wizard previews:

- front matter, chapters, interludes, appendices, and back matter;
- chapter order, numbers, titles, slugs, and destination paths;
- headings, emphasis, quotations, lists, tables, notes, links, scene breaks, and ornaments;
- embedded images, captions, alt text, approximate placement, media types, dimensions, and hashes;
- discovered title, author, language, identifier, and description fields marked **unverified**;
- unsupported layout, tracked-change, comment, font, equation, text-box, and media warnings.

The author may reorder, rename, renumber, split, combine, classify, exclude, move assets, edit captions/alt text, and accept/edit/ignore discovered metadata. The source remains read-only. Adoption refuses an occupied manuscript destination and applies chapters, assets, metadata candidates, `adoption-map.yaml`, `adoption-report.md`, book counts, status, handoff, and Git checkpoint atomically.

Archive safety rejects path traversal, absolute paths, symlinks, encryption, duplicate normalized names, XML external declarations, remote resources, excessive size, excessive entries, excessive media, and suspicious compression ratios before project mutation.

## Reader kits and CSV evidence

Use `/novel`, `/novel-readers`, or `/novel-wizard readers`.

Each experiment owns its files:

```text
books/book-01/reader-kits/
  index.yaml
  RE-001/
    experiment.yaml
    sample.md
    immediate-questions.md
    delayed-questions.md
    responses.csv
    import-report.md
    summary.md
    reader-summary.csv
    reader-summary.xlsx
```

Kit scopes include first page, first chapter, selected chapters, an act, an authorized excerpt, or the full manuscript. The experiment predeclares the exact target-reader segment, sample hash, blind/variant design, questionnaire version, immediate and delayed minimums, and follow-up interval.

CSV import previews before mutation. It shows:

- detected and unmapped columns;
- schema and questionnaire version;
- invalid rows and booleans;
- duplicate reader/phase pairs;
- conflicts with accepted evidence;
- delayed rows without accepted immediate pairs;
- wrong experiment IDs;
- non-human sources.

Conflicts require one explicit choice: keep existing, use imported, or exclude. Existing accepted evidence is retained by default. Only accepted `source: human` rows affect metrics or claims. Reader summaries remain bounded by the declared segment, sample size, pairing quality, questionnaire version, and test design.

Version 1.1 reader files remain readable. A guarded migration copies legacy experiments into isolated directories without changing response fields, metrics, verdicts, timestamps, source claims, or original files.

## Packaging checklist and complete author package

Use `/novel`, `/novel-package`, or `/novel-wizard packaging`.

The checklist shows status, blocking/advisory classification, evidence paths, and an exact repair action for:

- compilable manuscript;
- manuscript approval;
- canon lock;
- blocking revision tickets;
- reader-claim limits;
- publishing metadata;
- marketing metadata and approval state;
- cover, illustration, map, ornament, and other assets;
- copyright, language, territory, edition, publication, and identifiers;
- retailer copy, keywords, and categories;
- audiobook fields;
- accessibility and alt text;
- export readiness.

Canonical metadata lives in:

```text
books/book-01/publishing.yaml
books/book-01/marketing.yaml
```

Generated documents never become the source of truth. A complete package includes:

- manuscript Markdown;
- manuscript DOCX;
- EPUB;
- publishing metadata CSV and XLSX;
- reader evidence CSV and XLSX;
- retailer descriptions, keywords, and categories;
- launch copy;
- social posts;
- ad variants;
- audiobook metadata and promotion;
- series-page copy;
- package manifest;
- packaging and conversion report.

Outputs are built before mutation and committed together. Source hashes identify stale outputs and prevent silent overwrite after the manuscript or canonical metadata changes. Generated marketing remains draft material until approved in `marketing.yaml`.

## Context-aware next book

When the active book is canon-locked or packaged, `/novel` proposes the next available `book-NN` and opens the next-book wizard.

The preview includes:

- series identity and previous book role;
- locked canon facts;
- unresolved or advancing story threads;
- previous profile and target length;
- reader limitations and narrowly supported findings.

The author confirms:

- title or working title;
- role in the series;
- direct continuation, adjacent story, prequel, later installment, or other relationship;
- profile and target length;
- protagonist or primary viewpoint;
- inherited canon IDs;
- continuing and deferred thread IDs;
- immutable facts;
- optional and explicitly excluded context.

Creation writes the standard new-book files plus:

```text
books/book-02/inherited-context.yaml
books/book-02/inheritance-report.md
```

Selected IDs are validated against locked sources. Novel Forge records provenance and does not invent a plot solution, character outcome, reader result, or new canon fact.

## Human gates, status, and recovery

Pending gates show friendly approve, request-changes, and evidence actions. Approval records writer identity, time, evidence hash, and note. Rejection records a specific repair note and keeps the correct gate active.

Every guarded planning, drafting, review, reader, research, revision, canon-lock, package, adoption, migration, metadata, and next-book event refreshes `STATUS.md` and `HANDOFF.md` inside the same rollback-capable transaction and Git checkpoint.

Advanced options include:

- open the full browser wizard;
- explain the current blocker;
- rebuild status and handoff;
- run an integrity check;
- upgrade project metadata;
- undo the last Novel Forge event;
- adopt an existing manuscript;
- force-add a book.

Undo requires initialized Git, a clean worktree, and a `Novel Forge:` commit at `HEAD`. It creates a normal revert commit. Reversing writer approval requires a second explicit confirmation. History is never reset or rewritten.

## Transactional agent changes

The model-facing `novel_apply_event` tool remains UTF-8 text-only. It owns voice, series plan, book plan, chapter queue, drafting, review, reader testing, research evidence, revision, canon lock, and package transitions. It verifies the expected stage and project hash, enforces event-specific file allowlists, validates schemas and references, applies rollback-capable changes, refreshes guidance, and creates one checkpoint.

Binary files are accepted only by trusted internal application services for adopted images and generated DOCX, EPUB, and XLSX outputs. The browser cannot turn the public event tool into a binary upload interface.

## Power-user commands

| Command | Purpose |
| --- | --- |
| `/novel` | Show the recommended action and guided choices |
| `/novel-wizard` | Open the temporary local browser wizard |
| `/novel-start` | Create a standalone or series-capable project |
| `/novel-status` | Rebuild and show status and handoff |
| `/novel-plan` | Build or repair voice, series, or active-book plans |
| `/novel-run` | Advance safe work until a gate, blocker, or limit |
| `/novel-draft` | Draft the next approved chapter packet |
| `/novel-review` | Review a chapter, act, manuscript, or series |
| `/novel-readers` | Open reader-kit and CSV evidence workflows |
| `/novel-revise` | Apply open revision tickets |
| `/novel-package` | Open packaging readiness and export workflows |
| `/novel-adopt` | Open existing-project adoption |
| `/novel-migrate` | Migrate a Genesis v0.4 project |

## Version compatibility

New projects record both the stable project schema and the installed Novel Forge package version.

- Missing or older `novel_forge_version`: readable, with a guided upgrade warning.
- Malformed version: warning and repair path.
- Project written by a newer package: blocker until Novel Forge is upgraded.
- Missing 1.3 taste, strategy, research, or audit files: optional-backfill warning, not a blocker for an existing project.

A metadata upgrade does not change creative stage, gates, approvals, manuscript prose, canon, reader evidence, or research evidence. It does not create missing evidence files.

## Verification and release

The repository's **Novel Forge tests** GitHub Actions workflow is the authoritative verification record for this public repository. Every phase PR and the final merged `main` commit must pass both Node jobs:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

The matrix runs on Node 22.19.0 and Node 24. See `CHANGELOG.md` and `RELEASE.md`; create `v1.3.0` only after all planned phases and the final merged-main verification pass are complete.

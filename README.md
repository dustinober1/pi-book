# Novel Forge for Pi

Novel Forge is a guided, series-capable production workflow for high-quality **thriller** and **romantasy** novels. It protects author-specific voice, canon, story threads, causal architecture, memorable book identity, and evidence-backed revision without chasing AI-detector scores.

## Install

After the verified 1.2.0 release tag is published:

```bash
pi install git:github.com/dustinober1/pi-book@v1.2.0
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

## Temporary local browser wizard

Novel Forge 1.2 opens a browser when a workflow is materially easier to review visually:

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

Every guarded planning, drafting, review, reader, revision, canon-lock, package, adoption, migration, metadata, and next-book event refreshes `STATUS.md` and `HANDOFF.md` inside the same rollback-capable transaction and Git checkpoint.

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

The model-facing `novel_apply_event` tool remains UTF-8 text-only. It owns voice, series plan, book plan, chapter queue, drafting, review, reader testing, revision, canon lock, and package state transitions. It verifies the expected stage and project hash, enforces event-specific file allowlists, validates schemas and references, applies rollback-capable changes, refreshes guidance, and creates one checkpoint.

Binary files are accepted only by trusted internal application services for adopted images and generated DOCX, EPUB, and XLSX outputs. The browser cannot turn the public event tool into a binary upload interface.

## Power-user commands

| Command | Purpose |
| --- | --- |
| `/novel` | Show the recommended action and guided choices |
| `/novel-wizard` | Open the temporary browser wizard |
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

A metadata upgrade does not change creative stage, gates, approvals, manuscript prose, canon, or reader evidence.

## Verification and release

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

See `CHANGELOG.md` and `RELEASE.md`. Create `v1.2.0` only after the feature PR is merged and the resulting `main` commit passes the full Node 22.19.0 and Node 24 matrix.

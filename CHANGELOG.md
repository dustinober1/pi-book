# Changelog

## Unreleased

## 1.4.2 — Repository organization

### Added

- Declarative stage specifications shared by standard and compact prompt renderers.
- Deterministic prompt-compiler benchmarks, snapshots, normative-parity checks, and hard budget diagnostics.
- `/novel-organize` for read-only mixed-repository scanning, provisional source classification, in-place project initialization, hash-verified organization, confirmed archival, manifests, and rollback-safe moves.

### Changed

- Constrained-runtime prompts preserve the same normalized requirements while fitting the configured local and tiny-local budgets.
- Organizer checkpoints commit only explicit organizer paths and preserve unrelated staged or unstaged work.


## 1.4.1 — Documentation and local-release correction

### Changed

- Corrected active installation guidance to use the pinned `v1.4.1` release.
- Added local-only release notes and verification instructions for supervised live-book pilots.
- Kept the existing `v1.4.0` tag immutable; this patch does not use GitHub Actions or remote publishing.


## 1.4.0 — Author Velocity

### Added

- Deterministic author-journey traces for brief-to-book-plan, packet-window drafting, pause/resume drafting, and twelve-ticket revision work.
- Exact counts for questions, prompts, guarded attempts, rejections, retries, approvals, unique completed chapters, peak context characters, and stop reasons.
- An `eval:journeys` command and an author-journey section in `npm run eval`.
- Machine-readable rejection codes and sanitized details across guarded events, wizard applies, HTTP responses, and the Pi tool.
- A bounded one-retry policy for schema/reference payload repairs, with mandatory reload for stale state and no automatic retry for unsafe failures.
- Typed intake and append-only assumption/decision provenance, including numeric setup assumptions, explicit rejection, supersession, and decision replacement.
- A state-neutral `intake-update` event and prompt compilation that uses writer decisions while keeping inference visibly unresolved.
- Read-only brief bootstrap with explicit-versus-inferred intake provenance.
- A neutral premise laboratory that compares structural variants while leaving selection to the writer.
- Persistent bounded runs with explicit targets, pause, resume, cancellation, and stale-state protection.
- Rolling chapter-packet windows that refill only the next useful planning horizon.
- Full, local, and tiny-local runtime profiles with deterministic work and context limits.

### Compatibility and boundaries

- Existing 1.3 projects remain readable; metadata upgrades do not invent evidence or rewrite accepted creative work.
- Writer approval remains mandatory at every human gate, and automation stops at gates, blockers, invalid context, and continuity or reveal-order conflicts.
- Journey baselines use no wall-clock timing or remote service and do not claim literary quality, publication success, or reader validation.


## 1.3.0 — Author-taste and research foundation

### Added

- Nine deterministic 1.3 release evaluation fixtures, an honest clean-project journey, packed-extension clean-start coverage, and a machine-checkable release tree.
- One-time merged-main release automation that verifies the exact commit before creating annotated tag `v1.3.0` and its GitHub release.

- Strict typed contracts for author taste, voice guardrails, anonymous voice-experiment records, research ledgers, book strategy, and voice-audit evidence.
- A `research-update` workflow event that can save allowlisted evidence during active creative stages without changing project stage, gates, approvals, active-book state, or manuscript prose.
- New-project templates for `series/taste-profile.yaml`, `series/voice-guardrails.yaml`, and `series/voice-experiments/index.yaml`.
- New-book templates for `research-ledger.yaml`, `book-strategy.yaml`, and `voice-audits.yaml`.
- Transaction-level validation for every new 1.3 YAML artifact.
- One consolidated optional-backfill warning when an older project does not yet contain the 1.3 evidence files.
- Canonical influence precedence that lets explicit writer decisions, writer samples, accepted baselines, and approved project voice outrank external references and genre defaults.
- Direct-imitation and raw-reference validation for readable voice profiles, compiled guardrails, anonymous variants, and accepted baselines.
- Anonymous A/B/C voice-experiment verification with 600–900-word bounds, normalized SHA-256 hashes, deterministic score summaries, canonical asset paths, and internally consistent baseline selection.
- A bounded `Approved voice guardrails` drafting-context section that includes neutral project rules and the matching POV signature while excluding private influence evidence and experiment prose.
- Four research lanes—taste-and-voice, story-world, human-authenticity, and reader-and-market—with ready-claim provenance, reliability, observation-date, fictionalization, knowledge-scope, risk, dramatic-use, and story-decision validation.
- Privacy-safe manual and CSV public-review observation intake that strips reviewer identity, preserves three-star mixed evidence, and keeps only paraphrases plus optional short excerpts.
- Deterministic reader-friction clustering with title coverage, positive counterweights, weak/moderate/strong confidence ceilings, and a one-star-only cap at moderate.
- Explicit writer decisions for review clusters and typed source-cluster provenance for accepted tradeoffs.
- Ready chapter-packet validation against `RES-NNN` research-ledger state, with advisory compatibility for legacy `SRC-NNN` packet references.
- A decision-and-consequence ledger in `plot-grid.yaml` recording each major choice, immediate gain, deferred cost, irreversible effect, payoff window, and lifecycle status.
- A ten-part pre-approval stress test covering early genre promise, middle repetition, motivated risk, fair information, uneven alternatives, avoidable silence, redundant characters, external and emotional ending contracts, and reference similarity with intentional tradeoffs.
- Deterministic book-plan validation for reader promise, approved expectation decisions, stress-test evidence, setup-before-payoff order, decision consequences, and repeated scene engines.
- Safe `research-item` graph records that connect explicitly required ready claims to mutually registered source provenance while keeping source nodes terminal.
- Bounded `Required ready research claims` and `Approved book guardrails` drafting-context sections that exclude public-review bodies, unrequired claims, and unapproved rules.
- Deterministic voice-metric extraction for sentence and paragraph distribution, dialogue, fragments, rhetorical questions, filter words, repeated body-language vocabulary, and interiority.
- Baseline- and POV-aware voice-audit evidence at Chapter 1, Chapter 3, act review, manuscript review, and explicit recalibration milestones when an accepted baseline exists.
- Deterministic scene audits for more than two consecutive identical engines, whole-plan engine dominance, state-neutral conversations, and adjacent indistinguishable state changes.
- Revision-ticket recurrence metadata and exact promotion eligibility after three distinct chapters or two distinct milestone reviews.
- Writer-approved revision-learning guardrails that enter future drafting context without triggering retroactive prose changes.
- A read-only `npm run audit:voice -- <project-root>` command that prints deterministic JSON evidence and never mutates project files.

- A loopback-only guided research wizard for influence evidence, anonymous voice comparison, public-review friction, research readiness, and revision-learning decisions.
- Sanitized research snapshots and opaque in-memory preview records that exclude manuscript prose, reader-response bodies, reviewer identity, source-scene prose, and unrequested variant prose.
- Preview-before-apply research actions that return through the guarded `research-update` transaction rather than browser filesystem writes.
### Changed

- Package version and new-project metadata are now `1.3.0`.
- Rebuilding a voice profile requires the readable voice profile, taste profile, voice guardrails, and voice-experiment index in one guarded event.
- Rebuilding a book plan requires its research ledger and book strategy in the same guarded event as the existing architecture files.
- Voice planning now supports an optional anonymous calibration loop through `research-update`, followed by the final atomic `voice-profile` bundle.
- Voice and book planning prompts request the complete evidence bundle and explicitly prohibit invented public-review evidence or named-author imitation instructions.
- Book planning may submit source-register provenance atomically with research, strategy, and architecture.
- Book-plan approval now requires the complete Phase 4 stress-test and decision-ledger contract; the validator never approves a plan on the writer's behalf.
- Queue planning uses ready research-ledger IDs for new packets while preserving legacy source IDs as migration advisories.
- Chapter context reports selected research claims and their source provenance separately from canon, threads, and public market observations.
- Review and reader-test prompts explicitly separate public market observations from accepted human responses to the current manuscript.
- Review events may write typed `voice-audits.yaml` evidence without making it mandatory during this foundation phase.
- Chapter 1 and Chapter 3 draft events append voice-audit evidence automatically when accepted baseline metrics exist; missing baselines remain non-blocking.
- Act and manuscript review events append voice-audit evidence and synthesize deterministic scene findings into revision tickets rather than editing prose.
- Approved learning rules are validated against exact recurrence evidence before `research-update` accepts them.
- `/novel-wizard research` and the optional `/novel` research action now expose the five evidence workspaces without replacing the current primary stage or gate action.

### Compatibility

- Existing 1.2 projects remain readable and unblocked when the new evidence files are absent.
- Metadata-only upgrades do not create evidence, change approvals, or hide the optional-backfill warning.
- Planned voice experiments remain valid before variants or a baseline exist; any assets already present must use canonical, unique A/B/C order and paths.
- Legacy source-register records remain schema-readable; extended provenance is enforced only when a ready claim or changed source uses that evidence.
- Unrelated voice or audit evidence updates do not force a legacy research backfill.
- Existing `SRC-NNN` packet references remain draftable with an advisory until a later plan rebuild migrates them to ready `RES-NNN` items.
- Existing plot grids and book strategies without Phase 4 fields remain readable. New projects receive empty decision ledgers and pending stress-test templates; a deliberate book-plan rebuild must complete them before approval.
- Legacy revision tickets, voice-audit records, and book strategies without Phase 5 fields remain readable; recurrence and learning fields are optional until used.
- New books begin with an empty revision-learning guardrail list. No existing ticket, audit, approval, or manuscript is backfilled or rewritten.
- Existing adoption, readers, packaging, and next-book wizard workflows retain their routes, session security, uploads, and apply behavior.
- Existing manuscript prose, reader experiments, publishing metadata, marketing metadata, and continuity-graph safety behavior remain unchanged.
- No dependency or external service is added.

### Safety retained

- `research-update` rejects manuscript, project-state, book-state, guidance, reader-evidence, publishing, marketing, and package-output paths.
- Every accepted evidence update still requires the current stage and project hash, schema validation, rollback, one Git checkpoint, and refreshed status and handoff files.
- Public market evidence remains separate from real human responses to the current manuscript and cannot change reader metrics or validation claims.
- Reviewer names, handles, and profile URLs are removed before public observations enter canonical project files.
- Strong friction confidence requires evidence across at least three titles plus a positive counterweight; one-star-only evidence never reaches strong.
- Only prevent or mitigate decisions may produce approved review-derived guardrails.
- Research-source graph nodes remain terminal, so a shared source cannot pull unrelated claims into chapter context.
- Unready research is blocked from ready packets and automatic graph discovery.
- Raw review observations, raw influence references, unapproved guardrails, and unrelated research claims never enter drafting context.
- Voice metrics never create automatic severity, prose quotas, or revision tickets by themselves.
- Promotion eligibility never activates a rule; only a writer-approved guardrail enters future drafting context.
- Audit and promotion workflows never rewrite earlier manuscript prose automatically.
- Research-wizard snapshots and applies cannot write manuscript, reader-evidence, publishing, marketing, package-output, project-state, or book-state paths.
- The browser serves no remote scripts, fonts, analytics, scraping logic, arbitrary commands, or direct filesystem APIs.
- Experiment YAML cannot borrow arbitrary project files as source, variant, or baseline assets.
- The final taste selection, experiment index, experiment record, guardrail baseline, and baseline bytes must agree before voice approval can proceed.

## 1.2.0 — Existing-project and reader usability

### Added

- Temporary browser wizard launched from `/novel` or `/novel-wizard`, bound only to `127.0.0.1` with a random session credential, exact-origin checks, idle expiration, and session-owned uploads.
- Read/propose/apply browser boundary: the browser never writes project files directly; confirmed actions return through Novel Forge validation, rollback, Git checkpoints, `STATUS.md`, and `HANDOFF.md`.
- High-fidelity adoption previews for DOCX, EPUB, Markdown, text, and chapter directories.
- Optional Pandoc conversion with Node DOCX/EPUB fallbacks.
- Author-controlled section mapping: reorder, rename, renumber, split, combine, classify, exclude, edit asset placement, and accept/edit/ignore discovered metadata.
- Binary-safe guarded transactions for embedded manuscript assets, DOCX, EPUB, and XLSX files.
- Experiment-isolated reader kits under `reader-kits/RE-NNN/`.
- Previewed CSV column mapping, row diagnostics, conflict decisions, merge-safe imports, and reader summary CSV/XLSX files.
- Canonical `publishing.yaml` and `marketing.yaml` for reproducible production and promotional outputs.
- Browser packaging checklist with evidence paths, blocking/advisory status, and exact repair actions.
- Complete package generation: manuscript Markdown, DOCX, EPUB, publishing CSV/XLSX, reader CSV/XLSX, retailer copy, launch copy, social posts, ad variants, audiobook metadata, series-page copy, manifest, and conversion report.
- Context-aware next-book proposals with locked canon, unresolved threads, reader limitations, author decisions, `inherited-context.yaml`, and `inheritance-report.md`.
- A deterministic, in-memory continuity graph derived from approved canon, story threads, chapter packets, plot entries, and research sources.
- Explainable graph-context reports with bounded paths, selected records, and policy-blocked provisional, inactive, or future-book candidates.

### Changed

- Package version and new-project metadata are now `1.2.0`.
- `/novel-readers`, `/novel-package`, and `/novel-adopt` open the temporary wizard instead of applying first-pass workflows immediately.
- Empty manuscripts expose **Adopt an existing manuscript** directly in the guided `/novel` menu.
- Packaging source files are canonical YAML; generated documents are reproducible derivatives and do not become sources of truth.
- Existing package outputs are source-hashed and cannot be silently overwritten after manuscript or metadata changes.
- Drafting context now follows at most two safe continuity links from explicit chapter references, while preserving direct provisional references and preventing unsafe automatic discoveries.

### Compatibility

- Version 1.1 projects remain readable before migration.
- Legacy reader evidence can be copied into isolated v1.2 experiment directories without changing response fields, metrics, verdicts, timestamps, or source claims.
- Legacy `reader-experiments.yaml`, `reader-kit/`, Markdown/text adoption, and all specialist planning/drafting/review commands remain supported.
- The continuity graph requires no new project files, schema migration, external service, or runtime dependency.

### Safety retained

- Human gates cannot be skipped.
- `novel_apply_event` remains text-only and continues to enforce stage, hash, schema, reference, and file-allowlist rules.
- Binary assets are available only to trusted internal application services.
- Reader evidence requires accepted `source: human` rows; non-human rows never affect metrics or claims.
- Undo creates a revert commit and never rewrites history.
- Adoption never changes the source manuscript or overwrites occupied manuscript destinations.
- Canonical YAML remains authoritative; the continuity graph is rebuilt in memory and never mutates canon or story state.

## 1.1.0 — Guided author workflow

### Added

- `/novel` as the primary context-sensitive command.
- Friendly human-gate review cards with approve, request-changes, evidence, and repair paths.
- Decision-oriented `STATUS.md` and automatically regenerated `HANDOFF.md`.
- `START-HERE.md` for new projects.
- Package-version compatibility checks and guided metadata upgrades.
- Short, one-question-at-a-time planning interviews capped at four normal questions.
- Guarded `git revert` recovery, blocker explanation, integrity summaries, and guidance rebuilds.

# Changelog

## 1.7.0 — Quality Orchestration and Grounded Accuracy

### Added

- Explicit economy, balanced, premium, and editorial quality tiers with separate runtime and genre controls.
- Pre-call token and call reservations, actual-usage settlement, and deterministic stop or downgrade behavior.
- Isolated Pi print-mode workers for multi-pass scene planning, candidate generation, independent critics, revision, final review, and persistent runs.
- Privacy-safe schema-two telemetry and `/novel-budget` reporting.
- Bounded evidence anchors for high-risk research and deterministic proposed-claim validation.
- Tier-aware claim extraction, audit, one targeted factual repair, and mandatory re-audit before canonical application.
- An opt-in blinded cost-versus-quality evaluation harness with sealed labels, human review kits, severe-failure diagnostics, and cost aggregation.

### Compatibility and boundaries

- Existing projects without quality state continue to resolve to economy behavior.
- Intermediate quality artifacts remain non-canonical and excluded from Git and package output.
- Every accepted creative change still uses one guarded event transaction.
- Automated diagnostics are not human reader evidence; paid evaluation never runs in normal CI.

## 1.6.2 — Complete Manuscript Approval Evidence

### Fixed

- Manuscript review now compiles every ordered chapter into `delivery/manuscript.md` before the manuscript approval gate becomes pending.
- The compiled manuscript is included in the writer approval evidence hash, alongside the review report, revision tickets, and voice audits.
- Manuscript-review scaffolding checks reject craft-process leakage before approval.

## 1.6.1 — Pi Extension Compatibility

### Fixed

- Replaced an unavailable TypeBox regex constructor so the extension loads in Pi 0.80.10 and compatible runtimes.

## 1.6.0 — Deterministic Prose Lint

### Added

- A unified local, deterministic, read-only `npm run audit:prose -- <project-root>` command with Markdown and JSON output for mechanical, consistency, repetition, and style-pattern review evidence.
- Bounded prose-lint evidence is supplied automatically to act and manuscript reviews; unavailable lint is shown as an advisory while normal review continues without claiming a pass.

### Compatibility and boundaries

- Existing `audit:*` scanner commands remain available through compatible prose-lint forwarders.
- Deterministic prose-lint findings do not detect or establish authorship, prescribe prose quotas, or rewrite manuscript text.

## 1.5.0 — Historical Fiction

### Added

- A first-class `historical-fiction` profile with balanced defaults, exact genre settings, planning questions, packet requirements, drafting rules, review lanes, and ending rules.
- Guarded `historical-context.yaml` and `invention-ledger.yaml` artifacts with strict v1.5 schemas, conditional project creation, transaction validation, project hashing, and integrity checks.
- Risk-based historical research, chronology and knowledge-boundary joins, exact invention approvals, and major-counterfactual policy enforcement.
- A bounded Historical scene contract containing only chapter-referenced evidence, plus conditional Historical Note packaging and disclosure checks.
- Historical selection across `/novel-start`, migration, repository organization, the next-book wizard, and per-installment profile changes.

### Compatibility

- Thriller and romantasy projects receive no historical artifacts or historical-only findings.
- Historical fiction uses the existing `/novel`, research, review, revision, recovery, and package workflows; no dedicated browser, scraper, citation manager, or alternate-history system was added.

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

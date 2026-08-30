# Changelog

## 2.2.1 — Release Verifier Consolidation

### Fixed

- Replaced 18 near-duplicate `scripts/verify-vX-Y-Z-release.ts` files and their 18 matching `tests/vX-Y-Z-release-checklist.test.ts` files with shared `check()`/`text()` helpers (`scripts/lib/release-check.ts`), a `scripts/lib/release-registry.ts` mapping each shipped version to its own preserved check function, one stable `scripts/verify-release.ts` CLI entry point, and one consolidated `tests/release-checklist.test.ts`. Cutting a future release now means adding one check file and one registry entry; `verify:release` and `test:release` do not change again.
- Every historical release's own frozen check function is preserved exactly as it shipped — verified by an automated diff of every check's output against the pre-consolidation source before any file was deleted — so each historical entry still reports itself correctly superseded against a later tree instead of passing.

### Compatibility and boundaries

- No manuscript text, project schema, workflow state, or evidence content changes.

## 2.2.0 — One Run to a Packaged Book on a Local Model

Novel Forge already contained everything a one-run completion on a non-frontier model needed — a per-scene execution machine, bounded repair, run targets, headless packaging, capacity detection, journey instrumentation, and the beginning of typed event input. All of it was built and almost none of it could be reached from the path a writer or an automated run actually took: `--model-profile` was parsed and discarded, the scene machine advanced one node per tool call with nothing driving it, no run target reached past manuscript review, headless packaging had no caller outside the browser wizard, and every project defaulted to the widest context with the least supervision regardless of the model running it. This release is the wiring, in the order that made each next piece reachable: make the small-model profile selectable and its prompts fit, bound the repair cycle so a loop over it is safe, add the loop, let a run aim at the finished book, choose sane defaults automatically, measure what a run actually costs, and take the first step away from hand-authored YAML entirely.

### Added

- `--model-profile` now works end to end. `/novel-start` and `/novel-organize` accept it and write `runtime.model_execution_profile` into the new project, which is the setting guarded scene execution and quality drafting already read; `/novel-draft` and `/novel-run` accept it as a per-invocation override that is snapshotted on the persistent run, so a resumed run keeps the profile it started with. The flag was parsed by both option parsers for two releases and then discarded by every caller, so the small-model execution profile — per-job token budgets, constrained decoding, Gemma fingerprint qualification — was unreachable through any shipped path. `custom` is rejected at parse time with the selectable list, because it requires a validated profile definition no flag can carry. The resolved profile now appears in `/novel-status`, `/novel-budget`, and the session handoff beside genre, runtime, and quality, and selecting the deprecated `small-12b-q4` alias surfaces its advisory.
- A profile × stage × genre prompt-compile matrix (135 cells) runs in CI and in `benchmark:prompts`. Every registered stage spec must compile under every runtime profile and genre with representative worst-case inputs. The `book-plan` spec exceeded `tiny-local`'s 6,000-character instruction ceiling for two releases, so the profile bricked permanently at stage three of eleven and nothing failed before a live session, because the prompt benchmark only ever compared `full` against `local`. An expected-overflow cell pins that the unsplit spec still exceeds `tiny-local`, so the phase split below cannot silently become dead code.
- **A driver loop for chapter execution.** `runChapterExecution` advances the persisted scene state machine until a real stop: a writer gate, a blocker, a pause, budget exhaustion, the scene repair limit, an abort, or a step-count backstop. `novel_advance_chapter_step` and `/novel-chapter-step` accept `until: chapter-complete` to use it, defaulting to the existing one-stage behavior. `advanceChapterExecutionStep` advances exactly one node, and for two releases its only non-test callers returned after a single step — putting roughly two thousand host-driven tool calls between an idea and a novel. The loop adds no authority: it stops exactly where a single step stops, acceptance still ends in the same guarded commit, and it re-asserts the writer-gate check itself rather than trusting whoever resolved the target.
- **Automation takes the guarded path.** `/novel-run` now routes each chapter through guarded scene execution whenever an executable contract exists, falling back to whole-chapter drafting otherwise, and reports how many chapters used which path. The automated run previously never used the scene machine at all, because nothing drove it, so critics, targeted repair and ordered acceptance never ran on the automated path regardless of contract availability. A fallback now returns the same disclosure advisory the `draft-chapter` event does, and the run relays it.
- **A run can be aimed at the end.** `--until packaging` and `--until complete` join the gate targets; the furthest a single command could previously aim was the manuscript-review gate, several stages short of a finished package. A target names where the writer is aiming, never what may be crossed — every intervening gate still stops the run.
- **Headless packaging.** `/novel-package --apply` produces the manuscript, EPUB, DOCX, CSV/XLSX metadata, marketing copy, manifest and report without starting a browser. `applyPackageArtifacts` previously had exactly one caller — the packaging wizard handler — so on a machine with no browser the package could not be produced at all. The wizard remains the default for interactive work.
- **The human reader checkpoint is visible from drafting onward.** It appears in status warnings, in the project snapshot, and as a blocking packaging-checklist item with its remaining distance named, instead of surfacing only at the last gate with nothing left to do about it.
- **A recorded waiver for packaging without reader evidence.** A writer who intends to publish without asking a reader records an explicit decision in `series/decision-ledger.yaml` — subject `package-without-reader-evidence`, choice beginning `accept:` — through the existing `intake-update` event, matching how historical inventions already work. It is a recorded decision rather than a command-line flag because a choice this consequential should leave a durable, attributable record instead of living in one invocation's argv.
- **`/novel-start` chooses a runtime profile from the host model's context window.** New projects defaulted to `runtime.profile: "full"` paired with the `economy` quality tier — the widest context and the least supervision, handed out by default in a package whose stated differentiator is constrained runtimes. The choice and its evidence are reported at creation, alongside all four controls; `--runtime-profile` and `--model-profile` always win.
- A **Running on a local model** section in the README, with a local example. `NOVEL_FORGE_QUALITY_PROVIDER` and `NOVEL_FORGE_QUALITY_MODEL` are the only way to point the isolated workers at a local model and previously appeared exactly once, with an OpenAI example.
- **Author-journey traces recorded from real runs.** Guarded events (accepted and rejected, with retries linked to the rejection they correct), writer approvals, host turns, run-state transitions, context size and stops are emitted by the paths that actually do the work. The project's author-velocity baseline previously evaluated four hand-authored YAML fixtures — a schema test for a counter — and "how many author actions does a book cost" is the central question of the whole small-model effort. `summarizeJourneyVelocity` reports chapters completed, author actions, host turns, and per-chapter rates.
- New projects ship a `.gitignore` covering `.pi-book/`, so Novel Forge's operational tree stops appearing as uncommitted files in the writer's own repository.
- **`novel_complete_chapter_contract`.** The model supplies the two decisions that are genuinely its own — `required_end_state` and `forbidden_changes` — as typed values. The tool derives the rest, serialises the YAML itself so a malformed scalar is impossible rather than merely discouraged, and applies the result through the same guarded `chapter-queue` event. `start_state_ids` and `knowledge_boundary_ids` are resolved from `series/state-ledger.yaml` and `series/knowledge-ledger.yaml` during skeleton compilation, so a compiled skeleton now asks the author for two fields where it previously asked for four.

### Changed

- The nine public-review evidence rules in the book-plan prompt are state-conditional: on a project whose `book-strategy.yaml` records no observations or clusters they are inapplicable and omitted whole, with a named guard in their place. This is omission of whole inapplicable rules, never truncation — the compiler still throws rather than shortening a rule that applies. An unreadable strategy file loads the full rules, the safe direction.
- Where the whole book-plan contract still exceeds a compact instruction budget, the prompt now compiles as **two phases feeding one guarded event**: architecture (book bible, genre, plot grid, chapter queue, continuity delta, remarkability), then evidence (research ledger, book strategy, provenance, story threads, and the historical-fiction files) via `/novel-plan book --phase evidence`. The architecture phase applies nothing; the evidence phase submits the complete required set from both phases as one `book-plan` event, so splitting the instructions never splits the transaction. `full` and `local` keep the single prompt. With this, `tiny-local` reaches `book-plan-approval` for every genre.
- **The repair cycle is bounded.** `RuntimeProfile.maxRepairAttempts` was declared, set to 2 in all three profiles and asserted by a test, but read by no code, so `deterministic-validation → span-repair → deterministic-validation` — a loop `critic-review` and `state-delta` can both re-enter — was unbounded. A scene that cannot pass validation within its profile's allowance now blocks with `repair-limit`, naming the scene and the failing checks. This was a prerequisite for the driver loop: a loop over an unbounded cycle is a defect amplifier.
- **No runtime profile caps a run at one chapter.** `tiny-local` and `local` set `maxChaptersPerRun: 1`, so on exactly the profiles a local-model user must choose, a forty-chapter book needed at least forty writer-initiated runs before any gate stopped it. The `--max-chapters` ceiling and the `max_chapters_per_run` schema maximum rise from 10 to 200; artifact, revision-ticket and graph-depth limits per profile are unchanged, because those bound how much a small model holds at once.
- Affordability thresholds are derived from each runtime profile's own instruction, evidence, reserved-output and safety budget rather than hardcoded window sizes, so changing a profile's budget moves its own threshold instead of letting it silently outgrow one.
- The hand-authored `evals/journeys` fixtures are now described as **evaluator regression cases** in `npm run eval` and in their test, not as a velocity baseline. They still verify the counter reads a trace correctly; they were never evidence about the workflow.

### Compatibility and boundaries

- `PersistentQualityDraftResult.chapters` entries are now outcome records carrying `chapter`, `path` and `reason`; the orchestrator result moves to `draft` and the execution result to `execution`. The result also carries `advisories`, which callers must relay. `modelExecutionProfile` is optional on the automation run schema; projects and runs recorded by earlier versions remain readable, and a project without `runtime.model_execution_profile` resolves to `host-default` exactly as before.
- The exact-model execution profile is recommended **only** when the environment names a model — recommending it blind would write a value into `PROJECT.yaml` that makes the first guarded call fail. An undetectable context window warns and defaults to `local` rather than blocking on a question, so a fully-specified `/novel-start` stays scriptable. The `economy` quality-tier default is unchanged: raising it would increase spend, and this project does not silently increase spend.
- Without the reader-evidence decision the `package` block is **unchanged**: still `human-gate-required`, still not retryable, now naming both remedies. The waiver permits packaging and nothing else — it never writes `reader-experiments.yaml`, never counts as reader evidence, and never licenses describing the book as reader-tested; the package manifest and report both state that no human has read the book. The `reader-checkpoint` module is read-only by construction, and a release check enforces that it acquires no write.
- Traces are diagnostic and never canonical: they live under the ignored `.pi-book` tree, never enter a guarded event, are excluded from the package, and nothing reads them to make a workflow decision. Privacy follows the existing telemetry rule exactly — identifiers, action names, outcomes, gate names, counts and stop reasons; never prompts, prose, source excerpts, model output, reasoning, or credentials — and `assertPrivacySafe` refuses any event carrying a field outside its declared shape. Recording is skipped when a project sets `runtime.telemetry: false`, and every recording call is best-effort. Questions asked before a project exists are not recorded, because there is nowhere to record them yet — a known undercount, stated rather than papered over.
- **Derivation is not invention.** Every field `novel_complete_chapter_contract` derives names a record that already exists with an established status, scoped to the chapter's own subjects; a project with empty ledgers derives nothing and leaves the fields missing. Every record ID is still verified against the ledgers, so typing the input cannot move invention from malformed YAML into well-formed nonsense, and the guarded event still validates schema, references, allowlists, story integrity and the working tree. `required_end_state` and `forbidden_changes` remain the author's — decisions about the story, not facts about the graph.
- No event validation, gate, or guarded-transaction behavior changed beyond what is listed above. Human gates, complete-record context allocation, and telemetry contents are unchanged. Nothing in this release lets automation cross a gate or apply a creative change outside one guarded event.

## 2.1.0 — Relationship Inheritance and Ending-Contract Evidence

### Added

- Next-book inheritance now surfaces locked `series/canon.yaml` relationships (state, trust, public/private status, unresolved items) alongside canon facts and threads, and lets the writer select which carry into the new book's `inherited-context.yaml` via `inheritedRelationshipIds`. Previously only flat canon facts and story threads were inheritable; a couple's relationship state had to be manually re-derived for every subsequent book in a series. The browser next-book wizard exposes the same selection.
- Romantasy's declared `ending_contract` (hea / hfn / series-progress / tragic-by-design) is now backed by evidence. `book-strategy.yaml` gains a `delivered_ending` field, writable through the existing `research-update` event at manuscript-review or packaging stage. A new blocking `ending-contract` packaging checklist item requires a delivered ending to be recorded and requires it to match the declared contract; a mismatch names both values. This does not read the manuscript automatically — matching the project's existing boundary that automated checks are not human reader judgment — it only makes sure the promise-vs-delivery question is answered and checked deterministically before packaging.

### Fixed

- The guided `/novel` screen offered a "Review plan change PC-NNN" action that no handler dispatched, so selecting it silently did nothing and the writer had no route from the guide to the plan-change decision. The action now presents the request and records approval or rejection with the same confirmation and writer note `/novel-plan-change` requires. The dispatch is exhaustive over `GuideActionId`, so a guide action added without a handler now fails to compile instead of falling through at runtime.
- Completed the 2.1.0 release set. The feature commit bumped `package.json` and this changelog but left `NOVEL_FORGE_VERSION` reporting `2.0.1`, wrote no release notes, kept `README.md` and `RELEASE.md` pinned to 2.0.1, and left `verify:release` targeting the 2.0.1 checker — four tests failed on that drift and any project created from the branch stamped itself `2.0.1`. Version assertions that mean "stamps the current version" now derive from `NOVEL_FORGE_VERSION` rather than repeating the literal, and one new test asserts the whole release set reports the same version together, so a partial release cut fails in one place instead of four unrelated ones.
- Removed `probe.ts`, a debugging script left at the repository root.

### Compatibility and boundaries

- `inherited_relationship_ids` is optional on `InheritedContext`, so `inherited-context.yaml` files written by prior versions remain readable.
- The `ending-contract` checklist item only applies to `romantasy` books; thriller and historical-fiction packaging are unaffected.
- No existing event type, gate, or schema field was removed or narrowed.

## 2.0.1 — Novel-Start Project Discovery Fix

### Fixed

- `requireProjectRoot` now resolves the project a `novel-start` invocation just created, even when the command that follows it — `/novel`, `/novel-status`, `/novel-budget`, `/novel-plan`, `/novel-draft`, `/novel-review`, `/novel-revise`, `/novel-package`, `/novel-adopt`, `/novel-wizard`, either guarded-event tool, chapter-step, or plan-change — runs from the same, unmoved shell directory. `novel-start` creates its project one directory below cwd; every resolver previously walked upward from cwd only, so the exact sequence shown in the README quick start (`/novel-start ...` immediately followed by `/novel`, no `cd` in between) failed with "No Novel Forge project found." The fallback resolves automatically when exactly one immediate subdirectory of cwd is a Novel Forge project, and names every candidate in an actionable error when there is more than one.
- This fallback is scoped to `requireProjectRoot`, not the lower-level `findProjectRoot` used by the repository organizer's ancestor-nesting guard, so a sibling Novel Forge project next to a directory being organized cannot be mistaken for an ancestor and block the scan.

### Compatibility and boundaries

- Pure discovery fix. No project schema, workflow state, event validation, or evidence content changed. A cwd that already resolved a project resolves the same project as before; a cwd with no project above and no sibling project below still fails the same way.

## 2.0.0 — Making the Quality Path the Default Path

Novel Forge already contained three subsystems for catching prose that reads as generated — prose-lint's sixteen style-tell rules, repetition memory feeding the style card and context capsule, and the five scene critics. All three were well built, and none could be reached from the path an agent actually took. Guarded scene execution required an executable chapter contract; when `contracts/chapters/` was empty an agent listed it, found nothing, and fell back to a plain `draft-chapter` event, disabling all three at once. This release is mostly wiring, plus the checks that wiring made possible.

### Changed

- A `chapter-queue` event now compiles a chapter contract skeleton for every ready packet, so the contracts directory is never empty and an empty listing is never a reason to skip the guarded path. The skeleton carries only what the packet determines; `start_state_ids`, `required_end_state`, `forbidden_changes`, and `knowledge_boundary_ids` are deliberately left empty and named in `missing_small_model_fields`, because generating plausible values would make guarded execution appear available while running against a hollow contract. An authored contract, on disk or submitted with the event, is never overwritten.
- Style-pattern rules are now measured against a shipped table of absolute published-fiction reference bands. Every rule was previously relative — compared either to an accepted author baseline or to the rest of the corpus — and both comparisons go quiet on a manuscript that is uniformly AI-flavored. `defaultVoiceGuardrails()` ships a null baseline, so on any project that never accepted one the stronger branch was silently disabled and reported nothing. Absolute bands also make single-chapter linting possible, since the corpus-concentration fallback needs several documents to mean anything.
- A book plan whose chapters all carry the same `target_words` is now **rejected**. This corrects a tension introduced in 1.10.0: holding a draft to 85%–110% of its packet target is right, but if every packet carries the same target the band enforces metronomic pacing. Variance has to live in the plan.
- A `package` event now **requires** at least one recorded human reader response. The rejection carries `human-gate-required` and is not retryable. The bar is that evidence exists, not that it is favourable — a `rejected` verdict is still real reader evidence, and whether to publish anyway is the writer's decision.

### Added

- Deterministic prose lint runs on every `draft-chapter` event, against the submitted text rather than the copy on disk, reported through the 1.10.0 advisory channel. The first style signal previously arrived at act review, five to eight chapters after the voice had set.
- Per-character dialogue differentiation. Dialogue is attributed to named speakers and each speaker measured on sentence length, contraction rate, question rate, word length and vocabulary range; adequately-sampled pairs that cannot be told apart are reported. Every measure must agree before a finding is produced, so one shared trait is never enough. Nothing in the project previously examined character voice as distinct from narrator voice.
- Structural rhythm advisories for low chapter-length variance, perfectly periodic POV rotation, one causal joint dominating the plot, and repeated chapter-ending beats. Book-plan warnings previously had no delivery path and were discarded.
- Repetition-memory constraints are carried into the drafting prompt, so the drafter knows which patterns the manuscript has already formed.
- A `draft-chapter` event reports when no accepted voice baseline exists, so silence and "the strongest rules were disabled" are no longer indistinguishable.
- `SKILL.md` documents the reference bands, character-voice measurement, structural rhythm checks, the reader checkpoint, and the contract-skeleton workflow.

### Compatibility and boundaries

- Two new classes of event are rejected where they previously applied: a book plan with entirely uniform chapter targets, and a `package` event with no human reader evidence. This is why the release is a major version.
- Every style finding is review evidence, not authorship detection. The tool never claims a passage was machine-written, and a deliberate voice choice can legitimately sit outside a band. The band values are calibration defaults chosen to sit clear of ordinary stylistic range, not quotas to optimise against.
- No project schema, workflow state, or evidence content changed. Contract skeletons are additive and existing projects remain compatible.

## 1.10.0 — Chapter Length and Working-Tree Enforcement

### Changed

- A `draft-chapter` event now measures the submitted chapter against its packet's `target_words`. Inside 85%–110% of target it passes silently, as before. Outside that band the event still applies and returns an advisory. Below 60% or above 150% of target the event is **rejected** as a retryable `payload-validation` problem. Previously nothing anywhere compared a hand-drafted chapter to its plan: only the guarded scene path enforced a range, so a book planned at 9,000 words per chapter could accumulate 5,000-word chapters silently.
- Every event now checks its submitted paths against Git. A path already holding uncommitted changes was written outside a guarded event: if that content differs from the submission the event is rejected, because applying it would discard the uncommitted work; if it matches, the event applies with an advisory. `projectStateHash` cannot see these writes — it excludes `chapter-queue.yaml`, `plot-grid.yaml`, `remarkability.yaml`, and the manuscript tree — so the transaction boundary was previously guidance only.

### Added

- `novel_apply_event` and `novel_validate_event` return advisories: accepted-event findings that need no resubmission but that the writer would otherwise never see. They are rendered in the tool result text, under `Report these to the writer in your summary:`, rather than only in structured details.
- A `draft-chapter` event with no executable chapter contract now discloses that the chapter was drafted without guarded scene execution — no scene critics, no targeted repair, no ordered acceptance — naming the missing contract path. `SKILL.md` already required agents to say this, but the only machine text that said it came from `novel_advance_chapter_step`, which an agent skips entirely once it sees an empty contracts directory.
- `SKILL.md` documents the chapter-length bands, states that the project-root boundary is enforced rather than merely requested, requires advisories to be reproduced for the writer, and requires summaries to distinguish tool-verified claims from the agent's own assessment of its prose.

### Compatibility and boundaries

- This release adds validation: a `draft-chapter` event more than 40% under or 50% over its packet target, and any event whose submitted path holds differing uncommitted work, are now rejected where they previously applied. Both are retryable and both name their remedy; `target_words` remains changeable through a `plan-change` event. No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.9.1 — Drafting Boundary and Path Diagnostics

### Fixed

- A rejected `draft-chapter` or `revise` manuscript path now states the required directory and the file naming rule: the file name must begin with the chapter number (`001-the-midnight-hatch.md`), not merely contain the word "chapter". `SKILL.md` documents the same rule.
- `SKILL.md` now forbids creating, moving, renaming, or deleting any file inside the project root by any means other than a guarded event, keeps in-progress prose outside the project root, and states that a rejection never licenses rearranging the working tree.
- `SKILL.md` no longer directs agents to read the implementation source, which may be a different version than the one installed; it points to the installed skill, the project's files, and `novel_validate_event`.
- A missing or non-executable chapter contract now explains that the contract is authored rather than generated, which fields it needs, that `chapter-queue` allowlists its path, and that `draft-chapter` is the interim path — with an explicit requirement to disclose that guarded scene execution did not run.
- `novel_advance_chapter_step` enumerates its `critics` values instead of accepting any string.
- `SKILL.md` lists `payload-validation` among the retryable rejection codes, matching the v1.9.0 runtime.

### Compatibility and boundaries

- Validation strictness is unchanged; only diagnosis and guidance changed. No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.9.0 — Actionable Rejections and Dry-Run Validation

### Added

- `novel_validate_event` validates a proposed event against the identical contract without applying it: no writes, no Git checkpoint, no stage or gate change, and no retry budget consumed. `SKILL.md` and the generated stage prompts direct agents to converge with it before calling `novel_apply_event`.

### Fixed

- Schema failures now report real instance paths and expand a failed union against the closest-matching variant, so the message names concrete fields instead of `Expected union value` at the union's own path. A union of literals lists its allowed values, and output is deduplicated and capped with a remainder count.
- Profile packet findings name the chapter they came from, instead of repeating identical unattributed lines once per packet.
- Profile, remarkability, reader-evidence, book-strategy, packet-window, research-and-friction, and missing-required-output blockers classify as the new retryable `payload-validation` code instead of falling through to `unknown` and instructing the agent to stop automatic work.

### Compatibility and boundaries

- Validation strictness is unchanged: the same events are accepted and rejected as before. No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.8.0 — Aggregated Event Validation

### Fixed

- A rejected `novel_apply_event` now reports every validation problem it found across all layers — required output files, YAML and schema shape, profile packet fields, cross-artifact references, remarkability, book strategy, packet windows, and historical integrity — in one numbered rejection, instead of throwing at the first failing layer. A submission with a single problem reads exactly as it did before.
- The retryable rejection instruction no longer says "Correct only the rejected payload and resubmit once", which contradicted the rule that an event is validated as a complete file set and caused `missing its required output file` rejections. It now says to resubmit the complete required file set with every listed problem corrected.
- `SKILL.md` now lists the required output set for `voice-profile`, `series-plan`, and `book-plan` events — including the two extra files a `historical-fiction` book plan must carry — and states that rejections are aggregated.

### Compatibility and boundaries

- Validation strictness is unchanged: the same events are accepted and rejected as before. Wrong-stage, stale-stage, stale-hash, duplicate-path, and allowlist failures still stop immediately rather than aggregating. No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.7.4 — Registered Source Provenance Guidance

### Fixed

- `SKILL.md` now states explicitly that every `source_ids` entry on a historical chronology, constraint, or knowledge-boundary item must be the `id` of a source actually registered in `research/source-register.yaml`, never a raw file path or in-project document name such as `series/series-bible.md`. It also states the concrete fix: register a source entry (with a stable `SRC-NNN`-style `id` and a `location` naming the document), submit `research/source-register.yaml` alongside `historical-context.yaml` in the same `book-plan` event, and reference the registered `id`.

### Compatibility and boundaries

- No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.7.3 — Decision-Ledger Event Boundary Guidance

### Fixed

- `SKILL.md` now states explicitly that `series/decision-ledger.yaml` is never an allowed file for a `book-plan` event, even when the plan resolves author decisions as part of its reasoning. Decision-ledger evidence must go through its own prior `intake-update` (or, for a `historical-fiction` book, `research-update`) event, not be bundled into the `book-plan` file set.

### Compatibility and boundaries

- No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.7.2 — Guarded YAML Authoring Guidance

### Fixed

- `SKILL.md` now requires quoting any YAML scalar containing `: ` before submitting a guarded event, and requires using only the exact schema field names for nested objects, so a hand-authored payload cannot silently fail YAML parsing or schema validation.
- The `remarkability.yaml` template documents the exact allowed keys for `signature_moments`, `productive_disagreements`, and `recurring_motifs`, so the model has a concrete shape to copy instead of inventing extra fields that fail schema validation as additional properties.

### Compatibility and boundaries

- No project schema, workflow state, or evidence content changes. Existing projects remain compatible.

## 1.7.1 — Release Workflow Consolidation

### Fixed

- Replaced five hardcoded per-version release workflows with one `release.yml` that reads the package version at run time, so cutting a future release no longer requires adding a new CI workflow file.

### Compatibility and boundaries

- No manuscript text, project schema, workflow state, evidence content, or runtime behavior changes.

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

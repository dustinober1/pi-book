# Plan — one-run novel completion on non-frontier models

Date: 2026-08-07
Base commit: `f6f48b3` (`release: cut v2.1.0`)
Source review: `docs/reviews/2026-08-07-one-run-small-model-review.md`

Target outcome: a writer with a local 12B-class model can run
`/novel-start … --runtime-profile local --model-profile gemma-3-12b-it-qat-q4_0`
and reach a packaged manuscript through writer gates and budget stops only —
never through a missing driver, an unreachable setting, or an arbitrary counter.

---

## Ordering rationale

The findings are not independent. Three of them gate the rest:

- **Reachability before autonomy.** Automating a path nobody can select
  (`--model-profile` is discarded) or that cannot compile (`tiny-local` book-plan)
  just automates the wrong configuration faster. Phase 1 first.
- **Bounding before looping.** `RuntimeProfile.maxRepairAttempts` is declared,
  defaulted to 2 in all three profiles, asserted by a test — and read by nothing.
  The `deterministic-validation ↔ span-repair` cycle is therefore unbounded. That
  is survivable while a human calls `novel_advance_chapter_step` once per node; it
  is not survivable inside a driver loop. Bound it in the same phase as the loop.
- **Red before green.** `main` fails 4 of 941 tests. Every phase below claims "CI
  green" as its acceptance criterion, which is meaningless until Phase 0 lands.

Phases 0–4 make the goal reachable. Phase 5 makes it measurable. Phase 6 is a
separate, larger track that changes the model-facing interface itself; it is
scoped here but deliberately not sequenced with the rest.

## Invariants — no phase may weaken these

Each phase's review must confirm all six explicitly.

1. Every accepted creative change still ends in exactly one guarded event with
   stage/hash checks, allowlists, schema and reference validation, rollback,
   status/handoff regeneration, and a Git checkpoint.
2. Human gates are never bypassed, auto-approved, or inferred. A driver loop stops
   at a gate; it never crosses one.
3. Structured context stays complete-record-or-omitted. Required overflow stops
   before inference and names the missing IDs.
4. Telemetry stores hashes, usage, cost, tier, pass and safe finish categories —
   never prompts, prose, source excerpts, model outputs, reasoning, or credentials.
5. Automated diagnostics never become human reader evidence, and never write
   `reader-experiments.yaml`.
6. No normative rule is silently truncated to fit a budget. A rule that does not
   apply to current project state may be omitted; a rule that applies may not be
   shortened to make a number fit.

---

## Phase 0 — Restore a green default branch

**Problem.** `package.json` is `2.1.0`; `NOVEL_FORGE_VERSION` is `"2.0.1"`
(`src/application/version-core.ts:3`), so projects created by this code stamp
themselves with the previous version. `docs/releases/v2.1.0.md` does not exist,
`README.md`/`RELEASE.md` pin 2.0.1, and `npm run verify:release` still runs
`verify-v2-0-1-release.ts`. Four tests fail on exactly this.

**Decide first:** is 2.1.0 released or not? The commit says cut; the tree says no.
Pick one.

- If released: finish it (below).
- If not: revert `package.json` to `2.0.1`, move the 2.1.0 CHANGELOG entry under an
  `## Unreleased` heading, and defer the rest.

**Changes (release-forward path).**

- `src/application/version-core.ts` — `NOVEL_FORGE_VERSION = "2.1.0"`.
- `docs/releases/v2.1.0.md` — new, from the existing CHANGELOG 2.1.0 entry.
- `README.md`, `RELEASE.md` — install examples, "current verified release", the
  focused-documentation link, and a 2.1.0 release record section.
- `scripts/verify-v2-1-0-release.ts`, `tests/v2-1-0-release-checklist.test.ts` —
  new, mirroring the 2.0.1 pair.
- `package.json` — point `verify:release` at the new script; add the new checklist
  test to `test:release`.
- `tests/e2e/packed-clean-start.test.ts` — expects a project stamped `2.1.0`.

**Also in this phase**, because both are one-line-ish and unrelated to any other
work:

- Handle `plan-change` in `guidedNovel` (`src/pi/extension.ts:174`–`:209`); it is
  offered by `buildGuideScreen` (`src/application/guide.ts:112`) and currently
  falls through the dispatch chain silently. Route it to the same approve/reject
  flow `/novel-plan-change` uses.
- Delete `probe.ts` from the repository root (leftover debug script).

**Tests.**

- Every `GuideActionId` the screen can emit has a handler. Assert over the union
  type so a new action id fails to compile rather than failing silently — this is
  the class of bug, not the instance.
- Existing release-checklist tests pass unmodified in shape.

**Acceptance.** `npm run typecheck && npm test && npm run eval && npm run
verify:release && npm run test:release && npm pack --dry-run` green on Node
22.19.0 and Node 24.

**Follow-up (not blocking).** `scripts/` holds 16 `verify-v1-*-release.ts` files
and `package.json`'s `test:release` names 17 checklist files on one line. Fold
frozen checks behind one version-parameterised verifier driven by a manifest, so
the directory stops growing linearly with releases. Do this *after* Phase 0, so
the refactor is not entangled with fixing the drift.

---

## Phase 1 — Make the small-model configuration reachable and compilable

Two independent defects, same phase because neither is useful alone.

### 1a. Thread `--model-profile` end to end

**Problem.** `project.runtime.model_execution_profile` is the only source of the
small-model tuning (`src/application/chapter-execution-preparation.ts:198`), and
nothing writes it. `parseDraftOptions` and `parseRunOptions` parse
`--model-profile` (`src/pi/arguments.ts:81`, `:154`); both callers destructure
everything except that field (`src/pi/recalibration-extension.ts:83`, `:175`).
`/novel-start` does not list it in `flagsWithValues` and never reads it, though
`initializeProject` → `projectTemplateFiles` already accepts it
(`src/project/templates.ts:143`).

**Changes.**

- `src/pi/extension.ts` — add `--model-profile` to `novel-start`'s
  `flagsWithValues`, parse with `parseModelExecutionProfileId`, pass through
  `initializeProject`. Same for `novel-organize`, which already threads
  `--runtime-profile`.
- `src/pi/recalibration-extension.ts` — consume `draft.modelExecutionProfile` and
  `parsed.modelExecutionProfile`; pass to the draft and persistent-run paths as a
  per-run override of the project value.
- `src/application/run.ts` — accept an optional model-profile override on
  `BeginPersistentRunOptions` and snapshot it on the active run beside
  `runtimeProfile`, so a resumed run keeps the profile it started with.
- Surface the resolved profile in `/novel-status` and `/novel-budget` output
  (`renderBudgetStatus`, `refreshGuidance`), next to genre/runtime/quality. It is a
  fourth independent control and should be shown as one.
- Emit the existing deprecation advisory for `small-12b-q4`
  (`modelExecutionProfileDeprecationAdvisory`) when selected — it exists and is
  currently never surfaced.

**Tests.**

- `/novel-start --model-profile <id>` writes `runtime.model_execution_profile`, and
  a subsequent `prepareChapterExecution` resolves that profile rather than
  `host-default`.
- `/novel-draft --model-profile` and `/novel-run --model-profile` override the
  project value for that invocation only.
- **Anti-regression, generalised:** a test asserting that every field
  `parseDraftOptions` / `parseRunOptions` can return is read by at least one
  caller. A parsed-and-discarded flag is worse than an absent one — it reads as
  configured — and this is the second such field in the file's history.

### 1b. Guarantee every stage prompt compiles under every profile

**Problem.** `compilePrompt` throws `PromptBudgetError` above
`maxInstructionChars`, correctly refusing to truncate a rule. `tiny-local` allows
6,000 (`src/domain/runtime-profile.ts:37`); compact `book-plan` is currently 6,725
(`npm run --silent benchmark:prompts`). Book planning is mandatory and gated, so
`tiny-local` projects stop permanently at stage 3 of 11. The prompt benchmark
hard-codes `full` vs `local` and never evaluates `tiny-local`.

**Changes, in this order.**

1. **Make the gap visible.** Extend `src/evaluation/prompt-compiler-benchmark.ts`
   to a matrix: every registered stage spec × every `RUNTIME_PROFILE_IDS` entry ×
   every genre profile's `profileRules`/`profileOutputs`. Add a test asserting the
   matrix compiles with zero `PromptBudgetError`. **This test will fail on landing
   —that is the point.** It converts a silent runtime brick into a build failure
   and is the durable fix; everything below is how we make it pass.

2. **State-conditional normative rules.** Many `book-plan` `must` entries are
   inapplicable to a project's current state — the nine public-review observation
   and clustering rules (`src/application/stage-specs/index.ts:169`–`:177`) mean
   nothing when `book-strategy.yaml` records no observations. Give `StageSpec`
   builders access to the relevant state and emit only applicable rules. This does
   not violate invariant 6: an inapplicable rule is not a truncated rule. It must
   be implemented as *omission of a whole rule based on state*, never as shortening
   prose, and each omission needs a test proving the rule returns when the state
   that triggers it exists.

3. **Phase-split what still does not fit.** Where a stage remains over budget with
   all applicable rules — `book-plan` with real public-review evidence will —
   introduce an optional `phases` concept on `StageSpec`: an ordered list of
   sub-prompts, each independently within budget, that together produce the file
   set for **one** guarded event. The event contract does not change: the model
   composes across phases outside the project root (already required by
   `SKILL.md:52`) and submits the complete required set to a single
   `novel_apply_event`. `novel_validate_event` is the convergence tool between
   phases and costs no retry budget.

   Split `book-plan` as: (i) architecture — `book-bible`, `genre`, `plot-grid`,
   `chapter-queue`, `continuity-delta`, `remarkability`; (ii) evidence —
   `research-ledger`, `book-strategy`, `source-register`, `story-threads`, plus
   historical-fiction's `historical-context` and `invention-ledger`. That boundary
   matches the two clusters of `must` rules and the two clusters of outputs.

4. Only if 2 and 3 leave a residual: revisit `tiny-local`'s 6,000-char ceiling as a
   deliberate, documented change with a stated reason — not as a way to make a test
   pass.

**Acceptance.** `/novel-start --runtime-profile tiny-local` reaches
`book-plan-approval` in an e2e test with a scripted worker. The full profile ×
stage × genre matrix compiles in CI.

**Risk.** Phase-splitting touches the prompt path for every stage. Land the matrix
test and state-conditional rules first, measure, and split only what the matrix
still reports over budget.

---

## Phase 2 — Autonomy: drive the scene machine, bound the loops

### 2a. Bound the repair cycle (prerequisite)

`RuntimeProfile.maxRepairAttempts` is declared
(`src/domain/runtime-profile.ts:24`), set to 2 in all three profiles, asserted by
`tests/runtime-profiles.test.ts`, and **read by no code**. Nothing bounds
`deterministic-validation → span-repair → deterministic-validation`.

- Read `maxRepairAttempts` in `src/application/chapter-execution-stepper.ts` at the
  `span-repair` node, using the per-scene attempt counters
  `ChapterExecutionState.attempts` already maintains.
- On exhaustion call `blockChapterExecution` with a specific
  `ExecutionBlockerCode` and the scene ID — a blocked state the writer can inspect
  and resume, not a thrown error.
- Test: a scripted worker that never satisfies validation blocks after exactly
  `maxRepairAttempts`, and the blocker names the scene and the failing check.

Do this before 2b. A driver loop over an unbounded cycle is a defect amplifier.

### 2b. The driver loop

**Problem.** `advanceChapterExecutionStep` advances one node
(`src/application/chapter-execution-stepper.ts:138`). Its only non-test callers are
the tool and command, both of which return after one step
(`src/pi/chapter-step-command.ts:35`, `:119`). At ~12–15 calls per scene, four
scenes per chapter, forty chapters, a novel is ~2,000 host-driven tool calls, each
requiring the host to read a checkpoint and decide correctly to continue. That is
the judgement load the scene machine exists to remove, reintroduced at the outer
loop.

**Changes.**

- New `src/application/chapter-execution-run.ts` exporting
  `runChapterExecution(input): Promise<ChapterExecutionRunResult>`. It calls
  `advanceChapterExecutionStep` in a loop and stops on, in priority order:
  - `result.state.status !== "active"` — `blocked`, `paused`, `cancelled`,
    `completed`;
  - `result.action` of `complete` or `stopped`;
  - `action === "awaiting-critic-review"`. **Note:** this action is returned
    *without advancing* when `requiredCriticJobTypes` is empty
    (`chapter-execution-stepper.ts:268`), so a naive loop spins here. The loop must
    always pass an explicit critic set and treat this action as a stop if it ever
    appears;
  - `signal.aborted`;
  - a caller-supplied node-visit ceiling, as a backstop independent of every
    semantic stop above.

  The loop adds no new authority: it stops exactly where a single step stops, and
  acceptance still ends in the same guarded commit at `chapter-commit`.

- Rewire `novel_advance_chapter_step` and `/novel-chapter-step` to take an optional
  `until: "next-checkpoint" | "chapter-complete"`, defaulting to the current
  one-step behaviour so no existing caller changes.

- Route `runPersistentQualityDraft` through `runChapterExecution` when the chapter
  has an executable contract (`small_model_ready: true`), falling back to the
  existing `runBudgetedQualityDraft` path otherwise
  (`src/application/quality-persistent-run.ts:150`). This is the change that makes
  the guarded scene path the *default* path rather than the manual one — the same
  move v2.0.0 made for prose-lint and the critics.

- Progress: the existing `onProgress` callback already reaches the UI; emit one
  line per node so a long run is observable rather than silent.

**Tests.**

- A scripted worker drives one chapter from `contract-compile` to
  `chapter-commit` in a single `runChapterExecution` call, producing exactly one
  guarded commit.
- The loop stops without advancing at a pending gate, a blocked state, a paused
  state, budget stop/downgrade, and abort — one test each.
- A worker that always fails validation terminates via 2a rather than spinning.
- The node-visit ceiling terminates a loop even if every semantic stop is
  suppressed.

### 2c. Replace the one-chapter cap with a resource stop

`maxChaptersPerRun` is 1 for both `tiny-local` and `local`
(`src/domain/runtime-profile.ts:44`, `:63`) and `applyRuntimeLimits` takes the
minimum with the request (`src/application/runtime-profile-resolver.ts:49`), so a
40-chapter book needs ≥40 writer-initiated restarts on exactly the profiles a
small-model user must choose. The per-chapter isolation the cap protects is already
provided by the loop, which re-reads project state, rebuilds context and re-checks
the creative hash every iteration (`src/application/quality-persistent-run.ts:123`).

- Set `maxChaptersPerRun: null` for `local` and `tiny-local`; stop instead on gate,
  blocker, budget exhaustion or downgrade, and repair-attempt exhaustion — all of
  which already exist.
- Raise the `--max-chapters` ceiling (`src/pi/arguments.ts:161`) and the
  `max_chapters_per_run` schema maximum (`src/domain/schemas.ts:57`) from 10 to a
  book-scale value, keeping the project default conservative and writer-raisable.
- Test: a small-model-profile run drafts N chapters in one invocation and stops at
  the next gate, not at a counter.

---

## Phase 3 — Let a run be aimed at the end

### 3a. Targets and headless packaging

- Add `packaging` and `complete` to `allowedUntilTargets`
  (`src/pi/arguments.ts:14`), with the corresponding `decideNextRun` transitions.
- Expose `applyPackageArtifacts` behind `/novel-package --apply`. It currently has
  exactly one caller, the packaging wizard handler
  (`src/application/packaging/wizard.ts:36`), so on a headless box the manuscript,
  EPUB, DOCX and metadata cannot be produced at all — `openWizardBrowser` shells out
  to `open` (`src/wizard/browser.ts:3`). The wizard stays the default; it stops
  being the only door.
- Test: an e2e run reaches `packaging` and produces the artifact set with no HTTP
  server started.

### 3b. Decide the reader-evidence question

`packageReaderCheckpointFindings` blocks any `package` event with no recorded human
reader response, `human-gate-required` and not retryable
(`src/application/reader-checkpoint.ts:44`, `src/application/events.ts:301`). The
reasoning in that file's header is sound and the check should stay. But as designed
the system cannot finish a book in one run, and that must be a planned stop rather
than a discovery at the last gate.

**Recommendation — do both:**

1. **Make it visible early.** Surface the reader checkpoint at project creation and
   in every status headline from `drafting` onward, with the remaining distance to
   satisfying it. `buildPackagingChecklist` already models blocking items; this is
   one, promoted earlier.
2. **Add a recorded writer override.** Not a CLI flag — an explicit writer decision
   in `series/decision-ledger.yaml`, subject `package-without-reader-evidence`, that
   permits packaging and stamps the absence into `package.md` and the package
   manifest. The evidence boundary survives because the omission is *recorded*, not
   hidden, which is how this codebase already handles unwelcome facts elsewhere.

Test: packaging without evidence and without the decision still rejects
`human-gate-required`; with the decision it applies and the manifest names the
absence; the decision never appears in or affects `reader-experiments.yaml`.

---

## Phase 4 — Defaults that match the model in the room

New projects get `runtime.profile: "full"` (`src/project/templates.ts:142`) and
`quality.tier: "economy"` (`defaultQualityProjectState`) — the widest context
(72,000 evidence chars) paired with the least supervision (economy has no scene
plan, no critics, no final reviewer). That is the pairing least likely to work on a
weak model, handed out by default, in a package whose differentiator is constrained
runtimes.

The information needed is already flowing: `ForegroundEconomyTelemetry.captureModel`
receives `model_select` (`src/pi/recalibration-extension.ts:249`) and
`PiPrintWorker.resolveModelCapacity` can query real capacity
(`src/pi/pi-print-worker.ts:122`).

**Changes.**

- At `/novel-start`, resolve the host model's context window and pick runtime and
  model-execution profiles from it. **Show the choice and the reason**, and let the
  writer override — do not silently configure.
- If capacity is unavailable, ask one question rather than assuming `full`.
- Reconsider whether `economy` is the right default once the guarded scene path is
  the automated path (Phase 2b). Any change here is a spend increase and must
  respect "never silently increase spend": if the default moves, `/novel-start`
  says so and the writer confirms.
- Document `NOVEL_FORGE_QUALITY_PROVIDER` / `NOVEL_FORGE_QUALITY_MODEL` in
  `README.md` with a **local** example. They are the only way to point isolated
  workers at a local model and currently appear once, in
  `docs/quality-and-cost.md:116`, with an OpenAI example.

Test: a stubbed capacity of 16k tokens selects `local` + the small-model profile;
an unavailable capacity prompts rather than defaulting to `full`; the selection is
reported in the creation summary.

---

## Phase 5 — Make the velocity claim real

`evaluateAuthorJourney` counts events in hand-authored YAML
(`src/evaluation/author-journey.ts:125`). The four `evals/journeys/` fixtures are
written by hand and `tests/e2e/author-velocity-baseline.test.ts` asserts the counter
reproduces the numbers the fixture author typed. Nothing generates a trace from a
real run. It is a schema test for a counter, presented as the project's
author-velocity baseline — and "how many author actions does a book cost" is the
central question of this whole plan.

**Changes.**

- Emit `AuthorJourneyEvent` records from the real paths during a run —
  `src/application/run-telemetry.ts` and the guarded-event apply path already sit at
  the right seams and already carry the privacy rules (hashes and categories only,
  never prose or prompts).
- Add an e2e journey that runs a scripted-worker project from `/novel-start` to a
  packaged book, emits a trace, and evaluates *that* against limits.
- Keep the hand-authored fixtures as regression cases for the evaluator itself, but
  stop describing them as a baseline.

**This is the phase that tells us whether the plan worked.** Record the emitted
trace before Phase 1 (it will be short — `tiny-local` bricks at book planning) and
after each subsequent phase. The number that matters: author actions and host tool
calls per completed chapter, on `local` + small-model profile.

---

## Phase 6 — Separate track: stop asking small models for YAML

Not sequenced with the phases above; larger, and worth doing on its own evidence.

`SKILL.md` is ~5,000 words of normative contract that a weak host model must hold
while hand-authoring schema-exact YAML, where one unquoted `: ` in a prose field
rejects the whole file and burns the single permitted retry (`SKILL.md:96`). The
document documents its own trap — the clearest possible signal that the interface is
wrong for the model it is aimed at.

The fix is not a shorter skill. The scene execution path already demonstrates the
alternative: typed jobs with per-job budgets, constrained decoding, and structured
artifacts validated at the tool boundary. Every guarded event a small model is
expected to author is a candidate for the same treatment — a typed tool call the
tool serialises, instead of hand-written text the tool parses.

**Suggested first step, highest value for least disruption:** the four chapter
contract judgement fields. `chapter-queue` compiles a skeleton and correctly refuses
to invent `start_state_ids`, `required_end_state`, `forbidden_changes`,
`knowledge_boundary_ids` (`SKILL.md:207`). That refusal is right — but it leaves the
four hardest fields in the workflow to the weakest component in the system, and an
incomplete contract is what sends drafting down the unguarded fallback path.

Derive what the plot grid and story-thread graph already determine (`start_state_ids`
and `knowledge_boundary_ids` are largely graph queries), and present only the
genuinely free choices as a typed tool call. The current all-or-nothing split
maximises the judgement asked of the model at exactly the point where failure
silently disables scene critics, repair and ordered acceptance.

---

## Sequencing and checkpoints

| Phase | Unblocks | Ship independently? |
|---|---|---|
| 0 — green branch, `plan-change` handler | everything | yes |
| 1a — `--model-profile` threading | 1b, 2, 4 | yes |
| 1b — prompt matrix, conditional rules, phase split | `tiny-local` usable | yes |
| 2a — bound repair cycle | 2b | yes |
| 2b — driver loop | 2c, 3a | yes |
| 2c — resource stop replaces chapter cap | multi-chapter runs | yes |
| 3a — run-to-packaging, headless `--apply` | completion | yes |
| 3b — reader-evidence decision | completion | yes, needs a product call |
| 4 — model detection and defaults | — | yes |
| 5 — real journey traces | measurement | yes |
| 6 — typed events | separate track | separate |

Each phase is its own PR with its own release note, following the existing
CHANGELOG/`docs/releases/` convention. Phases 1b, 2b and 3b change validation or
workflow behaviour and are minor-version-worthy; 2c and 3b change what is accepted
where it previously was not, so check them against the major-version rule the
project applied at 2.0.0.

**Definition of done for the whole plan:** an e2e test starts a project on the
small-model profile with a scripted worker, drafts a multi-chapter book through the
guarded scene path in one `/novel-run` invocation per gate interval, packages it
headlessly, and emits a real author-journey trace whose author-action count is
asserted against a limit. Today that test cannot be written past stage 3.

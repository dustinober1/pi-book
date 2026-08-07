# Codebase review — one-run novel completion on non-frontier models

Date: 2026-08-07
Reviewed commit: `f6f48b3` (`release: cut v2.1.0`)
Reviewed against one goal: **a writer should be able to take an idea to a finished
novel in a single sustained run, using models that are not the best available.**

This review is scoped to that goal. It is not a general audit; plenty of subsystems
here are better than they need to be and are only mentioned where they bear on the
goal.

---

## Verdict

The parts required for the goal have all been built. Almost none of them can be
reached from the path a writer actually takes.

Novel Forge already contains a per-scene execution state machine designed for weak
models, a model-execution profile tuned for a 12B Q4 local model, three constrained
runtime profiles, a bounded context capsule that allocates by complete record, and
a scene-level critic/repair/acceptance loop. That is the right architecture for
this problem, and most of it is well built.

But:

- The runtime profile named for the smallest models (`tiny-local`) **cannot compile
  the book-plan prompt at all** — it throws before inference, at a mandatory stage.
- The small-model execution profile **cannot be selected** through any command,
  flag, or wizard. `--model-profile` is parsed and discarded.
- The per-scene execution machine **has no driver**. Nothing in `src/` advances it
  more than one node per call.
- `local` and `tiny-local` cap a persistent run at **one chapter**, so a 40-chapter
  book needs at least 40 manual restarts.
- New projects default to `runtime.profile: "full"` and `quality.tier: "economy"` —
  the widest context and the least-guarded drafting path, which is precisely the
  wrong pairing for a weak model.

The v2.0.0 release notes diagnose this exact failure mode for prose-lint, repetition
memory and the scene critics: *"All three were well built. None of them could be
reached from the path an agent actually took."* The same sentence is true today of
the entire small-model execution path. This review is mostly a second application
of that diagnosis.

Current `main` also does not pass its own test suite (4 failures, all version drift).

---

## What already works, and should not be disturbed

These are load-bearing and correct. Changes proposed later must not weaken them.

- **The guarded event transaction.** `applyNovelEvent` owns stage/hash checks,
  allowlists, schema and cross-artifact validation, rollback, derived status/handoff
  regeneration, and a Git checkpoint (`src/application/events.ts`). Adding
  `novel_validate_event` as a zero-cost dry run was the right call, especially for
  weak models that need several passes to produce valid YAML.
- **Complete-record context allocation.** Structured evidence is included whole or
  omitted whole, required records are allocated first, and required overflow stops
  *before* inference naming the missing IDs
  (`docs/benchmarks/constrained-runtime-baseline.md`). This is the single most
  important property for small-context models and it is implemented properly.
- **The chapter execution state machine.** A 14-node graph with legal transitions,
  per-node attempt counters, resume guarded by project/canon/contract hashes
  (`src/application/chapter-execution-machine.ts:3`). Well-designed, well-tested.
- **The model execution profile.** Per-job budgets and decoding policy — temperature
  0.05/top-p 0.2 for structured jobs, repetition penalty on drafting, thinking off,
  grammar-not-JSON-schema capability flags for Gemma
  (`src/domain/model-execution-profile.ts`). This is real small-model engineering,
  not a context-size knob.
- **Deterministic quality signal.** prose-lint's absolute published-fiction bands,
  per-speaker dialogue differentiation, and structural rhythm advisories give a weak
  model something to be corrected *by* that costs no tokens. Running lint on the
  submitted text rather than the copy on disk is the correct choice.
- **Honest evidence boundaries.** The refusal to let automated diagnostics count as
  reader evidence, the telemetry exclusion list, and the "review evidence, not
  authorship detection" framing are consistently held throughout. Do not trade these
  away for autonomy.

---

## Blocking findings

### 1. `tiny-local` cannot plan a book — the profile is unusable end to end

`compilePrompt` throws `PromptBudgetError` when normative instructions exceed the
profile's `maxInstructionChars`, deliberately refusing to truncate a rule
(`src/application/prompt-compiler.ts`). `tiny-local` sets that ceiling to 6,000
(`src/domain/runtime-profile.ts:37`). The current compact `book-plan` prompt is
**6,725 characters**:

```
$ npm run --silent benchmark:prompts
  "id": "book-plan", "standardChars": 9941, "compactChars": 6725
```

Book planning is not optional — it is stage three of eleven and owns the
`book-plan-approval` gate. A project created with `--runtime-profile tiny-local`
therefore reaches book planning and stops permanently: `decideNextRun` calls
`bookPlanPrompt`, which throws, and the command handler surfaces the budget error as
a UI warning (`src/application/run.ts:130`, `src/pi/extension.ts:307`). There is no
recovery path, because every route to that stage compiles the same prompt.

This is invisible because the prompt benchmark hard-codes the comparison as
`full` vs `local` and never evaluates `tiny-local`
(`src/evaluation/prompt-compiler-benchmark.ts`). Of 104 `tiny-local` references
across the test suite, none compiles a stage prompt under it.

**Fix:** add `tiny-local` to the prompt-compiler benchmark and make every registered
stage spec compile under every runtime profile a CI assertion. Then either raise
`tiny-local`'s instruction ceiling or split `book-plan` into a two-call sequence
(architecture, then research/strategy). Splitting is the better answer: 6,725
characters of normative instruction is a lot to ask a 12B model to hold *and* obey
while authoring five schema-exact YAML files.

### 2. The small-model execution profile cannot be selected

`ModelExecutionProfile` is where all the small-model tuning lives, and
`project.runtime.model_execution_profile` is its only source of truth
(`src/application/chapter-execution-preparation.ts:198`). Nothing ever writes it.

- `/novel-start` accepts `--profile`, `--type`, `--target-words`, `--brief`,
  `--auto-to`, `--runtime-profile` and the quality flags. `--model-profile` is not in
  its `flagsWithValues` set and is never read, even though `initializeProject`
  already accepts a `modelExecutionProfile` option
  (`src/pi/extension.ts:309`, `src/project/templates.ts:143`).
- `parseDraftOptions` and `parseRunOptions` both parse `--model-profile` into
  `modelExecutionProfile` (`src/pi/arguments.ts:81`, `:154`) — and both callers
  destructure everything *except* that field. `withQualityDraft` and `withQualityRun`
  never reference it (`src/pi/recalibration-extension.ts:83`, `:175`).
- No wizard workflow writes it.

So the flag validates, silently does nothing, and the writer gets `host-default`:
128k reliable context, 32k max output, temperature 0.7 drafting, JSON-schema and
tool-calls assumed available. Against a local 12B that is wrong in every field.

The only escape is hand-editing `PROJECT.yaml`, which `SKILL.md:50` forbids and the
working-tree guard rejects.

**Fix:** accept `--model-profile` on `/novel-start`, thread it through
`initializeProject`, and thread the already-parsed value from `parseDraftOptions` /
`parseRunOptions` into the draft and run paths. A parsed-and-discarded flag is worse
than an absent one — it reads as configured.

### 3. The per-scene execution machine has no driver

`advanceChapterExecutionStep` advances **exactly one node**
(`src/application/chapter-execution-stepper.ts:138`). Its only non-test callers are
the `novel_advance_chapter_step` tool and the `/novel-chapter-step` command
(`src/pi/chapter-step-command.ts:35`, `:119`), both of which return after one step
and instruct the caller to "inspect the returned checkpoint before calling again".

The node sequence per scene is context-build → scene-plan → scene-draft →
deterministic-validation → critic-review → state-delta → scene-accept, plus repair
loops, then chapter-stitch → chapter-validate → chapter-commit. With five critics
that is roughly 12–15 tool calls per scene. At four scenes per chapter and forty
chapters, a novel is on the order of **2,000 host-driven tool calls**, each one
requiring the host model to read a checkpoint and decide correctly to continue.

That is the exact judgement load the scene machine exists to remove from the model,
reintroduced at the outer loop. On a weak host it will not survive; on any host it
is not "one go".

Meanwhile the path that *is* automated — `runPersistentQualityDraft` →
`runBudgetedQualityDraft` → `runQualityDraft` — does not use the scene machine at
all. It drafts whole chapters through the quality orchestrator
(`src/application/quality-persistent-run.ts:150`,
`src/application/budgeted-quality-draft.ts:46`). Two parallel drafting engines
exist; the automated one asks for whole chapters, the small-model one is manual.

**Fix:** add a `runChapterExecution(...)` loop in `src/application/` that drives
`advanceChapterExecutionStep` until the state reports `blocked`, `paused`,
`completed`, or a writer gate — the same stop conditions the tool's
`promptGuidelines` already state. Every safety property is preserved: the loop stops
where a single step would stop, and acceptance still ends in one guarded event. Then
route `runPersistentQualityDraft` through it whenever an executable chapter contract
exists, so the guarded scene path becomes the automated path rather than the manual
one.

### 4. `local` and `tiny-local` cap a persistent run at one chapter

`RUNTIME_PROFILES["tiny-local"].maxChaptersPerRun = 1` and the same for `local`
(`src/domain/runtime-profile.ts:44`, `:63`); `applyRuntimeLimits` takes the minimum
of that and the request (`src/application/runtime-profile-resolver.ts:49`). The
project default is 3 and the CLI ceiling is 10
(`src/project/templates.ts:136`, `src/pi/arguments.ts:161`).

So on exactly the profiles a small-model user must select, `/novel-run --until
next-milestone --max-chapters 10` drafts one chapter and pauses. A forty-chapter
book needs at least forty writer-initiated restarts, before any gate stops.

The cap presumably guards against context drift accumulating across chapters — but
the run already re-reads project state, rebuilds context and re-checks the creative
hash on every iteration (`src/application/quality-persistent-run.ts:123`), so the
per-chapter isolation the cap protects is provided by the loop itself.

**Fix:** replace the hard cap with a resource-shaped stop. `local` and `tiny-local`
should stop on budget exhaustion, a gate, a blocker, or repeated repair failure —
not on an arbitrary chapter count. If a conservative default is wanted, make it a
project setting the writer can raise, not a profile constant they cannot see.

### 5. Nothing can be asked to run to the end

`allowedUntilTargets` stops at `manuscript-review` (`src/pi/arguments.ts:14`). There
is no `packaging`, no `complete`. The furthest a writer can aim a single command is
the manuscript review gate.

`/novel-package` prints a checklist and then **opens a browser wizard**
(`src/pi/extension.ts:370`); `applyPackageArtifacts` — the function that actually
produces the manuscript, EPUB, DOCX and metadata — is reachable *only* from the
packaging wizard handler (`src/application/packaging/wizard.ts:36`). On a headless
box `open()` will not produce a usable browser, and there is no CLI fallback.

**Fix:** add `packaging` and `complete` to `allowedUntilTargets`, and expose
`applyPackageArtifacts` behind `/novel-package --apply` so the final artifact can be
produced without a GUI. The wizard stays the default; it should not be the only door.

### 6. Packaging is unbypassable without human reader evidence

`packageReaderCheckpointFindings` blocks any `package` event with no recorded human
reader response, classified `human-gate-required` and explicitly not retryable
(`src/application/reader-checkpoint.ts:44`, `src/application/events.ts:301`).

The reasoning in that file's header comment is sound and I would not remove the
check. But it is worth stating plainly against the goal: **as designed, this system
cannot finish a book in one run.** It can reach a packaged-except-for-readers state
and stop. If the goal is a single sustained run to a finished manuscript, that has
to be reconciled deliberately, not discovered at the last gate.

**Options, in preference order:**
1. Keep the block, and make it visible at project creation and in every status
   headline from drafting onward, so it is a planned stop rather than a surprise.
2. Allow an explicit writer acknowledgement — a recorded decision, not a flag —
   that packages without reader evidence and stamps that absence into
   `package.md` and the package manifest. The evidence boundary is preserved
   because the omission is recorded, not hidden.

Option 2 is consistent with how this codebase already handles unwelcome facts
elsewhere: it records them as advisories the writer must be told, rather than
pretending or preventing.

### 7. Defaults are backwards for the target user

A new project gets `runtime.profile: "full"` (`src/project/templates.ts:142`) and
`quality.tier: "economy"` (`src/domain/quality-profile.ts`, `defaultQualityProjectState`).

That pairing means: assume 72,000 characters of evidence and 24,000 characters of
instruction fit, and draft whole chapters in a single host-prompt call with **no
scene plan, no candidates, no critics, no final reviewer**
(`QUALITY_TIER_POLICIES.economy`). It is the widest context and the least
supervision — the combination least likely to work on a weak model, handed out by
default.

Nothing detects the host model. `ForegroundEconomyTelemetry.captureModel` already
receives a `model_select` event (`src/pi/recalibration-extension.ts:249`) and the
worker can query real capacity via `resolveModelCapacity`
(`src/pi/pi-print-worker.ts:122`), so the information needed to pick sane defaults is
already flowing through the process.

**Fix:** at `/novel-start`, resolve the host model's context window and pick the
runtime and model-execution profiles from it, showing the choice and letting the
writer override. Failing that, ask one question. Defaulting to the configuration that
only works on frontier models, in a package whose stated selling point is
constrained runtimes, is the wrong way round.

---

## Correctness and hygiene

### `main` fails its own test suite

```
# tests 941   # pass 937   # fail 4
```

All four are version drift from the v2.1.0 release commit:

- `package.json` is `2.1.0`, `NOVEL_FORGE_VERSION` is still `"2.0.1"`
  (`src/application/version-core.ts:3`), so a project created by this code stamps
  itself with the previous version.
- `docs/releases/v2.1.0.md` does not exist; `README.md` and `RELEASE.md` still pin
  and describe 2.0.1; `npm run verify:release` still runs
  `verify-v2-0-1-release.ts`.

`RELEASE.md:121` requires exactly these to move together. The 2.1.0 commit did not.
Either finish the release or revert the version bump; a red default branch erodes the
whole verification story this project rests on.

### The `plan-change` guide action is a dead end

`buildGuideScreen` offers "Review plan change PC-NNN" with id `plan-change`
(`src/application/guide.ts:112`), and `guidedNovel`'s dispatch chain has no branch
for it (`src/pi/extension.ts:174`–`:209`). Selecting it silently does nothing. The
writer's only route is the separately registered `/novel-plan-change`
(`src/pi/plan-change-command.ts:107`), which the guide never mentions. No test covers
guide-action-id to handler coverage.

**Fix:** handle `plan-change` in `guidedNovel`, and add a test asserting every
`GuideActionId` the screen can emit has a handler. The union type makes this cheap to
enforce.

### The author-journey baseline measures nothing

`evaluateAuthorJourney` counts events in a hand-authored YAML trace
(`src/evaluation/author-journey.ts:125`). The four fixtures in `evals/journeys/` are
written by hand, and `tests/e2e/author-velocity-baseline.test.ts` asserts the counter
reproduces the numbers the fixture author typed. Nothing generates a trace from a
real run.

This is presented as the project's author-velocity baseline. It is a schema test for
a counter. Given how central "how many author actions does a book cost" is to the
stated goal, this is the metric most worth making real — emit the trace from
`run-telemetry` during an e2e run and evaluate *that*.

### Smaller items

- `probe.ts` at the repository root is a leftover debugging script (two `parseYaml`
  calls printing error messages). Not in `package.json` `files`, but committed.
- `NOVEL_FORGE_QUALITY_PROVIDER` / `NOVEL_FORGE_QUALITY_MODEL` are the only way to
  point isolated workers at a local model, and appear exactly once in the docs
  (`docs/quality-and-cost.md:116`) with an OpenAI example. For a package whose
  differentiator is running on local models, the local example belongs in the README.
- `scripts/` carries 16 `verify-v1-*-release.ts` files and `src/domain/` carries 12
  `v1-*` schema modules. Frozen release checks are defensible; consider folding them
  behind one version-parameterised verifier so the directory stops growing linearly
  with releases.
- `package.json`'s `test:release` script names 17 checklist files on one line. As
  above — a loop over a manifest would age better.

---

## What "one go on a weak model" would actually require

In dependency order. Items 1–4 are the ones that change whether the goal is
reachable at all.

1. **Make `tiny-local` compile every stage prompt** (finding 1). Add all three
   profiles to the prompt benchmark and assert it in CI. Split `book-plan`.
2. **Thread `--model-profile` end to end**, including `/novel-start` (finding 2).
   Without this the small-model tuning is unreachable, so nothing downstream matters.
3. **Add the chapter execution driver loop** (finding 3) and route persistent runs
   through it when an executable contract exists. This is the single highest-value
   change in this list: it converts the best-designed subsystem in the repository
   from a manual tool into the default path.
4. **Replace the one-chapter cap with a budget/gate stop** (finding 4).
5. **Detect the host model and default accordingly** (finding 7), showing the choice.
6. **Let a run be aimed at `packaging`, and expose `--apply` packaging without a
   browser** (finding 5).
7. **Decide the reader-evidence question deliberately** (finding 6) and surface it
   at project creation either way.
8. **Close the loop on the contract judgement fields.** `chapter-queue` compiles a
   skeleton and correctly refuses to invent `start_state_ids`,
   `required_end_state`, `forbidden_changes`, `knowledge_boundary_ids`
   (`SKILL.md:207`). That refusal is right, but it leaves the four hardest fields in
   the workflow to be hand-authored by the weakest component in the system. Consider
   deriving what the plot grid and story-thread graph already determine, and leaving
   only the genuinely free choices — the current all-or-nothing split maximises the
   judgement asked of the model.
9. **Then fix the release state, the `plan-change` dead end, and make the
   author-journey baseline measure a real run** — so that "941 tests pass" continues
   to mean what this project needs it to mean.

## One structural note

`SKILL.md` is ~5,000 words of normative contract, and a weak host model must hold it
while hand-authoring schema-exact YAML — where a single unquoted `: ` in a prose
field rejects the whole file and burns the one permitted retry (`SKILL.md:96`). The
document itself documents this trap, which is the clearest possible sign that the
interface is wrong for the model it is aimed at.

The fix is not a shorter skill. It is to stop asking the model for YAML. The scene
execution path already demonstrates the alternative: typed jobs with per-job budgets,
constrained decoding, and structured artifacts validated at the tool boundary. Every
guarded event that a small model is expected to author is a candidate for the same
treatment — a typed tool call the tool serialises, instead of hand-written text the
tool parses. That is a larger change than anything above, and it is the one that
would make the difference between a system a weak model can be walked through and a
system a weak model can actually run.

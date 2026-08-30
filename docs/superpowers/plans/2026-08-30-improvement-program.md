# Plan — improvement program after the one-run small-model work

Date: 2026-08-30
Base commit: `2c31565` (`Merge pull request #81 … novel-writing-codebase-review`)
Source: codebase survey of 2026-08-30 (this plan's findings section)
Predecessor: `docs/superpowers/plans/2026-08-07-one-run-small-model-remediation.md`

Target outcome: the small-model program is **released and provably working**, the
codebase carries no documented-but-unreachable surface, and the next genre, the
next local model, and the next typed event are each a bounded change rather than
a survey of twelve call sites.

---

## Starting state

`main` is healthy in every way the project measures itself: `npm run typecheck`
clean, **1008/1008 tests passing** in ~2m25s, zero `TODO`/`FIXME`/`HACK` markers
in `src/`, no open issues, no skipped or todo tests.

It is unhealthy in one way the project does not currently measure: **none of the
last six commits' worth of work is installable.** `package.json` is `2.1.0`,
`NOVEL_FORGE_VERSION` is `"2.1.0"`, `README.md` tells a writer to install
`@v2.1.0`, and `CHANGELOG.md` carries **six consecutive `## Unreleased`
sections** describing the entire one-run program. A writer who follows the
README's own install line today gets none of it.

That single fact sets the ordering below.

## Ordering rationale

- **Ship before refactor.** Phase 0 releases work that is already written,
  reviewed, and green. Every later phase touches shared machinery (the release
  verifier, ~23 artifact stores, the event allowlist); doing any of that first
  means the eventual release ships a refactor nobody has run in anger, and a
  regression bisects across a repo-wide change instead of a version boundary.
- **Prove before deleting.** Phase 2 writes the end-to-end test the predecessor
  plan defined as its own definition of done and never wrote. Phases 3–7 delete
  or restructure roughly 3,000 lines. The order matters: the proof that a book
  can be planned, drafted through the guarded scene path, and packaged headlessly
  in one run is the guard those deletions need. Writing it after is writing it
  against already-moved code.
- **Reachability is the recurring defect.** v2.0.0's changelog states it: *"All
  three were well built, and none could be reached from the path an agent
  actually took."* The 2026-08-07 review restates it. This survey found it again
  in three new places — `thriller-evidence.yaml` (created, schemaed, documented,
  writable by no event), `references/prompts/` and `references/templates/` (read
  by no code), and `draftStageSpec` (benchmarked, never compiled by the product).
  Track B is that same defect class, so each of its phases must name the
  reachable path that exercises what it keeps.

## Invariants — no phase may weaken these

Carried forward verbatim from the predecessor plan; each phase's review confirms
all six, plus the four project-level decisions below.

1. Every accepted creative change still ends in exactly one guarded event with
   stage/hash checks, allowlists, schema and reference validation, rollback,
   status/handoff regeneration, and a Git checkpoint.
2. Human gates are never bypassed, auto-approved, or inferred. A driver loop
   stops at a gate; it never crosses one.
3. Structured context stays complete-record-or-omitted. Required overflow stops
   before inference and names the missing IDs.
4. Telemetry stores hashes, usage, cost, tier, pass and safe finish categories —
   never prompts, prose, source excerpts, model outputs, reasoning, or
   credentials.
5. Automated diagnostics never become human reader evidence, and never write
   `reader-experiments.yaml`.
6. No normative rule is silently truncated to fit a budget. A rule that does not
   apply to current project state may be omitted; a rule that applies may not be
   shortened to make a number fit.

Project-level decisions this plan must not silently reverse:

7. **Never silently increase spend.** `economy` stays the default quality tier.
   Phase 11 adds a second qualifiable model; it does not change any default.
8. **Style findings are review evidence, not authorship detection.** No phase
   adds a rule that claims a passage was machine-written, and no band becomes a
   quota.
9. **Deterministic checks verify that a question was answered, never how well.**
   The ending-contract precedent (`src/application/ending-contract.ts` reads no
   manuscript) governs any new check.
10. **Backward readability.** Projects written by earlier versions stay readable;
    new fields are optional and additive.

---

# Track A — Ship and protect

## Phase 0 — Cut v2.2.0

**Problem.** Six `## Unreleased` sections (`CHANGELOG.md:3,18,37,54,69,87`)
describe the model-profile threading, the `runChapterExecution` driver loop,
`--until packaging|complete`, headless `/novel-package --apply`,
capacity-derived defaults, real journey traces, and
`novel_complete_chapter_contract`. None is installable.

Note that `scripts/verify-v2-1-0-release.ts` **already contains passing checks
for all of it** (`model-profile-threaded`, `chapter-execution-driver`,
`run-targets-reach-the-end`, `headless-packaging`, `capacity-derived-defaults`,
`journey-traces-recorded-from-real-runs`, `typed-contract-completion`). The work
is verified; only the version strings lag. This phase is therefore metadata and
release notes, not feature work — which is exactly why it is cheap and why it
goes first.

**Version choice: 2.2.0.** No previously-valid author input becomes invalid. The
`repair-limit` blocker stops runs that previously looped without bound; a
`custom` `--model-profile` is now rejected at parse time where it was previously
parsed and discarded. Neither breaks a working project, and existing projects
remain readable. Contrast v2.0.0, which was major because it began *rejecting*
book plans and package events it had previously accepted. One item to confirm
before tagging: `PersistentQualityDraftResult.chapters` entries changed to
outcome records and the result now carries `advisories`. That is a TypeScript
shape change for in-repo callers only — the package is `private` and
`UNLICENSED`, and its consumer contract is the skill and command surface, not a
published type. Confirm no external consumer exists, then minor is correct.

**Change.**

1. Consolidate the six `## Unreleased` sections into one `## 2.2.0 — <title>`
   heading, newest-first within it, preserving every existing "Boundaries" block
   verbatim. Suggested title: *One Run to a Packaged Book on a Local Model*
   (author's call).
2. Bump `package.json`, both `package-lock.json` version fields, and
   `NOVEL_FORGE_VERSION` in `src/application/version-core.ts:3`.
3. Write `docs/releases/v2.2.0.md` — `release.yml` publishes with
   `--notes-file docs/releases/v<version>.md`, so this file is load-bearing, not
   documentation. Match the structure of `docs/releases/v2.1.0.md`.
4. Update the pinned install examples in `README.md` (two places) and the
   `## Current verified release:` line in `RELEASE.md`; add a 2.2.0 release
   record.
5. Copy `scripts/verify-v2-1-0-release.ts` to `scripts/verify-v2-2-0-release.ts`,
   retarget its version assertions, and point `verify:release` at it.
6. Copy `tests/v2-1-0-release-checklist.test.ts` to
   `tests/v2-2-0-release-checklist.test.ts` and prepend it to `test:release`.
7. Work the eight-item "Checklist for the next release" at `RELEASE.md:130-139`
   as written, including the disposable-project smoke test of the pinned tag.

**Accepting the cost knowingly.** Steps 5–6 create the eighteenth frozen
verifier and the nineteenth checklist test, which Phase 3 then folds away. That
is deliberate: the release path is currently green and proven, and refactoring
it before a release trades a certain small waste for an uncertain large risk.

**Tests.** The copied checklist test is the test. It already asserts the whole
release set together — the comment in `tests/v2-1-0-release-checklist.test.ts`
records that this test exists precisely because the 2.1.0 cut bumped
`package.json` and the changelog while leaving the runtime constant, notes,
install examples and checker behind.

**Acceptance.** Full Node 22.19.0 + 24 matrix green on the candidate commit;
`npm run verify:release`, `npm run test:release`, `npm pack --dry-run` clean;
annotated tag created only after merge; pinned tag smoke-tested with a
disposable project.

**Effort:** S. **Risk:** low. **Value:** highest in the plan — it is the
difference between the program existing and the program shipping.

## Phase 1 — Documentation-parity guard

**Problem.** Three live drifts, all of the same shape: a document asserts
something about the product that nothing checks.

- `SKILL.md:358-375` lists 15 power-user commands; 18 are registered.
  `/novel-budget`, `/novel-context`, `/novel-chapter-step` and
  `/novel-plan-change` are missing, and the `/novel-wizard` completion list omits
  `research` and `premise`, both of which exist (`src/pi/extension.ts:385`).
- `SKILL.md:381` still reads *"Novel Forge 1.6.2 is `v1.6.2`"* as its pinned-tag
  example, thirteen releases later.
- `wizard/index.html:13` renders `Novel Forge 1.3` to the writer's browser.

More seriously: `release.yml` publishes from `docs/releases/v<version>.md`, and
**nothing in `test.yml` asserts that file exists before the version bump reaches
`main`.** That is the exact drift class that made the 2.1.0 cut red, and the
current checklist test only catches it for the one version hardcoded into it.

**Change.**

1. Fix the three drifts above.
2. Add `tests/documentation-parity.test.ts`, version-agnostic:
   - every command registered through the `registerCommand` proxy appears in
     `SKILL.md`'s power-user list, and vice versa — derive the registered set by
     invoking registration against a recording stub rather than by parsing
     source, so the test cannot drift from the real surface;
   - `docs/releases/v${packageJson.version}.md` exists;
   - `package.json` version, both lock fields, and `NOVEL_FORGE_VERSION` agree;
   - `verify:release` and `test:release` name scripts and tests that exist;
   - no shipped document names a Novel Forge version older than the current one
     as its install example.
3. `wizard/index.html` renders `NOVEL_FORGE_VERSION` rather than a literal.

**Tests first.** Write the parity test against the *unfixed* tree, confirm it
fails on all three drifts plus the missing-notes check, then fix.

**Acceptance.** The parity test fails if any single element of a release set is
bumped alone. This retires the per-version "every part of the release set
reports the same version" test as a pattern — Phase 3 removes the frozen copies.

**Effort:** S. **Risk:** low.

## Phase 2 — The one-run definition-of-done test

**Problem.** The predecessor plan's definition of done for the whole program:

> an e2e test starts a project on the small-model profile with a scripted worker,
> drafts a multi-chapter book through the guarded scene path in one `/novel-run`
> invocation per gate interval, packages it headlessly, and emits a real
> author-journey trace whose author-action count is asserted against a limit.

**This test does not exist.** Nothing under `tests/e2e/` references
`--model-profile`, `modelExecutionProfile`, `applyPackageArtifacts`, or
`--apply`. `tests/e2e/recorded-author-journey.test.ts` holds six unit-scale
tests (a 2-chapter velocity check, retry linkage, privacy, ignored tree) and
asserts no book-scale limit. Every claim the program makes about one-run
completion is therefore currently unguarded by any test.

**Change.** Add `tests/e2e/one-run-small-model-journey.test.ts`:

1. `/novel-start` with `--runtime-profile local --model-profile
   gemma-3-12b-it-qat-q4_0` against a scripted worker (the existing CI worker —
   no model runs; see `evals/gemma/README.md`).
2. Advance through voice intake, series plan and book plan, approving at each
   writer gate, asserting the run **stops at** each gate rather than crossing it.
3. Draft a multi-chapter book (enough chapters to cross an act boundary and a
   packet-window refresh) through `runChapterExecution`, asserting the guarded
   scene path is taken — `guarded-scene-execution`, not the fallback advisory.
4. Record reader evidence through a `reader-test` event, then package with
   `/novel-package --apply` on a headless path.
5. Assert against the emitted journey trace: author actions, model prompts,
   guarded events, rejected events and retries each under a declared ceiling,
   in the shape `evals/journeys/*.yaml` already uses (`limits.max_*`).
6. Assert the trace stays privacy-safe (`assertPrivacySafe` already refuses
   out-of-shape fields).

**Second variant, same file:** the same run under the recorded
`package-without-reader-evidence` waiver, asserting the package is produced, the
manifest records that no human has read the book, and `reader-experiments.yaml`
is untouched. Invariant 5 has no other end-to-end guard.

**Watch the runtime.** The suite is 2m25s today. A book-scale e2e can dominate
that. Keep the chapter count to the minimum that crosses the structural
boundaries, and if it still runs long, gate the long variant behind an env flag
that CI sets — never `.skip`.

**Acceptance.** The test fails if the driver loop stops advancing, if the
guarded path silently falls back, if headless packaging regresses, or if author
actions per book exceed the declared ceiling.

**Effort:** L. **Risk:** medium — this is the phase most likely to surface a
real defect in the shipped program. That is its purpose; budget for the fix.

## Phase 3 — Consolidate the frozen release verifiers

**Problem.** `scripts/` holds **17** `verify-v*-release.ts` files (1,733 lines,
18 after Phase 0) and `tests/` holds 17 matching checklist tests, all wired into
one hand-maintained `test:release` line in `package.json` naming 18 files. The
2026-08-07 review already called for folding these behind one
version-parameterised verifier; the item is recorded as Phase 0 "Follow-up (not
blocking)" and was never done. The directory grows linearly with every release.

**Change.**

1. `scripts/lib/release-manifest.ts` — one entry per historical release: version,
   required file paths, and the assertions unique to that release, expressed as
   data (`{ id, path, pattern, detail }`) rather than code.
2. `scripts/verify-release.ts` — reads the manifest, verifies the current version
   fully and every historical release's *frozen* assertions, with the same
   `{ id, passed, detail }` result shape and the same CLI output the current
   scripts produce.
3. `tests/release-checklist.test.ts` — one test driving the manifest across all
   releases, replacing the 18 frozen copies.
4. `verify:release` becomes `node --import tsx scripts/verify-release.ts` — a
   line that never changes again. `test:release` collapses from 18 named files to
   the manifest-driven test plus `package-smoke` and `packed-clean-start`.

**Do not weaken the frozen checks.** Each historical assertion moves into the
manifest unchanged. Before deleting any `verify-v*-release.ts`, run old and new
side by side on the same tree and diff the full `{id, passed}` set — identical,
or the migration is wrong. Keep that comparison as a one-shot script in the PR
description, not in the repo.

**Acceptance.** Identical check IDs and results before and after; ~1,700 lines
deleted; the next release adds one manifest entry and touches no script.

**Effort:** M. **Risk:** medium — this is the release safety net. Phase 2's e2e
test and the Phase 1 parity test are both in place first, deliberately.

---

# Track B — Correctness and debt

## Phase 4 — `thriller-evidence.yaml` is documented but unwritable

**Problem — a real contract defect.** Every thriller project creates
`books/book-NN/thriller-evidence.yaml` at init
(`src/project/templates.ts:107`). It has a schema
(`src/domain/v1-5-schema-registry.ts:14`). `SKILL.md:201` tells the agent
thriller projects use it "for exact artifact labels, provenance, access limits,
and explicit non-proof statements."

**No event allowlist permits writing it.** Verified against
`allowedPath` (`src/application/events.ts:101-142`) and
`isStoryControlPathAllowed`: the path appears in neither. The agent is
instructed to maintain a file that the transaction engine will reject on every
attempt, and the rejection will read as an `allowlist-violation` — which
`SKILL.md:245` correctly tells the agent never to work around. The file is
therefore permanently empty and permanently mentioned.

**Change — decide, then implement one of:**

- **(a) Make it reachable (recommended).** Add it to the `research-update`
  allowlist, scoped to `profile === "thriller"`, exactly mirroring the existing
  historical-fiction precedent at `events.ts:104-106`. It is evidence, it is
  state-neutral, and `research-update` is already the state-neutral evidence
  event. Then give it the validation the other evidence files have, and state
  in `SKILL.md` which event owns it.
- **(b) Remove it.** Stop creating it in `templates.ts`, drop the schema entry,
  and cut `SKILL.md:201`'s reference.

Choose (a) if thriller evidence is meant to be live; (b) if it was speculative.
Do not leave it as is. Whichever is chosen, the same reasoning applies to any
future genre file: **a template that no event can write is a bug, not a
placeholder.**

**Tests first.** A test that submits a valid `thriller-evidence.yaml` through
`research-update` on a thriller project and expects acceptance (a) — or a test
asserting the path is absent from templates and schema registry (b). Plus a
general test: every path `templates.ts` creates under a book root is either
writable by some event or explicitly listed as read-only-by-design. That
generalised test is the real deliverable; it prevents the next instance.

**Effort:** S. **Risk:** low. **Value:** high — this is the only outright
defect the survey found.

## Phase 5 — Delete what nothing reaches

**Problem.** Four unreachable surfaces, each a second source of truth that has
already drifted or will.

| Surface | Evidence |
|---|---|
| `references/prompts/` (7 files) | Read by no code, script or test. Real prompts come from `src/application/stage-specs/index.ts` (545 lines) + `prompts.ts`. Already drifted: thriller and romantasy have `profile.md`, historical-fiction — the genre with the most bespoke machinery — has none. |
| `references/templates/novel/` (22 files) | Touched only by `tests/schema.test.ts` and two verify scripts. `src/project/templates.ts` hard-codes the same content inline. |
| `profiles/*.yaml` (3 files) | Loaded by nothing; only asserted to exist by `scripts/verify-v1-5-release.ts:48`, and shipped in the package allowlist. |
| `draftStageSpec` (`stage-specs/index.ts:376`) | Imported only by `src/evaluation/constrained-runtime.ts`, `prompt-compile-matrix.ts` and two tests. The product compiles `automationDraftStageSpec` and `sceneExecutionDraftStageSpec`. **The benchmarks measure a spec the product never compiles.** |

Plus: `src/application/wizard.ts:78` throws *"research/premise snapshot is not
available yet"*, unreachable because `wizard-launch.ts:41-42` always registers
handlers that define `snapshot`; and ~36 exported functions are never referenced
outside their defining file (including the whole 26-line
`contracts/scene-contract-validator.ts`).

**Change.**

1. **`draftStageSpec` first, and treat it as a finding, not a cleanup.** Point
   the benchmarks at the specs the product actually compiles, then re-baseline
   `docs/benchmarks/prompt-compiler-baseline.md`. Expect the numbers to move —
   if they move a lot, the recorded prompt-budget baseline has been measuring
   the wrong thing, which touches Phase 1 of the predecessor plan's conclusions
   about `tiny-local` overflow. Investigate before accepting the new numbers.
2. Delete `references/prompts/` and `profiles/*.yaml`; drop `profiles/` from the
   `files` allowlist in `package.json` and from `verify-v1-5-release.ts`'s
   expectations (via the Phase 3 manifest if that has landed).
3. For `references/templates/novel/`: either delete it, or — better — make
   `src/project/templates.ts` read from it so the templates have one home and
   `tests/schema.test.ts` keeps validating the same bytes the product writes.
   Prefer the second; it converts dead content into the single source of truth.
4. Remove the unreachable wizard branch and the unused exports, keeping any that
   are deliberate public API (note which, and why, in the PR).

**Acceptance.** No file under `references/` or `profiles/` is unread by both
product and test; benchmarks measure compiled specs; `npm pack --dry-run` no
longer ships dead assets.

**Effort:** M. **Risk:** low for deletion, **medium for the benchmark
re-baseline** — that one may surface a real measurement error.

## Phase 6 — Collapse the duplication

**Problem.**

- **~23 artifact stores** in `src/infrastructure/` repeat one structure. Compare
  `scene-plan-artifact-store.ts` (51 lines) and `scene-draft-artifact-store.ts`
  (56): identical `requireRunId`/`requireSceneId`/`requireAttempt` guards,
  identical mkdir → `writeFileSync(flag:"wx")` → `renameSync` → rollback-on-throw
  → `Value.Check` body, differing only in schema, path segment, and one field
  name (`plan_attempt` vs `attempt`). Helper repetition across `src/`:
  `requireRunId` ×17, `hashText` ×16, `timestamp` ×15, `stableHash` ×8.
- **`errorText`** defined identically in five files: `src/pi/extension.ts:45`,
  `recalibration-extension.ts:42`, `chapter-step-command.ts:27`,
  `plan-change-command.ts:12`, `complete-contract-command.ts:7`.
- **Flag parsing plus the target-words default** duplicated verbatim at
  `src/pi/extension.ts:401` and `:531` — including
  `profileInput === "romantasy" ? "110000" : "100000"`, a genre default living in
  the command layer in two copies.
- **Four schema registries** (`v1-2`…`v1-5`) share one
  `Array<[RegExp, TSchema]>` + `find` + normalize shape, chained by precedence at
  `transaction.ts:76`.

**Change.**

1. `src/infrastructure/artifact-store.ts` — one generic
   `createArtifactStore({ schema, segment, fileName, guards })` returning
   `{ path, write, read }`. Migrate the stores one at a time, each with its
   existing tests unchanged; the tests are the proof the migration is
   behaviour-preserving. Expect ~1,000 lines removed.
2. Shared `errorText` in `src/pi/`; delete the five copies.
3. One flag-parsing helper; move the per-genre default target words onto
   `NovelProfile` (it is genre data, and Phase 10 needs it there anyway).
4. Fold the four registries behind one table keyed by version, preserving the
   exact precedence order at `transaction.ts:76`. Behaviour-preserving only —
   no schema changes in this phase.

**Do not** collapse anything whose duplication is load-bearing: the frozen
release assertions are duplicated *on purpose* (each pins a shipped version) and
are Phase 3's business, not this phase's.

**Acceptance.** Every migrated store's existing tests pass unmodified; total
`src/` line count drops by ~1,200; no behaviour change.

**Effort:** L. **Risk:** low per step, mechanical, and each store is independently
revertable — but do it in several small PRs, not one.

## Phase 7 — Layering and toolchain

**Problem.**

- **Layer inversions.** `src/infrastructure/` imports from `src/application/` in
  four files (`budget-ledger-store.ts:5`, `transaction.ts:16`,
  `quality-job-plan-store.ts:7`, `story-record-index-store.ts:10`) and from
  `src/evaluation/` (`journey-trace-store.ts:3`).
  `src/application/quality-orchestrator.ts:84` imports from `src/pi/` — the
  adapter layer. `src/context/` and `src/application/` import each other in both
  directions (13 app→context, 5 context→app). Three import cycles exist, all
  currently benign because the back edge is `import type`, but nothing enforces
  that.
- **No linter or formatter at all.** No ESLint, no Prettier, no config. Maximum
  single-line length in `src/` is **1,248 characters** (`src/pi/extension.ts`);
  `src/profiles/romantasy.ts` has a 1,180-character line, `thriller.ts` 911. A
  genre profile that is one enormous line is a genre profile nobody diffs.
- **Two TypeBox packages** in the tree: `@sinclair/typebox@^0.34.52` (110
  imports) and `typebox@^1.3.3` (one import, `src/pi/extension.ts:3`).
- **No dependency audit** in CI.

**Change.**

1. Move the four `infrastructure → application` dependencies to inverted
   interfaces owned by `infrastructure`, or move the shared types down to
   `domain`. Same for `quality-orchestrator` → `pi`: the worker interface belongs
   in `application`, with `pi` providing the implementation.
2. Add an import-direction test (not a linter rule — a test, so it reports like
   everything else here): `domain` imports nothing above it; `infrastructure`
   never imports `application`, `pi` or `evaluation`; `application` never
   imports `pi`. Allow the remaining `context`↔`application` cycle explicitly if
   breaking it is out of scope, with the reason recorded.
3. Adopt ESLint + Prettier with a max-line rule, formatting only — no rule that
   forces a semantic change. Format in one isolated commit so it never mixes with
   logic, and add both to `test.yml` before `npm test`.
4. Standardise on `@sinclair/typebox`; drop the `typebox` dependency after
   migrating `src/pi/extension.ts:3`.
5. Add `npm audit --omit=dev` (non-blocking to start) to `test.yml`.

**Effort:** M. **Risk:** low, but the formatting commit touches every file —
land it alone, and after Phase 6, so the reformat does not fight the dedupe.

---

# Track C — Product

## Phase 8 — Typed contracts, continued: `book-plan`

**Problem.** The predecessor plan's Phase 6 shipped exactly one step —
`novel_complete_chapter_contract` — and stated the rest of the intent: *"Every
guarded event a small model is expected to author is a candidate for the same
treatment."* Every other guarded event still takes hand-authored YAML.

The 2026-08-07 review's closing line is the argument: *"The fix is not a shorter
skill. It is to stop asking the model for YAML."* `SKILL.md` currently spends
lines 96–99 warning about two failure modes that exist **only** because the model
hand-writes YAML — an unquoted scalar containing `: ` silently becoming a nested
mapping, and unlisted keys failing as additional properties — against a
one-retry budget.

**`book-plan` is the right next target.** It is the largest required file set
(seven files, nine for historical fiction), it is the event with the special
two-phase split for compact instruction budgets
(`src/application/book-plan-prompt-plan.ts`), and it is the one whose rejection
costs the most work. It is also the event whose failure the predecessor plan
found *bricks a project permanently at stage 3 of 11* under `tiny-local`.

**Change.**

1. `novel_complete_book_plan` accepting typed values, deriving what is derivable
   from existing state exactly as `contract-field-derivation.ts` does, and
   serialising the YAML itself via `stringifyYaml`.
2. Preserve every existing guarantee: it applies through the same guarded
   `book-plan` event, validates the complete set, and **refuses unknown IDs
   rather than inventing records** — the `assertKnownIds` precedent, whose
   comment already names the risk: typing the input must not move invention
   "from malformed YAML into well-formed nonsense."
3. Only once the tool exists, shorten the corresponding `SKILL.md` guidance —
   the YAML-footgun paragraphs become unnecessary rather than merely shorter.
   Invariant 6 forbids shortening an applicable rule; this phase makes the rule
   inapplicable, which is the legitimate path.

**Sequencing note.** Each converted event deletes a failure mode *and* shrinks
the instruction budget, which directly serves the `tiny-local` overflow problem.
After `book-plan`, reassess: `series-plan` and `voice-profile` are the next
candidates by the same criteria.

**Effort:** L. **Risk:** medium — this changes the model-facing interface. It is
the highest-value product work in this plan.

## Phase 9 — Let the traces choose the velocity work

**Problem.** Phase 5 of the predecessor plan landed real journey-trace recording
from `applyNovelEvent` and the run lifecycle. Nothing has yet *used* it to
change the product. Meanwhile the hand-authored fixtures name their own costs in
`limitations:` blocks:

- `brief-to-book-plan.yaml`: *"Current planning still asks four author questions
  before the book-plan decision"* and *"One rejected book-plan attempt requires a
  corrected guarded resubmission."*
- `six-packets-to-ten-chapters.yaml`: *"Current drafting requires a second
  packet-preparation prompt after chapter six."*
- `twelve-revision-tickets.yaml`: *"Current revision execution records one
  guarded transaction per ticket"* — 12 tickets, 12 prompts, 12 events.

**Change — measure first, and mean it.** These fixtures are hand-authored;
`scripts/evaluate-fixtures.ts` now says so in its own comment (*"they exercise
the evaluator, not the workflow"*). So:

1. Record real traces from the Phase 2 e2e run and from at least one real
   book-length run. Publish the summary as
   `docs/benchmarks/author-velocity-baseline.md`, in the style of the existing
   benchmark baselines.
2. Rank friction by measured cost, not by the fixtures' guesses.
3. Then implement the top items. Likely candidates, with their tensions stated:
   - **Revision batching.** `revisionPrompt` already queues N tickets
     (`src/application/run.ts:156`), and the `revise` allowlist already permits
     multiple manuscript files per event — so one event covering several tickets
     is *possible today*. **But it trades per-ticket revertability for fewer
     transactions**, and `git revert` of a single ticket is a real author
     affordance. Decide explicitly; if batching wins, batch only tickets scoped
     to the same chapter, so a revert still maps to a comprehensible unit.
   - **The second packet-preparation prompt.** Determine whether the rolling
     packet window can refresh inside the driver loop without a host round trip.
   - **The four pre-plan author questions.** Some are genuine
     decisions the writer must own (invariant 2's spirit). Reduce only those that
     are derivable; record the rest as intentional.
4. Close the self-declared instrumentation gap recorded at `CHANGELOG.md:35`:
   *"Questions asked before a project exists are not recorded, because there is
   nowhere to record them. That is a known undercount, stated rather than papered
   over."* Buffer pre-project questions in session memory and flush them into the
   trace at project creation.

**Acceptance.** A published velocity baseline; each implemented reduction shows a
measured before/after; no reduction removes a writer decision.

**Effort:** M–L. **Risk:** medium — the batching decision is a genuine design
trade, not a cleanup.

## Phase 10 — Historical-fiction parity, then genre extensibility

**Problem — two related gaps.**

*Parity:* historical fiction is the most heavily specified genre — a 199-line
profile against thriller's 40 and romantasy's 24, plus `historical-context.yaml`,
`invention-ledger.yaml`, `HIST/HC/KB/INV` ID spaces, and eight dedicated test
files. Yet `evals/` has architecture fixtures for `thriller-standalone`,
`thriller-series`, `romantasy-standalone`, `romantasy-series` — and **none for
historical fiction**, which appears only as one quality fixture
(`evals/quality/fixtures/historical-high-risk-scene.yaml`). The genre with the
most rules has the least fixture coverage.

*Extensibility:* the `NovelProfile` interface is real and has 19 `getProfile()`
call sites, but genre is hard-coded in ~12 places outside `src/profiles/` —
`PROFILE_IDS` and `ProfileIdSchema` (`src/domain/schemas.ts:6-11`), the event
allowlist and required-path sets (`events.ts:104-106,198-203`), integrity
(`integrity.ts:73`), context injection, `quality-orchestrator.ts:245,261`,
`package-checklist.ts:226-227`, `packaging/export.ts:195`, templates, and the
v1-5 registry. Meanwhile `bookPlanRules` and `bookPlanOutputs` — the interface's
own extension points — are `[]` in both thriller and romantasy.

**Change.**

1. **Parity first.** Add `evals/historical-standalone/fixture.yaml` and
   `evals/historical-series/fixture.yaml` matching the shape of
   `evals/thriller-standalone/fixture.yaml`, exercising chronology, a constraint,
   a knowledge boundary, and an invention with its writer decision. If Phase 5
   chose to keep `references/prompts/`, add the missing historical `profile.md`;
   if it deleted them, nothing to do.
2. **Then extensibility, only as far as parity requires.** Move the genre-owned
   facts onto `NovelProfile`: additional guarded file paths (with their owning
   event), required book-plan outputs, packaging checklist contributions,
   context-injection hooks, default target words (from Phase 6). Populate
   `bookPlanRules`/`bookPlanOutputs` for all three genres from what is currently
   hard-coded. `PROFILE_IDS` and the `Record<ProfileId, NovelProfile>` map stay
   as the deliberate compile-time gate — TypeScript flagging an incomplete map is
   a feature.
3. Add a test that adds a throwaway fourth profile and asserts it needs no edit
   outside `src/profiles/` and the ID union.

**Scope honestly.** Step 2 is only worth doing if a fourth genre is actually
wanted, or if steps 1 and 3 prove the hard-coding is already costing maintenance.
There is no fourth genre on the roadmap today. **Do step 1 regardless** — the
missing fixtures are a coverage gap in a shipped genre. Treat step 2 as
conditional, and say no to it cheaply if the answer is no.

**Effort:** S (step 1), L (step 2). **Risk:** low.

## Phase 11 — A second qualifiable local model

**Problem.** `src/evaluation/gemma-qualification.ts` is the largest file in
`src/` at 835 lines, and it qualifies exactly one model. The README's promise is
general — *"Novel Forge is built to work on models that are not the largest
available"* — but the only model with a qualification harness, fixtures and a
rubric is `google/gemma-3-12b-it-qat-q4_0-gguf`.

**Change.**

1. Generalise the harness into a model-parameterised qualification: fixtures and
   rubric per model under `evals/models/<model-id>/`, with the shared runner
   extracted. `evals/gemma/` becomes the first entry, its content unchanged.
2. Qualify one additional widely-available local family (Qwen or Llama class at
   comparable size), producing its execution profile with per-job token budgets
   and constrained decoding, verified by fingerprint on first guarded call
   exactly as the existing profile is.
3. Keep every existing boundary: opt-in behind its env flag, never in normal CI,
   *"It evaluates individual model jobs only. It does not qualify a book or
   change production prose behavior."*
4. Do not change any default (invariant 7).

**Effort:** L. **Risk:** low — fully additive and fenced off from CI. Requires
access to run the model, so it is the phase most likely to be gated on
environment rather than code.

---

## Sequencing summary

| # | Phase | Track | Effort | Risk | Depends on |
|---|---|---|---|---|---|
| 0 | Cut v2.2.0 | A | S | low | — |
| 1 | Documentation-parity guard | A | S | low | 0 |
| 2 | One-run definition-of-done test | A | L | med | 0 |
| 3 | Consolidate release verifiers | A | M | med | 1, 2 |
| 4 | `thriller-evidence` reachable | B | S | low | 0 |
| 5 | Delete what nothing reaches | B | M | low–med | 2 |
| 6 | Collapse duplication | B | L | low | 2 |
| 7 | Layering and toolchain | B | M | low | 6 |
| 8 | Typed `book-plan` | C | L | med | 2 |
| 9 | Trace-driven velocity | C | M–L | med | 2 |
| 10 | Historical parity → extensibility | C | S / L | low | — |
| 11 | Second local model | C | L | low | — |

**Minimum worthwhile path if the program is cut short:** Phases 0, 1, 2, 4. That
ships the work, prevents the drift that made the last release red, proves the
one-run claim, and fixes the one real defect. Everything after is genuine
improvement rather than obligation.

**Recommended first PR:** Phase 0 alone. It is small, it is the highest value in
the plan, and it produces a released baseline for everything else.

---

## Definition of done for the whole plan

1. `npm run verify:release` and the full Node 22.19.0 + 24 matrix are green, and
   the installable pinned tag matches `NOVEL_FORGE_VERSION`, the README's install
   line, and `RELEASE.md` — asserted by a version-agnostic test, not a frozen
   copy per release.
2. A single e2e test starts a project on the small-model profile, reaches a
   packaged book through writer gates and budget stops only, and asserts its
   author-action count against a declared ceiling.
3. No path created by `src/project/templates.ts` is unwritable by every event,
   and no file under `references/` or `profiles/` is unread by both product and
   tests.
4. Adding a release adds one manifest entry and no script.
5. At least one further guarded event accepts typed values instead of
   hand-authored YAML, with `SKILL.md` shortened because the rule became
   inapplicable — never because it was truncated.
6. A published author-velocity baseline exists, measured from real traces, and
   every velocity change cites a measured before/after.
7. All ten invariants hold, confirmed per phase.

## Explicitly out of scope

- Raising the default quality tier, or any change that increases spend without
  the writer asking (invariant 7).
- Any check that grades prose quality, infers authorship, or converts a band into
  a quota (invariants 8, 9).
- Any weakening of the human reader checkpoint. The recorded waiver is the only
  sanctioned path, and it never becomes evidence.
- Scraping retailer or social platforms; storing reviewer identity or full
  public-review bodies.
- Running paid evaluation or model qualification in normal CI.
- A fourth genre. Phase 10 step 2 makes one cheap **if** it is wanted; this plan
  does not propose one.

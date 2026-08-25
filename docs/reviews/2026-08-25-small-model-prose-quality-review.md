# Codebase review — the prose a small model actually writes

Date: 2026-08-25
Reviewed commit: `2c31565`
Suite state at review: `npm run typecheck` clean, `npm test` 1008/1008 pass.

Scoped to one question: **a writer installs the Pi coding agent, points Novel Forge
at a small local model, and runs it. What does the book come out like?**

The 2026-08-07 review asked whether that run could *reach the end*. Its findings are
closed: `--model-profile` threads end to end, the chapter execution machine has a
driver, the chapter cap is gone, `--until packaging` and `/novel-package --apply`
exist, the host model's capacity picks the profiles, and the release state is
consistent. This review assumes the run completes and asks what it produced.

---

## Verdict

The run now reaches the end of the book. The scene contracts it executes along the
way are incoherent, the scenes are written blind of each other, they are concatenated
rather than joined, the drafting model is given no example of the target voice, and
the critics are given no rubric. The deterministic quality checks that would catch
some of this run on the fallback path the skill tells the agent *not* to take.

The architecture is still right. Five specific pieces of it are hollow, and each one
is hollow in the same way: a field, job type, or option exists in the domain, is
carried through the schemas and the telemetry, and is never populated by a production
caller. This is the third time this repository has hit that pattern — v2.0.0 named it
for prose-lint and the critics, 2026-08-07 named it for the whole small-model path.
The fix each time was to connect an existing part, not to build a new one. That is
true again here.

---

## What holds up

Not to be disturbed by anything below.

- **The guarded transaction, the execution state machine, and complete-record context
  allocation.** Unchanged since the last review and still the load-bearing work.
- **The prompt compile matrix** (`src/evaluation/prompt-compile-matrix.ts`). 135 cells
  across every stage spec, runtime profile and genre, with the one genuine overflow
  pinned as an expected boundary rather than suppressed. This is the right way to hold
  a budget invariant, and its header comment explains exactly which live failure it
  exists to prevent.
- **Gemma qualification** (`evals/gemma/`). Opt-in, fingerprint-bound, blinded review
  kit, provenance hashes, no model self-ratings. Real evaluation engineering.
- **The evidence boundaries.** Automated diagnostics still cannot become reader
  evidence; the packaging waiver records the absence rather than hiding it.

---

## Tier 1 — findings that change the prose on the page

### 1. Scene contracts are dealt round-robin from five unlike chapter fields

`compileSceneContracts` splits a chapter into scenes by round-robin
(`src/application/contracts/scene-contract-compiler.ts:12`):

```ts
function groups<T>(items: readonly T[], count: number): T[][] {
  const result = Array.from({ length: count }, () => [] as T[]);
  items.forEach((item, index) => result[index % count]!.push(item));
  return result;
}
```

The items being dealt are the chapter's `required_beats`, which
`compileLegacyChapterContract` builds from five heterogeneous packet fields in fixed
order: `purpose`, `scene_engine`, `pressure_movement`, `character_movement`,
`relationship_movement` (`chapter-contract-compiler.ts:13`). These are not beats in
sequence. They are five different *descriptions of the whole chapter*, on five
different axes.

A 2,550–3,300 word chapter compiles to four scenes. Actual output:

```
--- CH-007-SC-02-V1 (seq 2, 638-825w) threads=["TH-02"]
  objective: SCENE ENGINE: interrogation
  conflict : Opposition prevents immediate completion of scene engine: interrogation
  turn     : SCENE ENGINE: interrogation
  ending   : SCENE ENGINE: interrogation
```

The small model is asked for 825 words of prose whose objective, conflict, turn and
ending requirement are the same eight-word string — one of which is a genre label, not
an event. Scene 3 has the same shape around `PRESSURE:`. The template conflict comes
from `conflict: requiredBeats[1] ?? "Opposition prevents immediate completion of ..."`
(`scene-contract-compiler.ts:38`), which fires for every scene that received one beat.

Round-robin also scrambles order. With five beats and four scenes, the relationship
beat (index 4) lands in **scene 1**, ahead of the character beat in scene 4 that
motivates it. `active_thread_ids` is dealt the same way, so scene 4 gets no thread at
all, and `expected_state_delta` is empty for every scene but the last.

The scene contract is the *only* structure the small model receives. Everything
downstream — the plan job, the draft job, the five critics, the state-delta extractor
— is measured against it. This is the highest-leverage defect in the repository.

**Fix.** Two parts, in order.

- Stop dealing. A chapter's five packet fields describe the chapter; they are not a
  scene sequence. Derive scene count and division from `required_beats` when the
  contract genuinely carries ordered beats, and otherwise emit **one** scene for the
  chapter rather than four incoherent ones. Contiguous chunking (`slice`) is strictly
  better than round-robin either way, and is a two-line change.
- Give a scene an objective/conflict/turn that are three different things. The
  cheapest honest version: keep `purpose` as every scene's objective, let
  `scene_engine` set the engine field rather than the objective field, and refuse to
  compile a multi-scene contract whose beats cannot supply a distinct turn — the same
  refusal `assertSmallModelChapterContract` already makes for missing fields.
  Inventing a turn would be worse than blocking, and this codebase already knows that.

Add a compiler test asserting no scene's `objective`, `turn` and `ending_requirement`
are all the same string. That single assertion pins the whole finding.

### 2. Every scene is drafted blind of the scene before it

`ActiveContextCapsule.previous_tail` exists in the domain, is rendered under a
`PREVIOUS TAIL` heading (`src/context/active-context-renderer.ts:99`), and is accepted
as `previousTail` by the capsule builder (`src/context/active-context-capsule.ts:47`).

No production caller sets it. `buildExecutionContextCapsule` — the only builder on the
execution path — omits it (`src/application/execution-context-capsule.ts:81`), as does
`context-inspection.ts:94`. Every test fixture is `previous_tail: null`; only
`tests/active-context-renderer.test.ts` ever supplies one, to test the renderer.

So scene 3 of a chapter is written with no sight of how scene 2 ended: not its last
line, not its final image, not where the characters physically are. A frontier model
drafting a whole chapter carries that continuity implicitly. A per-scene pipeline has
to hand it over, and this one does not.

**Fix.** Pass the tail of the previously accepted scene's prose — the acceptance
artifact is already on disk and already hash-verified. A few hundred characters is
enough, and it is the single cheapest quality token this pipeline can spend.

### 3. Chapter assembly is string concatenation; the stitch job does not exist

`stitchAcceptedChapter` joins accepted scenes and stops
(`src/application/chapter-stitch.ts:75`):

```ts
const chapterText = acceptances.map((item) => item.accepted_prose).join("\n\n");
```

Meanwhile `stitch-chapter` is a declared model job type
(`src/domain/model-job.ts:20`) with a budget (1,100 instruction tokens, 7,000 evidence,
2,200 reserved output) and a decoding policy (temperature 0.25, top-p 0.6, repetition
penalty 1.05) defined for it in the small-model profile
(`src/domain/model-execution-profile.ts:87`, `:110`). There is no runner. Grep finds
the string in exactly two files, both of them definitions.

Combined with finding 2, this is the whole seam problem: scenes are written without
knowing each other, then joined with `\n\n` and never reconciled. Chapter validation
that follows checks fences, headings, meta-commentary and whitespace
(`src/application/chapter-validation.ts:58`) — nothing about whether the scenes read as
one chapter.

**Fix.** Either implement the stitch job against the budget already defined for it, or
delete the job type, the budget and the decoding entry. Both are defensible; carrying
tuned decoding parameters for a job that never runs is not. If finding 2 is fixed
first, a bounded stitch pass has real work to do and a small model can do it at
temperature 0.25.

### 4. The drafting model is shown no example of the target voice

`compileProjectStyleCard` accepts `acceptedExamplePaths` and will embed up to
`MAX_EXAMPLES = 2` excerpts of `MAX_EXAMPLE_CHARS = 240`
(`src/application/style-card-compiler.ts:13`, `:163`).

Neither production caller passes it. Both call `compileProjectStyleCard(root, scene.pov)`
with no options (`execution-context-capsule.ts:92`, `context-inspection.ts:92`). So
`accepted_examples` is `[]` on every card the drafting model ever sees, and the card is
15 abstract rules — `MUST: ...`, `AVOID: ...`, `SENTENCE: ...` — and nothing else.

This matters more here than it would on a frontier host. Small instruction-tuned models
follow demonstrations considerably better than they follow abstract style rules, and
this project already produces exactly the right demonstration: the voice-experiment
workflow accepts a 600–900 word baseline scene, hashes it, and records its path in
`voice-guardrails.yaml` as `baseline.path` (`src/domain/v1-3-schemas.ts:71`). The style
card compiler parses that same file and ignores the field.

**Fix.** Default `acceptedExamplePaths` to `[guardrails.baseline.path]` when the
baseline is accepted. The hash is already in `source_hashes`, so staleness detection
comes free via `styleCardIsStale`. Then raise `MAX_EXAMPLE_CHARS` — 240 characters is
roughly forty words, which is too short to demonstrate sentence rhythm, and the runtime
profile's evidence budget can afford several hundred.

### 5. The critics are given the job-type slug as their rubric

The entire concern description sent to a critic is
(`src/application/scene-critic-runner.ts:121`):

```ts
`Review only the ${jobType} concern for the supplied scene candidate.`
```

So `critic-style` receives the literal sentence *"Review only the critic-style concern
for the supplied scene candidate."* The closing task in the capsule repeats it:
`Review only ${jobType}.` (`execution-context-capsule.ts:63`). Nothing tells the model
what continuity, causality, character-intent, style or factuality *mean* in this
project's terms.

The scaffolding around the critics is genuinely good — exact evidence quotes verified
against the candidate, verdict/severity coherence enforced, findings capped at 12. All
of it constrains the *shape* of a finding while saying nothing about what to look for.
On a frontier model, "style" plus a scene is probably enough. On a 12B Q4 it is not,
and five critics with no rubric is five chances to return `pass` on prose that has a
real problem.

**Fix.** Give each of the five job types a rubric — three to six concrete checks —
and put them where every other normative instruction in this codebase lives: a
`StageSpec` per critic, compiled by `compilePrompt` against the runtime profile, so the
budget is enforced and no rule is silently truncated. The infrastructure is already
built and already covered by the compile matrix; the critics are the one model-facing
surface that does not use it.

---

## Tier 2 — the small-model tuning that does not reach the model

### 6. Decoding parameters are computed, stored, and never sent

Every runner resolves a `DecodingPolicy` and attaches it to the worker request —
`scene-draft-runner.ts:123`, `scene-plan-runner.ts:124`, `scene-critic-runner.ts:187`,
`scene-span-repair-runner.ts:356`, `scene-state-delta-runner.ts:268`.

`piRunArgs` then builds the subprocess command line
(`src/pi/quality-worker.ts:47`):

```ts
return [
  ...prefixArgs,
  ...PI_ISOLATION_ARGS,
  ...(request.provider ? ["--provider", request.provider] : []),
  ...(request.model ? ["--model", request.model] : []),
  ...(request.thinking ? ["--thinking", request.thinking] : []),
];
```

Temperature, top-p, repetition penalty and maximum output tokens are not passed.
`composePiWorkerInput` does not carry them either. `request.decoding` reaches the
process only as telemetry.

So the difference between temperature 0.05 / top-p 0.2 for a structured extraction job
and temperature 0.65 / top-p 0.9 with repetition penalty 1.08 for drafting — the
core of the small-model tuning — has no effect on any inference. Both run at whatever
the Pi agent's default is.

Three tests assert this tuning exists (`tests/model-job.test.ts:22`,
`tests/model-execution-profile.test.ts:55`, `tests/gemma-model-profile.test.ts:16`).
All three assert properties of the profile *data structure*. None asserts that a
decoding parameter reaches an argument vector, which is why a suite of 1008 passing
tests is consistent with the feature not existing.

The README states the exact-model profile "carries per-job token budgets and
constrained decoding". The budgets are real and enforced before inference by
`assertModelJobFits`. The decoding is not.

**Fix.** Map `DecodingPolicy` onto the Pi CLI's decoding flags in `piRunArgs`, and
assert in a test that a `draft-scene` request and an `extract-state-delta` request
produce different argument vectors. If the Pi agent has no flag for a given parameter,
drop that parameter from `DecodingPolicy` rather than keeping a field that cannot be
honoured. Until then, correct the README sentence.

### 7. `capabilities.json_schema` and `capabilities.grammar` are never read

The Gemma profile declares `{ json_schema: false, grammar: true, tool_calls: false }`
(`src/domain/model-execution-profile.ts:140`). Grep finds `grammar` in exactly one
file — the definition. Nothing branches on either flag.

Six of the pipeline's job types demand exact JSON, and `exactJsonObject` requires the
response to start with `{` and end with `}` (`src/application/quality-output.ts:29`).
A ```json fence — the single most common small-model formatting habit — throws. There
is no fence-stripping, no brace extraction, no reprompt-on-parse-failure. The attempt
is spent and the state machine records a failure.

Declaring `grammar: true` and then not constraining decoding is the same gap as finding
6, viewed from the other end: the capability is described, and the description does
nothing.

**Fix.** At minimum, salvage a fenced or prose-wrapped JSON object before failing —
strip ``` fences and take the outermost balanced braces. That is a dozen lines and
converts a class of hard failures into successes. Then either use `capabilities` to
select grammar-constrained decoding where the backend supports it, or delete the field.

---

## Tier 3 — reach, robustness, and one inverted default

### 8. The guarded path skips the deterministic quality checks the fallback runs

`draftLintReport` and `draftLengthFinding` are called from exactly one place, gated on
`input.eventType === "draft-chapter"` (`src/application/events.ts:492`, `:503`).

The guarded scene path does not emit a `draft-chapter` event. `applyInternalDraftCommit`
goes straight to `applyGuidedProjectEvent`
(`src/application/chapter-commit.ts:407`), and `validateInternalDraftCommit`
(`:342`) checks stage, packet status, genre config, profile packet fields, plot
presence and gate agreement — no prose lint, no length band, no dialogue
differentiation.

The result is inverted against the intent. SKILL.md tells the agent to prefer
`novel_advance_chapter_step` and to disclose it when it falls back to whole-chapter
drafting. The disclosed fallback runs style-tell bands, filter-word rates,
em-dash density and per-speaker dialogue separation against the submitted text. The
preferred path runs none of them. A chapter can be committed at 55% of its packet
target — which a `draft-chapter` event would **reject** — without anything noticing,
because scene word ranges are checked per scene and no one sums them against
`packet.target_words`.

**Fix.** Call `draftLintReport` and `draftLengthFinding` on the stitched chapter text
inside `validateInternalDraftCommit`, and surface the advisories through the commit
result. The functions are pure and take text; this is a call site, not a feature.

### 9. One model profile, fingerprint-locked to one context setting

`MODEL_EXECUTION_PROFILE_IDS` is `["host-default", "gemma-3-12b-it-qat-q4_0",
"small-12b-q4" (deprecated alias), "custom"]`. There is exactly one real small-model
profile, and `ModelFingerprint.profile_id` is typed as that literal
(`src/domain/model-fingerprint.ts:12`), so adding a second requires changing the
fingerprint type, not just adding data.

`assertGemmaFingerprintMatchesProfile` additionally requires the backend to report
`context_window_tokens === 16_384` and `maximum_output_tokens === 4_096` exactly
(`src/domain/model-fingerprint.ts:38`, `:41`). A writer running the correct model file
under llama.cpp with `-c 8192` or `-c 32768` fails qualification. The check is right to
be strict about *identity*; being strict about a runtime flag the writer chose is a
different thing, and it is the more likely failure in practice.

Everything else — Qwen 3, Llama 3.3, Mistral Nemo, Phi-4, gpt-oss — falls back to
`host-default`: 128,000 reliable context, 32,000 max output, temperature 0.7,
`json_schema: true`, `tool_calls: true`. Every one of those is wrong for a local model,
and `assertModelJobFits` will happily approve a 24,000-character evidence block for a
model that cannot hold it.

**Fix.** Make the profile a small data table rather than a hard-coded pair. `smallBudgets`
and `smallDecoding` are already parameterless factories — a `small-8b`, `small-14b` and
`small-32b` family costs little more than the context/output numbers. Relax the
fingerprint to bind identity (model, quantization, backend) and to require only that the
reported window is **at least** the profile's `reliable_context_tokens`, rather than
equal to it.

### 10. The capacity advisor recommends the Gemma profile for any named model

`recommendProfilesForCapacity` returns `GEMMA_3_12B_QAT_PROFILE_ID` whenever
`hasExplicitWorkerModel` is true (`src/application/capacity-profile-advisor.ts:88`) —
it never looks at what the model is.

Set `NOVEL_FORGE_QUALITY_MODEL=qwen/qwen3-14b` and `/novel-start` recommends, and on
acceptance writes, a Gemma profile into `PROJECT.yaml`. Qualification then throws on
the first guarded call. The file's own header comment forbids exactly this outcome —
"Recommending it otherwise would write a profile into PROJECT.yaml that makes guarded
execution fail on its first call — the same shape of defect as a flag that parses and
does nothing" — and then the code does it for every model that is not Gemma.

**Fix.** Gate the recommendation on the model identifier matching
`GEMMA_3_12B_QAT_MODEL_ID`. For any other named model, keep `host-default` and say
which profile would be needed. With finding 9 done, this becomes a lookup instead.

### 11. `tiny-local` book planning has four characters of headroom

The compile matrix passes, but the margin is not asserted anywhere. Measured from
`npm run benchmark:prompts`:

| profile | tightest cell | chars | limit | headroom |
|---|---|---|---|---|
| `full` | review / manuscript-with-lint / historical-fiction | 12,789 | 24,000 | 11,211 |
| `local` | book-plan / single-spec-full-rules / historical-fiction | 8,192 | 10,000 | 1,808 |
| `tiny-local` | book-plan / public-review-evidence / historical-fiction | **5,996** | **6,000** | **4** |

One extra word in any historical-fiction book-plan rule reinstates the exact failure
the matrix was built to prevent — a hard stop at stage three of eleven, on the profile
named for the smallest models.

**Fix.** Assert a minimum headroom (5–10% of the profile ceiling) in the matrix rather
than only assert compilation. A margin regression should fail the build while there is
still margin to lose.

### 12. Repetition memory cannot see inside the chapter being written

`buildProjectRepetitionMemory` reads committed manuscript chapter files, defaulting to
the last three (`src/application/repetition-memory.ts:14`). Accepted scenes of the
chapter currently in flight are not committed, so scene 4 is drafted with no knowledge
that scenes 1–3 all opened on the weather.

The style card carries `recent_patterns_to_avoid` and the renderer emits it, so the
delivery path is built; the memory just has nothing intra-chapter to deliver. With
finding 2 fixed this narrows but does not close — a tail shows the previous scene, not
the pattern across three of them.

**Fix.** Fold accepted scene prose from the active run into the memory when compiling a
style card mid-chapter. The acceptance artifacts are on disk and hash-verified.

### Smaller items

- No wall-clock estimate reaches the writer. A 40-chapter book is on the order of
  1,300–1,600 model calls through this pipeline (≈8 per scene before repair). On a 12B
  Q4 on consumer hardware that is many hours. `ModelCallReport.elapsedMs` is already
  recorded per call and never aggregated into status or the run report. A projected
  completion time from observed per-call latency would cost almost nothing and would
  change how a writer plans a run.
- `/novel-run` hardcodes all five critics (`quality-persistent-run.ts:190`) while
  `/novel-chapter-step` accepts `--critics`. On a slow local model, letting a run narrow
  its critic set is the most direct throughput control available, and it already exists
  one layer down.
- The deprecated `small-12b-q4` alias is exported in `MODEL_EXECUTION_PROFILE_IDS` and
  resolves to the same frozen object as the canonical ID. Now is a good moment to drop
  it, before finding 9 multiplies the table.

---

## Recommended order

Findings 1–5 change what the book reads like and are all connect-what-exists work.
Do them first, in this order:

1. **Scene contract division** (1). Everything downstream is measured against it, so
   nothing else can be evaluated honestly until it is coherent. Start with contiguous
   chunking and the objective/turn/ending assertion.
2. **`previous_tail`** (2) and **style-card exemplars** (4). Two call-site changes,
   both feeding the drafting job the context it is missing.
3. **Critic rubrics as stage specs** (5). Gives the correction loop something to
   correct toward.
4. **Lint and length on the guarded path** (8). Makes the recommended path at least as
   well checked as the discouraged one.
5. **Decoding parameters, or the README sentence** (6), and **JSON salvage** (7).
6. **Then the stitch job** (3), which only has real work once 1 and 2 land.

Findings 9–11 widen who can run this at all and can proceed in parallel.

## One structural note

The last review closed with the observation that asking a weak model for schema-exact
YAML is the wrong interface, and that `novel_complete_chapter_contract` — typed values
in, serialisation owned by the tool — was the right pattern to spread.

That pattern shipped, and it is good. But the two fields it still asks the author for,
`required_end_state` and `forbidden_changes`, are not what the drafting model actually
runs on. What it runs on is the *scene* contract, which no one authors and no one
reviews: it is derived silently from the chapter contract by 50 lines of round-robin,
and finding 1 is what that derivation currently produces.

The lesson generalises past YAML. Wherever this system computes something the model
must obey, that computation deserves the same scrutiny as a schema — because the model
will obey it exactly, and a small model has no capacity to notice that its brief makes
no sense.

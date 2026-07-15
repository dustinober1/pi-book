# Novel Forge 1.3 Author Taste and Reader Friction Design

## Purpose

Novel Forge 1.3 adds structured author-taste discovery, original voice calibration, research-to-drama tracking, public-review friction analysis, book-level reader strategy, and evidence-backed voice and scene audits without complicating the normal `/novel` workflow.

The release must help writers learn from authors and books they admire without asking the model to imitate a named author. It must also learn from recurring public-review complaints without treating one-star reviews as universal truth or as evidence about the current manuscript.

## Product boundary

The normal author flow remains `/novel-start` followed by `/novel`. An optional `/novel-wizard research` surface may make influence, voice-comparison, review-import, and research-ledger work easier to inspect. The browser remains loopback-only, read/propose-only, and returns accepted mutations through typed application services, stale-stage/hash validation, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.

Do not add a new top-level creative stage. Add a non-transitioning `research-update` event that can operate during `voice-intake`, `series-planning`, `book-planning`, `drafting`, `act-review`, `revision`, `manuscript-review`, and `packaging`. It must never write manuscript prose, change gates, or advance stage.

## Evidence separation

Novel Forge must keep three evidence classes separate:

1. Author taste evidence: named books/authors, the writer's own samples, admired qualities, rejected qualities, and accepted voice experiments.
2. Public market evidence: review observations, genre discussions, comparable-title expectations, praise clusters, complaint clusters, and accepted tradeoffs.
3. Project reader evidence: de-identified human responses to the user's own manuscript, stored only in existing reader experiments.

Public reviews must never affect manuscript reader metrics, validation verdicts, or claims that the current manuscript was tested.

## Influence and voice model

Create `series/taste-profile.yaml`, `series/voice-guardrails.yaml`, and `series/voice-experiments/` while preserving `series/voice-profile.md` as the readable voice compass.

Every influence reference must declare:

- influence type: voice, reader experience, structure, characterization, atmosphere, or market position;
- qualities admired;
- qualities explicitly not wanted;
- neutral derived craft traits.

The precedence order is:

1. explicit writer decisions;
2. writer samples;
3. accepted voice baseline;
4. approved project voice profile;
5. influence references;
6. genre defaults.

Raw author names and book titles may remain in private taste evidence but must not enter drafting instructions. Voice guardrails must reject direct imitation language such as `write like`, `imitate`, or `in the style of`.

The voice experiment generates three anonymous versions of the same 600–900 word source scene. The writer scores how well each feels like the book, creates desire to continue, supports character intimacy, sounds natural, feels distinctive, and lands on the sparse/dense scale. The accepted or combined result becomes a hashed baseline.

## Research model

Create `books/<book-id>/research-ledger.yaml` with four lanes:

- taste-and-voice;
- story-world;
- human-authenticity;
- reader-and-market.

Every ready research item must include source IDs, confidence, verification date, fictionalization status, knowledge scope, risk, and at least one dramatic use: obstacle, false assumption, hidden capability, deadline, vulnerability, forensic clue, procedural constraint, credibility detail, relationship pressure, or moral choice.

Chapter packets continue to use `required_research`, but the IDs refer to ready research-ledger items. A ready packet that references missing or unready research is blocked.

## Reader-friction research

Version 1.3 does not scrape retailers or social platforms. It accepts user-supplied notes, pasted observations, links gathered by an available research tool, and CSV imports.

Store paraphrased observations rather than full review bodies. Remove reviewer names, handles, and profile URLs. Each observation records title, source location, date observed, rating when available, paraphrase, optional short excerpt, genre relevance, execution relevance, and category.

Categories are:

- genre mismatch;
- genre-promise failure;
- execution problem;
- character friction;
- pacing problem;
- style preference;
- production problem;
- content or ideological objection.

Analyze one- and two-star reviews as severe dissatisfaction, three-star reviews as mixed but often highly actionable evidence, and four- and five-star reviews as the strengths readers value. Every negative cluster must be checked against positive counterweights before becoming a recommendation.

Confidence rules:

- weak: fewer than three observations or only one title;
- moderate: at least three observations across two titles;
- strong: at least six observations across three titles, specific execution relevance, and a positive counterweight.

Evidence drawn only from one-star reviews can never exceed moderate confidence.

Each cluster receives a writer decision: prevent, mitigate, accept-as-tradeoff, or irrelevant-to-project. Only approved, project-relevant clusters become guardrails.

## Book strategy

Create `books/<book-id>/book-strategy.yaml` as the durable home for:

- reader promise;
- expectation map: satisfy, delay, invert, avoid;
- reader-friction clusters and decisions;
- accepted tradeoffs;
- originality risks and mitigations;
- approved review-derived guardrails.

Extend `plot-grid.yaml` with a decision-and-consequence ledger containing choice, immediate gain, deferred cost, irreversible effect, payoff window, and status.

Before book-plan approval, run a stress test covering early genre promise, middle repetition, motivated risk, fair clue/fact availability, uneven suspect/rival development, avoidable-silence conflict, redundant characters, external and emotional ending contracts, excessive resemblance to references, and intentional tradeoffs.

## Audits and learning loop

Add voice-drift, scene-engine diversity, and guardrail-promotion audits.

Voice drift compares accepted prose against the baseline and guardrails using non-prescriptive signals such as sentence and paragraph distributions, dialogue ratio, fragment frequency, rhetorical questions, filter words, repeated body-language vocabulary, and interiority density. Metrics are evidence, not quotas.

Run voice audits after Chapter 1, after Chapter 3, at act boundaries, at manuscript review, and when recalibration is requested.

Use the existing `scene_engine` field to flag more than two consecutive scenes with the same engine, excessive whole-book dominance, interviews/conversations that do not alter case/relationship/power state, and consecutive chapters with indistinguishable state changes.

Extend revision tickets with recurrence metadata. A pattern becomes a promotion candidate after three occurrences in distinct chapters or two milestone reviews. Promotion requires writer approval and adds a concise rule to `book-strategy.yaml`; it does not automatically rewrite earlier prose.

## Continuity graph integration

The continuity graph merged in PR #6 remains derived from canonical YAML. Extend it only with safe research-item-to-source links after research schemas stabilize. Preserve the existing maximum depth, explicit-before-discovered ordering, provisional-record restrictions, active-thread restrictions, later-book exclusions, and provenance reporting.

Raw reviews and raw influence references never enter chapter context. Drafting receives only approved neutral voice guardrails, approved book guardrails, explicitly required ready research claims, source provenance, and the existing bounded graph context.

## Compatibility

Existing 1.2 projects remain readable without mandatory migration. Missing 1.3 artifacts are advisory unless the writer intentionally rebuilds the relevant voice or book plan. Existing approvals and manuscript prose remain valid. New projects and newly added books receive the 1.3 templates.

## Security and privacy

- No platform scraping in the package.
- No reviewer identity retention beyond source-level provenance.
- No full review-body storage by default.
- No remote browser assets, analytics, or third-party scripts.
- No direct wizard writes or arbitrary commands.
- Every accepted mutation uses typed schemas, allowlists, stale checks, rollback, one Git checkpoint, and regenerated guidance.

## Testing and release

Use TDD and focused commits. The release target is exactly `1.3.0`. Full verification is required on Node 22.19.0 and Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Do not create `v1.3.0` until the merged `main` commit passes both matrix jobs.

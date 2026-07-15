# Novel Forge 1.3 Author Taste and Reader Friction Master Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap phase-by-phase. Each phase must receive its own detailed TDD implementation plan before code changes begin.

**Goal:** Add author-taste discovery, original voice calibration, research-to-drama control, public-review friction analysis, book strategy, and evidence-backed prose/scene audits while preserving Novel Forge's simple `/novel` workflow and transactional safety.

**Architecture:** Add typed 1.3 evidence artifacts and a non-transitioning `research-update` event. Keep public market evidence separate from real manuscript reader evidence, compile raw influences into neutral approved guardrails, and expose the new workflows through the existing loopback-only read/propose wizard. Extend the merged continuity graph only after research contracts are stable.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, Pi Coding Agent 0.80.3, TypeBox, YAML, static browser HTML/CSS/JavaScript, Node test runner, existing Novel Forge transactions, Git checkpoints, wizard session services, and deterministic audits.

## Global Constraints

- Version target is exactly `1.3.0`.
- Work on `agent/v1.3-author-taste-reader-friction` and use focused draft PRs against `main`.
- PR #6 is merged; its continuity graph and safety rules are the integration baseline.
- `/novel` remains the normal author interface.
- Do not add a top-level creative stage.
- Do not scrape retailer or social platforms from the package.
- Public reviews never count as reader evidence for the current manuscript.
- Named influences never enter drafting instructions.
- The writer's decisions, samples, and accepted baseline outrank external influences.
- The browser never writes project files directly and never invokes arbitrary commands.
- Every accepted mutation uses typed validation, expected-stage and project-hash checks, rollback, one Git checkpoint, and regenerated `STATUS.md` and `HANDOFF.md`.
- Existing 1.2 approvals and manuscript prose remain valid unless the writer intentionally rebuilds the relevant plan.
- Use TDD, focused verification, and logically separated commits.
- Do not create `v1.3.0` until merged `main` passes Node 22.19.0 and Node 24.

---

## Phase 1 — Contracts, events, templates, and compatibility

### Deliverables

- `src/domain/v1-3-schemas.ts`
- `src/domain/v1-3-schema-registry.ts`
- typed taste profile, voice guardrails, voice experiment index/file, research ledger, book strategy, and voice-audit contracts;
- `research-update` event with stage-specific allowlists and no state transition;
- expanded `voice-profile`, `book-plan`, and `review` event allowlists;
- new-project and new-book templates;
- advisory-only compatibility for existing 1.2 projects;
- version target `1.3.0`.

### Required behavioral tests

- new 1.3 projects receive all new artifacts;
- existing 1.2 projects open without mutation or blockers;
- missing 1.3 files become advisories until a corresponding plan is rebuilt;
- `research-update` rejects manuscript, `PROJECT.yaml`, `BOOK.yaml`, gate, and stage mutations;
- stale stage/hash submissions fail;
- rebuilt 1.3 voice and book plans require their new evidence artifacts;
- schema registry validates every new YAML path.

### Gate to continue

```bash
npm ci
npm run typecheck
node --import tsx --test tests/v1-3-schemas.test.ts tests/research-event.test.ts tests/v1-3-compatibility.test.ts tests/project-store.test.ts
```

Expected: all pass with no changes outside documented paths.

---

## Phase 2 — Influence Palette and anonymous voice calibration

### Deliverables

- influence capture with explicit `admired_for`, `not_for`, influence type, and neutral derived traits;
- precedence enforcement: writer decisions, samples, baseline, profile, references, genre defaults;
- direct-imitation language validator;
- three anonymous 600–900 word voice variants from one source scene;
- scoring and trait-combination workflow;
- accepted baseline with content hash;
- compiled `voice-profile.md` and `voice-guardrails.yaml`;
- drafting context that contains approved guardrails but excludes raw influence names.

### Required behavioral tests

- an influence missing `not_for` is rejected;
- writer samples outrank conflicting external references;
- anonymous variants contain no author/book labels;
- direct imitation instructions are blocked;
- neutral high-level traits are accepted;
- accepted baseline hash is stable;
- raw influence names do not appear in chapter context;
- project-specific guardrails fit within the existing context budget.

### Gate to continue

```bash
node --import tsx --test tests/influence-palette.test.ts tests/voice-experiment.test.ts tests/originality-guardrails.test.ts tests/context.test.ts
```

---

## Phase 3 — Research ledger and review-observation analysis

### Deliverables

- four research lanes: taste-and-voice, story-world, human-authenticity, reader-and-market;
- source register extensions for reliability, observation date, and supported research IDs;
- research item state with knowledge scope, fictionalization, confidence, risk, and dramatic use;
- pasted/manual/CSV review observation intake;
- reviewer-identity stripping and paraphrase-first storage;
- rating bands: 1–2 negative, 3 mixed, 4–5 positive;
- review categories from the approved design;
- complaint and praise clustering;
- weak/moderate/strong confidence rules;
- one-star-only evidence capped at moderate confidence;
- writer decisions: prevent, mitigate, accept-as-tradeoff, irrelevant-to-project;
- strict separation from manuscript reader experiments.

### Required behavioral tests

- review imports discard names, handles, and profile URLs;
- one-star-only evidence cannot become strong;
- three-star observations remain a distinct signal;
- positive counterweights are preserved rather than flattened;
- public reviews cannot update reader metrics or verdicts;
- unready research cannot satisfy a chapter packet;
- research without dramatic use remains blocked;
- accepted tradeoffs remain visible in downstream strategy.

### Gate to continue

```bash
node --import tsx --test tests/research-ledger.test.ts tests/review-import.test.ts tests/reader-friction.test.ts tests/reader-impact-validation.test.ts
```

---

## Phase 4 — Book strategy, architecture, and graph integration

### Deliverables

- `book-strategy.yaml` with reader promise, expectation map, friction decisions, accepted tradeoffs, originality risks, and approved guardrails;
- book-plan stress test covering promise timing, middle repetition, motivated risk, fair information, uneven alternatives, avoidable silence, redundant characters, ending contracts, reference similarity, and intentional tradeoffs;
- plot-grid decision-and-consequence ledger;
- chapter packet validation against ready research IDs;
- bounded chapter context containing approved voice guardrails, approved book guardrails, required research claims, and source provenance;
- continuity graph extension for safe research-item-to-source links only;
- preservation of graph depth, explicit-before-discovered order, provisional restrictions, active-thread restrictions, later-book exclusion, and provenance reporting.

### Required behavioral tests

- unapproved friction clusters never enter drafting context;
- raw review text never enters drafting context;
- raw influence names never enter drafting context;
- missing or unready research blocks a ready packet;
- decision entries link to valid planned chapters;
- research graph discovery preserves the current safety contract;
- context report explains included and blocked research records;
- existing continuity graph tests remain unchanged and passing.

### Gate to continue

```bash
node --import tsx --test tests/book-strategy.test.ts tests/expectation-map.test.ts tests/decision-ledger.test.ts tests/context.test.ts tests/story-graph.test.ts
```

---

## Phase 5 — Voice drift, scene diversity, and revision learning

### Deliverables

- deterministic voice-metric extraction;
- baseline and POV-aware voice drift reports;
- milestone integration after Chapter 1, Chapter 3, act boundaries, manuscript review, and explicit recalibration;
- scene-engine diversity audit using existing packet fields;
- state-change audit for repeated interviews/conversations and indistinguishable adjacent chapters;
- revision-ticket recurrence metadata;
- promotion candidates after three distinct-chapter occurrences or two milestone reviews;
- writer-approved promotion into `book-strategy.yaml`;
- no automatic retroactive prose rewrite.

### Required behavioral tests

- metric changes produce evidence, not automatic severity conclusions;
- intentional exceptions can be protected;
- more than two consecutive identical scene engines are flagged;
- repeated dialogue/interview scenes without state changes are flagged;
- recurrence thresholds are exact;
- candidate guardrails do not activate before approval;
- approved guardrails enter future drafting context;
- earlier unaffected prose remains untouched.

### Gate to continue

```bash
npm run audit:voice
node --import tsx --test tests/voice-drift.test.ts tests/scene-engine.test.ts tests/guardrail-promotion.test.ts tests/gate-guidance.test.ts
```

---

## Phase 6 — Guided research wizard

### Deliverables

- `research` added to `WizardWorkflow`;
- research wizard snapshot, preview, and typed apply handlers;
- Influence Palette surface;
- anonymous voice comparison and scoring surface;
- reader-friction observation import and cluster-decision surface;
- research-ledger readiness surface;
- `/novel-wizard research` command completion;
- context-sensitive `/novel` action labels;
- bundled static assets with no remote scripts, fonts, analytics, or arbitrary endpoints.

### Required behavioral tests

- wizard snapshots contain sanitized project data only;
- preview cannot mutate files;
- stale proposals fail;
- source uploads remain session-owned and expire safely;
- accepted actions return through typed services and transactions;
- the browser cannot submit manuscript writes;
- package smoke test includes updated wizard assets;
- existing adoption, readers, packaging, and next-book workflows remain passing.

### Gate to continue

```bash
node --import tsx --test tests/research-wizard.test.ts tests/e2e/research-wizard.test.ts tests/wizard-runtime.test.ts tests/commands.test.ts tests/package-smoke.test.ts
```

---

## Phase 7 — Evaluation, documentation, and release

### Deliverables

- README and SKILL contract updates;
- release and changelog documentation;
- evaluation fixtures for original influence translation, writer-sample precedence, one-star noise handling, praise/complaint pairing, intentional tradeoffs, voice drift, scene diversity, agency tracking, and approved guardrail promotion;
- package version and lockfile synchronization;
- complete Node matrix verification;
- release notes with compatibility and non-scraping boundaries.

### Final verification

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected on Node 22.19.0 and Node 24:

- all behavioral and end-to-end tests pass;
- evaluation fixtures pass;
- Pi command/tool lifecycle tests pass;
- packed extension install/import/registration passes;
- wizard assets are packaged;
- no temporary files, imported review corpora, generated experiment outputs, or test fixtures leak into release files.

## PR sequence

1. Contracts and compatibility.
2. Influence Palette and voice experiments.
3. Research ledger and reader friction.
4. Book strategy and graph integration.
5. Audits and revision learning.
6. Research wizard.
7. Evaluation, documentation, and release.

Each PR must be independently testable and reviewable. Do not combine all phases into one release PR.

## Immediate next implementation step

Write the detailed TDD implementation plan for **Phase 1 only**. That plan must identify exact files, public interfaces, failing tests, expected failure messages, minimal implementations, focused verification commands, and commit boundaries. Do not begin Phase 2 until Phase 1 is merged and the full repository verification suite passes.

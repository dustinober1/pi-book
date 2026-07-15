# Author Taste, Research, and Reader Friction Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development where available, otherwise superpowers:executing-plans. Execute one pull request phase at a time with review and verification between phases.

**Goal:** Deliver Novel Forge 1.3.0 with original author-taste discovery, anonymous voice baselines, story-use research, public-review friction analysis, and evidence-backed drafting and revision guardrails.

**Architecture:** Preserve `/novel` as the primary interface and the existing typed transaction engine as the sole mutation boundary. Add typed evidence artifacts and one non-transitioning `research-update` event; keep public market evidence, manuscript reader evidence, and factual research separate. Extend the derived continuity graph only after the new research contracts stabilize.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, Pi Coding Agent 0.80.3, TypeBox, YAML, static browser HTML/CSS/JavaScript, Node test runner, GitHub Actions.

## Global Constraints

- Version target is exactly `1.3.0` only after all four feature PRs merge and the resulting `main` commit passes the full matrix.
- Work from merged `main` commit `49888355c84f9089a95f09a90b58675987ee6be7` or a verified descendant.
- `/novel` remains the primary author workflow.
- No automated retailer or review-platform scraping is added in 1.3.
- Author references are translated into neutral craft traits; drafting prompts never request direct imitation.
- Writer decisions, writer samples, and accepted baseline prose outrank outside influences.
- Public reviews never count as evidence about the current manuscript.
- Only accepted, de-identified `source: human` reader-experiment rows support manuscript reader claims.
- Existing 1.2 projects remain readable and are not retroactively blocked by missing 1.3 artifacts.
- Every accepted mutation uses expected-stage and project-hash validation, schema validation, rollback, one Git checkpoint, and regenerated `STATUS.md` and `HANDOFF.md`.
- Do not create `v1.3.0` until the merged `main` commit passes Node 22.19.0 and Node 24.

---

## PR 1 — Foundation contracts and compatibility

Execute [`2026-07-15-author-taste-reader-friction-foundation.md`](./2026-07-15-author-taste-reader-friction-foundation.md).

Deliverables:

- 1.3 typed schemas and schema registry;
- default artifacts for new projects and books;
- non-transitioning `research-update` event;
- expanded voice-profile and book-plan allowlists;
- 1.2 compatibility and guided backfill advisories;
- project-version contract and tests;
- design and roadmap documentation.

Gate:

```bash
npm ci
npm run typecheck
node --import tsx --test tests/v1.3-schemas.test.ts tests/research-event.test.ts tests/v1.3-compatibility.test.ts tests/project-store.test.ts
npm test
npm run eval
npm pack --dry-run
```

Expected: all pass on Node 22.19.0 and Node 24; existing 1.2 fixtures remain readable; new projects receive all 1.3 foundation files; research updates cannot write manuscript or project-state files.

## PR 2 — Influence Palette and voice baseline

Deliverables:

- typed influence intake and precedence rules;
- neutral craft-trait compiler;
- anonymous voice experiment artifacts;
- writer scoring and accepted baseline hash;
- originality and imitation-language validation;
- drafting context receives guardrails and baseline evidence, not raw influence names.

Gate:

```bash
node --import tsx --test tests/influence-palette.test.ts tests/voice-experiment.test.ts tests/originality-guardrails.test.ts tests/context.test.ts
npm test
npm run eval
npm pack --dry-run
```

## PR 3 — Research ledger and reader friction

Deliverables:

- four research lanes;
- story-use and knowledge-scope validation;
- public-review manual, paste, and CSV observation intake;
- reviewer-identity stripping;
- complaint/praise classification and clustering;
- one-star-only confidence ceiling;
- book strategy and approved tradeoffs;
- strict separation from manuscript reader evidence.

Gate:

```bash
node --import tsx --test tests/research-ledger.test.ts tests/review-import.test.ts tests/reader-friction.test.ts tests/reader-impact-validation.test.ts
npm test
npm run eval
npm pack --dry-run
```

## PR 4 — Architecture integration, audits, wizard, and release

Deliverables:

- research-item-to-source graph integration with existing safety limits;
- decision-and-consequence ledger;
- scene-engine diversity audit;
- voice-drift audit;
- revision-ticket guardrail promotion;
- `/novel-wizard research` read/propose/apply workflow;
- docs, evaluation fixtures, migration guidance, and release notes.

Final gate:

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
- real Pi command/tool lifecycle tests pass;
- packed extension install and registration pass;
- no raw public reviews, reviewer identities, or influence names enter drafting context;
- no 1.2 project is mutated merely by being opened.

## Review checkpoints

- Use failing tests before each behavior implementation.
- Commit test and implementation changes in logically reviewable units.
- Inspect changed filenames after every task and confirm event allowlists match the design.
- Do not begin PR 2 until the artifact schemas and compatibility behavior from PR 1 are merged.
- Do not extend the continuity graph until research item and source provenance contracts are stable.
- Leave each feature PR draft until its complete Node matrix is green and all review threads are resolved.

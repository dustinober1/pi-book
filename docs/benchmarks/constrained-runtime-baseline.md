# Constrained Runtime Foundation Baseline

Original baseline date: 2026-07-16  
Budget-correctness clarification: 2026-07-21

## Repository state

- Repository: `dustinober1/pi-book`
- Default branch: `main`
- Original measurement branch: `feat/constrained-runtime-foundation`
- Original pull request: #29, `Add constrained runtime profiles and baseline telemetry`
- Budget-correctness pull request: #34
- Supported CI runtimes: Node 22.19.0 and Node 24

The original benchmark established runtime profiles, telemetry, and deterministic fixtures. PR #34 corrects the meaning and enforcement of those profile limits without changing their existing character ceilings.

## Current budget contract

A runtime profile now separates four different capacities:

| Profile | Normative instruction characters | Evidence/context characters | Reserved output tokens | Safety margin tokens |
|---|---:|---:|---:|---:|
| `tiny-local` | 6,000 | 12,000 | 2,000 | 500 |
| `local` | 10,000 | 24,000 | 4,000 | 1,000 |
| `full` | 24,000 | 72,000 | 8,000 | 2,000 |

For one compatibility release:

- `maxPromptChars` mirrors `modelBudget.maxInstructionChars`.
- `maxContextChars` mirrors `modelBudget.maxEvidenceChars`.

Neither legacy field is a complete request-window limit. Before inference, Novel Forge compiles normative instructions independently, reserves output and safety capacity, and then attaches only evidence that fits the remaining evidence/model budget.

## Context-allocation contract

Structured drafting context is allocated by complete record. Canon facts, relationships, story threads, research claims, source provenance, plot entries, historical chronology, constraints, knowledge boundaries, and inventions are either included completely or omitted completely.

Required records are allocated before optional records. If required records cannot fit, drafting stops before inference and reports every missing record ID. Previous-chapter prose is split into complete paragraphs and selected from the ending backward; a paragraph is never cut in the middle.

## Verification commands

The repository gates run on both supported Node versions:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run --silent benchmark:constrained-runtime
npm run benchmark:prompts
npm run verify:release
npm pack --dry-run
```

## Retained benchmark artifact

The constrained-runtime artifact remains schema `1.0.0` and now contains two arrays:

- `results` — the six existing planning, drafting, and revision fixtures;
- `boundaries` — one near-limit instruction/evidence scenario for each runtime profile.

The boundary scenarios assert:

- normative instructions remain within 100 characters of the configured instruction ceiling;
- evidence remains within 200 characters of the configured evidence ceiling;
- every required structured record is included;
- one deliberately oversized optional record is omitted intact;
- a one-character instruction overflow fails with `PromptBudgetError`;
- one additional required record fails with `ContextBudgetError` and its exact ID.

The artifact contains counts and status only. It does not contain fixture prose, raw prompts, model output, private evidence, source excerpts, or credentials.

## Original full-profile measurements

The original six synthetic measurements are retained for historical comparison. The first two count columns should now be read as **instruction characters** and **evidence/context characters** rather than as one undifferentiated prompt limit.

| Scenario | Instruction chars | Evidence/context chars | Estimated input tokens | Stage | Validation | Files changed | Bytes changed |
|---|---:|---:|---:|---|---|---:|---:|
| thriller-standalone-planning | 5,636 | 1,904 | 1,885 | pass | pass | 3 | 1,990 |
| thriller-series-planning | 5,636 | 1,964 | 1,900 | pass | pass | 3 | 2,052 |
| romantasy-standalone-planning | 5,691 | 2,176 | 1,967 | pass | pass | 3 | 2,279 |
| romantasy-series-planning | 5,691 | 2,269 | 1,990 | pass | pass | 3 | 2,372 |
| drafting-context | 1,653 | 3,296 | 1,238 | pass | pass | 1 | 412 |
| revision-ticket | 966 | 693 | 415 | pass | pass | 1 | 603 |

Token estimates use the repository's stable fallback approximation:

```text
ceil((instructionChars + evidenceChars) / 4)
```

Elapsed time and RSS remain informational only and are excluded from deterministic comparisons.

## Behavior verified

- Missing runtime configuration resolves to compatibility profile `full`.
- Explicit runtime-profile selection overrides project configuration.
- Unknown profile IDs fail deterministically.
- Runtime work limits remain unchanged for chapter count, artifacts, revision tickets, and graph depth.
- Normative rules are never truncated to fit an instruction budget.
- A 40,000-character drafting evidence bundle can be prepared under `full` without being checked against the 24,000-character instruction limit.
- Structured context is complete-record or omitted, never partial JSON or YAML.
- Required overflow stops before inference and names exact IDs, including historical `HIST`, `HC`, `KB`, `INV`, `RES`, and `SRC` records.
- Run reports and benchmark artifacts remain privacy-safe and non-canonical.
- `.pi-book/runs/` and `.pi-book/cache/` remain excluded from Git and package output.

## Authority boundaries

Runtime configuration, reports, and benchmark output do not become canon. Project YAML and Markdown, current stage, project hash, guarded events, schemas, reference checks, transaction atomicity, status/handoff regeneration, human gates, and Git checkpoints remain authoritative.

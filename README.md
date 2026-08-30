# Novel Forge for Pi

Novel Forge is a guarded, series-capable workflow for planning, drafting, reviewing, and packaging thriller, romantasy, and historical-fiction novels. It keeps voice, canon, continuity, research provenance, human approvals, and model spend explicit.

## Install

Install the verified 2.2.1 release from its pinned tag:

```bash
pi install git:github.com/dustinober1/pi-book@v2.2.1
```

Load it for one session without changing persistent Pi settings:

```bash
pi -e git:github.com/dustinober1/pi-book@v2.2.1
```

Pi packages execute with the user's system permissions. Use a copied or backed-up manuscript for the first live pilot.

## Quick start

```text
/novel-start My Novel --profile thriller --type planned-series --target-words 110000
/novel
```

Run `/novel` after each action. It reads durable project state and presents only the next relevant decisions, gates, evidence, or recovery options.

For an existing manuscript, work from a copy and use `/novel-adopt`. The source remains unchanged; Novel Forge creates a managed project with guarded Git checkpoints.

## Genre, runtime, model, and quality are separate

- **Genre profile:** thriller, romantasy, or historical fiction.
- **Runtime profile:** tiny-local, local, or full context budgets.
- **Model execution profile:** per-job token budgets and decoding tuned for the model doing the work.
- **Quality tier:** economy, balanced, premium, or editorial.

Economy preserves the existing single host-prompt drafting path. Higher tiers use isolated Pi print-mode passes for planning, candidate generation, independent critics, revision, and verification. Every accepted creative change still ends in one guarded event with stage/hash checks, allowlists, schemas, references, rollback, status/handoff generation, and a Git checkpoint.

`/novel-start` reads the host model's context window and recommends a runtime profile from it, reporting the choice. Pass `--runtime-profile` or `--model-profile` to decide explicitly; when the window cannot be detected, it asks rather than assuming. All four controls appear in `/novel-status`, `/novel-budget`, and the session handoff.

Use `/novel-budget` to inspect token and call limits, settled usage, active reservations, downgrades, and stops. Quality can be selected in project configuration or with command overrides; Novel Forge never silently increases spend.

## Running on a local model

Novel Forge is built to work on models that are not the largest available. Point the isolated workers at a local model and select the matching execution profile:

```bash
export NOVEL_FORGE_QUALITY_PROVIDER=local
export NOVEL_FORGE_QUALITY_MODEL=google/gemma-3-12b-it-qat-q4_0-gguf
```

```text
/novel-start My Novel --profile thriller --type standalone \
  --runtime-profile local --model-profile gemma-3-12b-it-qat-q4_0
/novel-run --until packaging --max-chapters 40
```

The exact-model profile carries per-job token budgets and constrained decoding, and is verified by fingerprint on the first guarded call — a different model fails loudly rather than running under the wrong budgets. Naming an exact model is what makes that profile selectable at all.

Drafting takes the guarded scene path — bounded context, isolated jobs, deterministic validation, five scene critics, targeted repair, ordered acceptance, one guarded commit per chapter — for every chapter with an executable contract, and says so when it falls back. A run stops at writer gates, blockers, budget limits, and the scene repair limit, not at a chapter counter.

## Safety boundaries

- Human gates are never bypassed.
- Intermediate plans, candidates, critiques, claim maps, and rejected outputs are cache artifacts, not canon.
- Structured context is included by complete record or omitted; required overflow stops before inference and names the missing IDs.
- Telemetry stores hashes, usage, cost, tier, pass, and safe finish categories—not prompts, prose, source excerpts, model outputs, private reasoning, or credentials.
- High-risk research requires bounded evidence anchors.
- Unsupported high-risk proposed claims block; eligible lower-risk findings receive at most one targeted repair followed by re-audit.
- Automated diagnostics and model judges are not human reader evidence and never update `reader-experiments.yaml`.
- Paid cost-versus-quality evaluation is opt-in and never runs in normal CI.

## Focused documentation

- [Quality tiers, budgets, telemetry, and cache](docs/quality-and-cost.md)
- [Grounded research and claim auditing](docs/grounded-accuracy.md)
- [Opt-in quality evaluation](evals/quality/README.md)
- [Novel Forge 2.2.1 release notes](docs/releases/v2.2.1.md)
- [Current release status and qualification](RELEASE.md)

## Verification

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run benchmark:constrained-runtime
npm run benchmark:prompts
npm run verify:release
npm run test:release
npm pack --dry-run
```

The repository's normal CI qualifies Node 22.19.0 and Node 24. It does not run paid evaluation.

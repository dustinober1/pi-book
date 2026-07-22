# Quality Tiers, Token Budgets, and Isolated Drafting

Novel Forge separates three decisions that should not be conflated:

- **Genre profile** controls story obligations and review lanes.
- **Runtime profile** controls context, prompt, graph, chapter, and ticket capacity.
- **Quality tier** controls how many independent model passes are used.

Spending more tokens is therefore not treated as “make the first prompt longer.” Higher tiers spend additional calls on planning, candidate selection, independent criticism, verification, and targeted synthesis.

## Quality tiers

| Tier | Draft behavior |
|---|---|
| `economy` | Existing foreground one-pass draft. This remains the compatibility default. |
| `balanced` | Scene plan, one candidate, combined critic, and an adaptive revision when risk warrants it. |
| `premium` | Scene plan, one candidate for routine chapters or two for key scenes, separate continuity/causality/character-intent/style critics, and synthesis. |
| `editorial` | Premium behavior plus final review and claim audit. |

Risk is deterministic and inspectable. Opening and structural chapters, signature moments, research density, historical risk, setup/payoff/reveal density, state-reference density, and approved learning guardrails determine whether additional passes are justified.

## Configure a new project

```text
/novel-start "My Novel" \
  --profile thriller \
  --type standalone \
  --runtime-profile full \
  --quality-tier premium \
  --max-total-tokens 500000 \
  --max-tokens-per-chapter 20000 \
  --max-calls-per-chapter 10 \
  --on-budget-exhaustion downgrade
```

The canonical `PROJECT.yaml` uses snake_case quality fields. Existing projects without a `quality` block continue to resolve to `economy`.

## Override one draft or run

```text
/novel-draft 7 --quality-tier editorial --max-calls-per-chapter 12
```

```text
/novel-run \
  --until next-milestone \
  --max-chapters 2 \
  --quality-tier premium \
  --max-total-tokens 300000 \
  --max-tokens-per-chapter 18000 \
  --max-calls-per-chapter 10 \
  --on-budget-exhaustion stop
```

Persistent higher-quality runs snapshot the resolved quality policy. They reload project and budget state after every guarded chapter, pause at the requested chapter limit, and stop immediately when a human gate or stage boundary opens.

## Inspect the budget

```text
/novel-budget
```

The budget view distinguishes:

- configured total, per-chapter, and call ceilings;
- settled token usage;
- live reserved tokens and calls;
- remaining known capacity;
- recorded downgrade and stop events;
- cost reported by providers when available.

Unknown provider usage is never invented. Character- or context-based fallback estimates are marked as estimates.

## Stop and downgrade behavior

Every isolated model call reserves a conservative minimum before inference. The reservation includes estimated input plus a pass-appropriate output reserve.

After the call:

1. actual provider usage replaces the reservation when available;
2. estimated usage remains explicitly marked when actual usage is incomplete;
3. interrupted calls release their reservation;
4. a hard process crash leaves capacity reserved rather than risking overspend;
5. missing budget-ledger state can be reconstructed from valid schema-2 run reports.

With `on_exhaustion: stop`, the next call is blocked before inference.

With `on_exhaustion: downgrade`, the tier moves one step lower:

```text
editorial → premium → balanced → economy
```

A downgrade never applies a partial manuscript event. Higher-quality command flows restart from canonical state at the lower tier. Economy has no lower tier, so exhausted economy capacity stops before the host prompt is sent.

## Isolated Pi workers

Balanced, premium, and editorial drafting run each pass in a separate Pi print-mode process. Novel Forge disables ambient capabilities for these workers:

```text
-p --mode json --no-session --no-tools --no-context-files
--no-extensions --no-skills --no-prompt-templates --no-themes --no-approve
```

Prompts and manuscript context are piped through standard input. They are not placed in process arguments. Critics receive only the selected candidate and their lane-specific evidence; they cannot see other critic conclusions. Only synthesis receives all critique artifacts.

Executable resolution order:

1. an injected worker command used by tests or embedding applications;
2. `NOVEL_FORGE_PI_COMMAND`;
3. `pi` on `PATH`.

Optional model routing:

```text
NOVEL_FORGE_QUALITY_PROVIDER=openai
NOVEL_FORGE_QUALITY_MODEL=your-model-id
```

When a model is selected, Novel Forge reads Pi’s model catalog and feeds the exact context-window capacity into budget resolution. If metadata is unavailable, the configured runtime profile remains authoritative and the run records an advisory.

## Canonical mutation boundary

Planning, candidates, selection, criticism, and synthesis are ephemeral. No canonical manuscript file changes during those passes.

The final result must be one exact JSON object with chapter-bound, allowlisted paths. Novel Forge then:

1. reloads current project state;
2. rechecks stage and project hash;
3. calls the existing guarded `draft-chapter` event exactly once;
4. lets existing schema, reference, continuity, rollback, Git-checkpoint, and human-gate rules remain authoritative.

Two invalid structured-output attempts stop the run with no canonical mutation.

## Local privacy and retention

Privacy-safe reports are stored under:

```text
.pi-book/runs/
```

They may contain provider/model identifiers, token counts, optional cost, elapsed time, safe finish categories, and SHA-256 hashes. They do not store prompts, manuscript context, model prose, private reasoning, credentials, or raw excerpts.

Ephemeral quality artifacts are stored under:

```text
.pi-book/cache/generation/<run-id>/chapter-<NN>/
```

The default is `delete-on-success`. Failed or interrupted runs retain their cache for diagnosis. Both paths are ignored by Git and excluded from the package.

Foreground economy drafts use Pi lifecycle events when available. They reserve budget before the host prompt, hash transient prompt and output content, settle actual usage at `turn_end`, and continue to respect telemetry opt-out while preserving the enforcement ledger.

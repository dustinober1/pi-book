# Opt-in quality-versus-cost evaluation

This directory contains frozen, reviewable fixtures for comparing Novel Forge quality tiers with the same packet, bounded context, project hash, provider, and model.

## Safety boundary

Paid execution is never part of normal CI or `npm run eval`. It runs only through:

```bash
NOVEL_FORGE_RUN_PAID_EVAL=1 \
NOVEL_FORGE_QUALITY_EVAL_PROVIDER=<provider> \
NOVEL_FORGE_QUALITY_EVAL_MODEL=<model> \
NOVEL_FORGE_QUALITY_EVAL_TIERS=economy,premium,editorial \
NOVEL_FORGE_QUALITY_EVAL_SEED=<predeclared-seed> \
npm run eval:quality
```

The command refuses to run when the fixture tree is dirty. It uses the installed Pi authentication and isolated print-mode worker; it does not add a provider SDK.

## Outputs

Outputs default to `.pi-book/evals/quality/<seed-hash>/` and are operational, not canonical:

- `human-review-kit.md` — randomized samples identified only by opaque IDs;
- `human-answer-sheet.csv` — pairwise review form;
- `sealed-labels.json` — tier/model mapping kept separate until review import;
- `automated-diagnostic-report.json` — cost, token, and severe-failure diagnostics without raw prompts or source context.

Automated diagnostics are not human reader evidence and must never update `reader-experiments.yaml`. No tier may be described as better without the predeclared human-comparison minimum.

## Fixtures

- `thriller-key-scene.yaml` — reveal-order, custody, injury, and timing pressure;
- `romantasy-key-scene.yaml` — explicit consent, bond limits, and intimate stakes;
- `historical-high-risk-scene.yaml` — chronology, material culture, knowledge boundaries, and declared invention handling.

Edit fixtures only in a dedicated commit. The paid runner requires the fixture tree to be clean so results always refer to committed frozen inputs.

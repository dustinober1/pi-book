# Opt-in quality evaluation

This directory contains frozen, synthetic fixtures for comparing Novel Forge quality tiers against model spend.

Paid execution is never part of normal CI. Run it only with an explicit provider, model, tier list, seed, and:

```bash
NOVEL_FORGE_RUN_PAID_EVAL=1 npm run eval:quality -- \
  --fixture evals/quality/fixtures/thriller-key-scene.yaml \
  --provider <provider> --model <model> \
  --tiers economy,balanced,premium,editorial --seed study-001
```

The harness requires a clean Git tree. It uses the same frozen fixture hashes and model for every tier, randomizes opaque sample IDs deterministically, and writes results under `evals/quality/runs/`, which is ignored by Git.

Machine reports contain hashes, usage, cost, diagnostic scores, and severe-failure categories. They do not contain prompts, prose, source excerpts, private reasoning, or credentials. The human review kit contains the generated samples but no tier, model, or provider labels. The separate label seal must remain unopened until human scoring is complete.

Automated diagnostics are not reader evidence. A tier is not declared superior unless the predeclared minimum human review count is met.

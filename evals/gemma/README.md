# Gemma individual-job qualification

This directory defines the non-canonical, opt-in qualification harness for the exact
`google/gemma-3-12b-it-qat-q4_0-gguf` execution target. It evaluates individual model
jobs only. It does not qualify a book or change production prose behavior.

Real inference is disabled unless `NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1` is set and
the command receives an exact provider, model, fingerprint JSON path, and nonblank seed:

```sh
NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1 npm run eval:gemma -- \
  --provider local \
  --model google/gemma-3-12b-it-qat-q4_0-gguf \
  --fingerprint /path/to/fingerprint.json \
  --seed qualification-01
```

Runs are exclusively reserved and published as one atomic artifact set beneath the
ignored `evals/gemma/runs/` directory. The machine report contains only aggregate
rates, counts, the exact fingerprint, cryptographic provenance hashes, and a verified
report hash. Provenance binds the frozen fixture bytes, rubric bytes and version, seed,
and evaluator revision without copying those private inputs into the report.

Generated prose is written only to the blinded review kit beside anonymized governing
constraints needed to score fidelity and contradictions. The separate label seal maps
opaque sample IDs to case and job labels and should not be given to reviewers until
their reviews are complete. None of these artifacts is canonical story authority.

Structured outputs are checked against the real schema for their fixture job. Record
use, stop/escalation behavior, contradictions, and severe failures are derived by the
trusted evaluator rather than accepted from model self-ratings.

The command exits nonzero if configuration is incomplete, inference fails, or any
promotion gate fails. Ordinary tests and CI use a scripted worker and never run a model.

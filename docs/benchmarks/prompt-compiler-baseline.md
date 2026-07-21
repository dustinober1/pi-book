# Compact Prompt Compiler Baseline

Date: 2026-07-16  
Branch head evaluated: `a0072f80b74b1e7df57ec34cf972a032ad7a8786`  
GitHub Actions run: `29549086948`  
Profiles compared: `full` standard rendering versus `local` compact rendering

## Acceptance rule

A representative stage passes when compact rendering reduces **normative instruction characters** by at least 30%, or when the compact result is already below 2,000 characters. Every compact result must also fit the `local` profile's 10,000-character instruction budget.

Drafting evidence and bounded project context are not part of this compiler comparison. They are prepared separately and checked against the profile's evidence budget. As of the 2026-07-21 budget-correctness work, `maxPromptChars` is a compatibility alias for `modelBudget.maxInstructionChars`; it is not a complete model-request limit.

## Results

| Stage | Standard instruction characters | Compact instruction characters | Reduction | Local instruction budget |
|---|---:|---:|---:|---|
| Book planning | 9,262 | 6,110 | 34.03% | Pass |
| Manuscript review | 5,960 | 3,700 | 37.92% | Pass |
| Voice planning | 6,669 | 4,510 | 32.37% | Pass |
| Premise comparison | 3,294 | 2,091 | 36.52% | Pass |

All four representative stages passed the reduction threshold and local instruction budget.

## Verification context

The same exact branch head passed on Node 22.19.0 and Node 24:

- TypeScript check
- 386 tests, 386 passed, 0 failed
- fixture evaluation
- constrained-runtime benchmark
- prompt compiler benchmark
- Novel Forge 1.4 release verification
- package dry-run

The benchmark is deterministic and emits parseable JSON through `npm run --silent benchmark:prompts`. It records only stage identifiers, instruction limits, and aggregate character counts; no author prompt, prose, private evidence, or source content is emitted.

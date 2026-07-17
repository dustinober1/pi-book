# Constrained Runtime Foundation Baseline

Date: 2026-07-16

## Repository state

- Repository: `dustinober1/pi-book`
- Default branch: `main`
- Verified starting HEAD: `14f2e1421121ed4947232463a5d0399da598d480`
- Measurement branch: `feat/constrained-runtime-foundation`
- Final implementation head before this evidence update: `04574aedde02681baf0079a76d180d7c4be80731`
- Pull request: #29, `Add constrained runtime profiles and baseline telemetry`
- Package: `novel-forge-for-pi` 1.3.0
- Supported CI runtimes: Node 22.19.0 and Node 24

The constrained-runtime foundation does not rewrite stage prompts. These measurements therefore establish the current standard-prompt and full-context baseline for the compact prompt and adaptive-context phases.

## Verification commands

The exact repository gates ran on both supported Node versions in GitHub Actions workflow run `29546426561`:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm run --silent benchmark:constrained-runtime
npm run verify:release
npm pack --dry-run
```

Results on Node 22.19.0 and Node 24:

- Dependency installation: pass
- TypeScript check: pass
- Test suite: pass
- Architecture evaluation suite: pass
- Constrained runtime benchmark: pass
- Release verification: pass
- Package dry run: pass
- Retained benchmark artifact: valid JSON, schema 1.0.0, six scenarios

Node 24 test summary:

```text
tests 371
pass 371
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 48127.135898
```

The test duration is informational and is not a CI threshold.

## Full-profile benchmark

All inputs are checked-in synthetic fixtures. The harness emits only counts, validation state, timings, and memory measurements. It does not emit fixture prose, raw prompts, or model outputs.

| Scenario | Prompt chars | Context chars | Estimated input tokens | Stage | Validation | Files changed | Bytes changed | Elapsed ms | RSS bytes |
|---|---:|---:|---:|---|---|---:|---:|---:|---:|
| thriller-standalone-planning | 5,636 | 1,904 | 1,885 | pass | pass | 3 | 1,990 | 93.793 | 97,878,016 |
| thriller-series-planning | 5,636 | 1,964 | 1,900 | pass | pass | 3 | 2,052 | 56.331 | 99,885,056 |
| romantasy-standalone-planning | 5,691 | 2,176 | 1,967 | pass | pass | 3 | 2,279 | 56.379 | 100,802,560 |
| romantasy-series-planning | 5,691 | 2,269 | 1,990 | pass | pass | 3 | 2,372 | 54.738 | 99,635,200 |
| drafting-context | 1,653 | 3,296 | 1,238 | pass | pass | 1 | 412 | 66.090 | 102,420,480 |
| revision-ticket | 966 | 693 | 415 | pass | pass | 1 | 603 | 54.316 | 102,543,360 |

Token estimates use the repository's stable approximation:

```text
ceil((promptChars + contextChars) / 4)
```

Elapsed time and RSS are informational only. Deterministic benchmark comparisons exclude both fields.

## Foundation behavior verified

- Missing runtime configuration resolves to compatibility profile `full`.
- Explicit runtime profile overrides stored project configuration.
- Unknown runtime profile IDs fail deterministically in project configuration, command options, and active-run records.
- `tiny-local` normalizes to one chapter, one revision ticket, one stage artifact, graph depth one, and a 12,000-character drafting-context budget.
- `local` normalizes to one chapter, two revision tickets, two stage artifacts, graph depth two, and a 24,000-character drafting-context budget.
- `full` preserves current chapter automation behavior, the existing three-ticket revision default, graph depth two, and the current 72,000-character drafting-context limit.
- New projects explicitly store `runtime.profile: full`; projects created before runtime profiles remain readable without migration.
- Persistent runs store the resolved profile and normalized chapter budget.
- Legacy active runs without a stored profile resume with compatibility `full`, even when a later project default differs.
- Status and run decisions display the runtime profile separately from the genre profile.
- Starting a persistent run writes a privacy-safe report only after the guarded project transaction succeeds.
- Run reports use the locked 1.0.0 schema, atomic writes, and ignored `.pi-book/runs/` storage.
- Project telemetry opt-out prevents report creation.
- Run-report write failure does not cancel or roll back the authoring run and returns only a generic diagnostic.
- Privacy tests prove sentinel prompt, prose, output, and credential strings are absent.
- `.pi-book/runs/` and `.pi-book/cache/` are excluded from Git and package output.
- The benchmark command is executed by CI, retained with diagnostics, and parsed as JSON in a regression test.

## TDD evidence

Each meaningful foundation behavior was introduced through an observed failing workflow followed by a green workflow:

| Behavior | Red workflow | Expected failure | Green workflow |
|---|---:|---|---:|
| Runtime profile contracts | 29542929063 | Missing runtime profile and resolver modules | 29542999895 |
| Project compatibility | 29543124452 | Missing optional runtime project state | 29543495475 |
| Command parsing | 29543611841 | `--runtime-profile` ignored | 29543754868 |
| Execution limits and visibility | 29544059866 | Missing decision, run, and context profile boundaries | 29544674734 |
| Start/run command wiring | 29544782602 | Profile value entered project name; run used `full` | 29544934107 |
| Run telemetry contracts | 29545030776 | Missing report schema, builder, and store | 29545110394 |
| Benchmark matrix | 29545246798 | Missing constrained evaluator | 29545356721 |
| Parseable retained benchmark artifact | 29545764064 | Non-silent npm banner made the `.json` artifact invalid | 29545841970 |
| Active-run validation and compatibility | 29545963458 | Invalid run profile accepted; legacy run inherited a newer default | 29546147728 |
| Persistent-run telemetry integration | 29546239357 | Run report absent; storage failure not surfaced | 29546426561 |

Intermediate failures caused by strict TypeScript typing or incomplete synthetic fixtures were repaired without weakening production schemas, research provenance, remarkability, graph safety, or validation gates.

## Privacy and authority boundaries

- Telemetry fields contain profile/backend identifiers, counts, hashes, validation categories, and measurements only.
- Raw prompts, manuscript prose, model output, private research notes, and credentials are not report fields.
- Benchmark reports contain measurements only.
- Runtime configuration, reports, and benchmark output do not become canon.
- Project YAML/Markdown, current stage, project hash, guarded events, schemas, reference checks, transaction atomicity, status/handoff regeneration, human gates, and Git checkpoint behavior remain authoritative.

## Known overlap review

Draft PR #27 qualifies a Novel Forge 1.4 release and changes only its own plan, release verifier, and release tests. It does not modify runtime profiles, project runtime schema, run behavior, context building, telemetry, benchmark implementation, package configuration, or CI workflow in this pull request. Its base predates this branch, so release qualification must be refreshed after the runtime foundation lands.

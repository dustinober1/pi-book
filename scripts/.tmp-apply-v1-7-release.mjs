import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function write(path, value) { writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`, "utf8"); }
function appendOnce(path, marker, block) {
  const current = read(path);
  if (!current.includes(marker)) write(path, `${current.trimEnd()}\n\n${block.trim()}\n`);
}

const pkg = JSON.parse(read("package.json"));
pkg.version = "1.7.0";
pkg.scripts["eval:quality"] = "node --import tsx scripts/evaluate-quality.ts";
pkg.scripts["verify:release"] = "node --import tsx scripts/verify-v1-7-release.ts";
pkg.scripts["test:release"] = "node --import tsx --test tests/v1-7-release-checklist.test.ts tests/v1-6-2-release-checklist.test.ts tests/v1-6-1-release-checklist.test.ts tests/v1-5-release-checklist.test.ts tests/e2e/v1-5-release-journey.test.ts tests/package-smoke.test.ts tests/e2e/packed-clean-start.test.ts";
for (const item of ["docs/quality-and-cost.md", "docs/grounded-accuracy.md", "docs/releases/v1.7.0.md", "evals/quality/"]) {
  if (!pkg.files.includes(item)) pkg.files.push(item);
}
write("package.json", JSON.stringify(pkg, null, 2));

const lock = JSON.parse(read("package-lock.json"));
lock.version = "1.7.0";
if (lock.packages?.[""]) lock.packages[""].version = "1.7.0";
write("package-lock.json", JSON.stringify(lock, null, 2));

write("src/application/version-core.ts", read("src/application/version-core.ts").replace('NOVEL_FORGE_VERSION = "1.6.2"', 'NOVEL_FORGE_VERSION = "1.7.0"'));
appendOnce(".gitignore", ".pi-book/evals/", ".pi-book/evals/");

let testWorkflow = read(".github/workflows/test.yml");
if (!testWorkflow.includes("npm run test:release")) {
  testWorkflow = testWorkflow.replace("      - run: npm run verify:release\n      - run: npm pack --dry-run", "      - run: npm run verify:release\n      - run: npm run test:release\n      - run: npm pack --dry-run");
}
write(".github/workflows/test.yml", testWorkflow);

write("README.md", `# Novel Forge for Pi

Novel Forge is a guided, series-capable production workflow for **thriller**, **romantasy**, and **historical fiction** novels. It protects author-specific voice, canon, causality, consent, research provenance, human gates, and packaging state through typed project files and guarded Git transactions.

## Install

Install the verified 1.7.0 release from its immutable tag:

\`\`\`bash
pi install git:github.com/dustinober1/pi-book@v1.7.0
\`\`\`

Load it for one session without changing persistent Pi settings:

\`\`\`bash
pi -e git:github.com/dustinober1/pi-book@v1.7.0
\`\`\`

Pi packages run with the user's system permissions. Review the source and use a copied or backed-up manuscript for a first live pilot.

## Quick start

\`\`\`text
/novel-start "My Novel" --profile thriller --type planned-series --target-words 110000
/novel
\`\`\`

For historical fiction:

\`\`\`text
/novel-start "A Republic of Smoke" --profile historical-fiction --type standalone --target-words 100000
/novel
\`\`\`

Run \`/novel\` after each completed action. It reads the active project state and presents only the decisions that matter at the current stage or human gate.

## Profiles and quality

- **Genre profile** — thriller, romantasy, or historical-fiction story obligations and review lanes.
- **Runtime profile** — prompt, context, graph, chapter, and ticket capacity.
- **Quality tier** — economy, balanced, premium, or editorial model-pass policy.

Existing projects without quality configuration remain compatible and resolve to \`economy\`. Higher tiers are opt-in, budgeted, and use isolated Pi print-mode workers. Inspect limits and usage with \`/novel-budget\`.

## Safety and authority

- Draft only from a ready, profile-valid chapter packet.
- Never bypass writer approval gates.
- Reserve token and call capacity before inference.
- Keep plans, candidates, critiques, audits, and evaluation artifacts non-canonical.
- End every accepted creative change in one existing guarded event with stage/hash checks, allowlists, validation, rollback, status/handoff regeneration, and a Git checkpoint.
- Automated diagnostics are not human reader evidence and never update \`reader-experiments.yaml\`.
- Paid quality evaluation is opt-in and never runs in normal CI.

## Focused guidance

- [Quality tiers, budgets, isolated workers, and blinded evaluation](docs/quality-and-cost.md)
- [Evidence anchors and grounded claim auditing](docs/grounded-accuracy.md)
- [Opt-in quality evaluation fixtures and review kit](evals/quality/README.md)
- [Release qualification and pilot boundaries](RELEASE.md)

## Verify the tree

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run eval
npm run benchmark:constrained-runtime
npm run benchmark:prompts
npm run verify:release
npm run test:release
npm pack --dry-run
\`\`\`

The GitHub Actions matrix verifies Node 22.19.0 and Node 24 on the exact release candidate commit. The paid \`npm run eval:quality\` command requires explicit environment configuration and is intentionally absent from normal and release CI.
`);

appendOnce("SKILL.md", "## Quality, budget, and grounded drafting", `## Quality, budget, and grounded drafting

- Existing projects without a quality block remain compatible and resolve to \`economy\`; never increase spend silently.
- Balanced, premium, and editorial passes run in isolated Pi print-mode processes with ambient tools, sessions, context files, extensions, skills, and prompt templates disabled.
- Reserve the minimum input/output token and call capacity before inference. Stop or downgrade deterministically when the configured budget cannot reserve the next call.
- Treat \`.pi-book/cache/\`, run reports, claim maps, candidates, critiques, and evaluation kits as non-canonical cache or operational evidence. They never establish canon or writer approval.
- Evidence anchors may ground claims, but a model opinion alone cannot manufacture support. Unsupported high-risk claims stop before canonical mutation; permitted factual repair is targeted and re-audited once.
- The final guarded event remains the sole authority for manuscript and control-file mutation. Reload stage and project hash immediately before that one event; never apply partial candidates or critic output directly.
- Automated diagnostics and quality-tier comparisons are not human reader evidence. Paid evaluation requires explicit opt-in and never runs in normal CI.`);

const changelog = read("CHANGELOG.md");
if (!changelog.includes("## 1.7.0 — Quality Budgets and Grounded Orchestration")) {
  const entry = `## 1.7.0 — Quality Budgets and Grounded Orchestration

### Added

- Separate instruction, evidence, output-reserve, and safety-margin budgets with complete-record context allocation and exact overflow diagnostics.
- Economy, balanced, premium, and editorial quality tiers with explicit token/call ceilings, deterministic stop or downgrade behavior, and privacy-safe usage telemetry.
- Isolated Pi print-mode workers, risk-adaptive planning, candidates, independent critics, targeted synthesis, persistent premium runs, and one final guarded manuscript event.
- Bounded evidence anchors, high-risk research readiness rules, line-hashed claim extraction, deterministic provenance resolution, targeted factual repair, and mandatory re-audit.
- An opt-in blinded cost-versus-quality evaluation harness with frozen fixtures, opaque sample IDs, diagnostic severe-failure lanes, human review kits, and cost-per-additional-win reporting.

### Compatibility and boundaries

- Existing projects without quality state continue as economy.
- Intermediate quality and evaluation artifacts remain non-canonical and excluded from packages.
- Automated diagnostics remain separate from human reader evidence, and paid evaluation never runs in normal CI.
`;
  write("CHANGELOG.md", changelog.replace("# Changelog\n", `# Changelog\n\n${entry}\n`));
}

write("RELEASE.md", `# Novel Forge Release Status and Checklist

## Current verified release: v1.7.0

Novel Forge 1.7.0 is the pinned release for installation and supervised live-book pilots.

\`\`\`bash
pi install git:github.com/dustinober1/pi-book@v1.7.0
\`\`\`

For one session:

\`\`\`bash
pi -e git:github.com/dustinober1/pi-book@v1.7.0
\`\`\`

Use a copied or backed-up manuscript for the first pilot. Install the immutable tag rather than an unpinned branch.

## 1.7.0 release record

- [x] Instruction and evidence budgets are independent and complete-record context overflow stops before inference.
- [x] Existing projects without quality state remain economy-compatible.
- [x] Higher tiers use isolated workers and one final guarded event.
- [x] Token/call capacity is reserved before each call and settled afterward.
- [x] Telemetry and caches contain no raw prompts, manuscript context, output prose, source excerpts, credentials, or private reasoning.
- [x] High-risk research uses bounded evidence anchors and proposed claims are deterministically checked.
- [x] Paid cost-versus-quality evaluation is explicit, blinded, and excluded from normal CI.
- [x] Node 22.19.0 and Node 24 run the full release sequence.

The maintained release notes are in \`docs/releases/v1.7.0.md\`. Earlier release notes and tags remain immutable.

## Verify the exact candidate

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run eval
npm run benchmark:constrained-runtime
npm run benchmark:prompts
npm run verify:release
npm run test:release
npm pack --dry-run
\`\`\`

The repository's **Novel Forge tests** and **Release Novel Forge v1.7.0** workflows are authoritative for Node 22.19.0 and Node 24. Neither workflow runs paid evaluation.

## Evidence boundaries

A green release proves deterministic contracts, package boundaries, compatibility, and guarded workflow behavior. It does not prove literary superiority, publication success, historical completeness, expert or sensitivity review, or real-reader validation. Automated diagnostics remain diagnostic. Quality-tier superiority requires the predeclared minimum of blinded human comparisons.

Review production dependency advisories before broad use with untrusted inputs. Do not force breaking dependency upgrades without packaging and export regression tests.
`);

appendOnce("docs/quality-and-cost.md", "## Blinded cost-versus-quality evaluation", `## Blinded cost-versus-quality evaluation

Paid evaluation is optional and never runs in normal or release CI. It requires an explicit provider, model, tier list, seed, and opt-in flag:

\`\`\`bash
NOVEL_FORGE_RUN_PAID_EVAL=1 \\
NOVEL_FORGE_QUALITY_EVAL_PROVIDER=<provider> \\
NOVEL_FORGE_QUALITY_EVAL_MODEL=<model> \\
NOVEL_FORGE_QUALITY_EVAL_TIERS=economy,premium,editorial \\
NOVEL_FORGE_QUALITY_EVAL_SEED=<seed> \\
npm run eval:quality
\`\`\`

The runner refuses a dirty fixture tree. Every tier receives the same frozen packet, context, project hash, provider, and model. Reviewer materials use opaque seeded sample IDs and omit tier and model labels. Automated diagnostics score canon, consent, reveal order, causality, factual grounding, and voice, but remain separate from human reader evidence.

Outputs live under \`.pi-book/evals/quality/<seed-hash>/\` by default. Inspect \`human-review-kit.md\` and \`human-answer-sheet.csv\`; keep \`sealed-labels.json\` closed until responses are complete. Remove an evaluation with \`rm -rf .pi-book/evals/quality/<seed-hash>\`. These files, like \`.pi-book/cache/\`, are operational and non-canonical.

Reports include pairwise win rate, severe-failure rate, median tokens and cost, and cost per additional win over economy. They never declare a tier superior until the predeclared human-comparison minimum is met. The canonical controls remain \`maximum_calls_per_chapter\`, token ceilings, and \`on_exhaustion\`; claim audit and targeted repair remain subject to the same pre-call budget reservation.`);

mkdirSync("docs/releases", { recursive: true });
write("docs/releases/v1.7.0.md", `# Novel Forge v1.7.0 — Quality Budgets and Grounded Orchestration

Novel Forge 1.7.0 adds opt-in quality orchestration while preserving economy compatibility and the existing guarded workflow authority.

## Highlights

- Separate instruction and evidence budgets with output reserves, safety margins, and complete-record allocation.
- Balanced, premium, and editorial tiers using isolated Pi print-mode workers rather than direct provider SDKs.
- Pre-call token and call reservations, actual-or-estimated settlement, deterministic stop/downgrade behavior, and privacy-safe telemetry.
- Risk-adaptive scene plans, key-scene candidates, independent critics, targeted synthesis, persistent pause/resume, and one final guarded event.
- Bounded evidence anchors and grounded claim auditing with line hashes, exact research/invention references, high-risk blocking, one targeted repair, and re-audit.
- Blinded, seeded, opt-in cost-versus-quality evaluation with frozen thriller, romantasy, and historical fixtures, automated severe-failure diagnostics, and human review kits.

## Safety boundaries

Intermediate plans, candidates, critiques, claim maps, rejected outputs, and evaluation artifacts remain non-canonical. Telemetry stores usage and hashes, not raw prompts, prose, source excerpts, credentials, or private reasoning. Automated diagnostics are not human reader evidence. Paid evaluation requires \`NOVEL_FORGE_RUN_PAID_EVAL=1\` and never runs in normal or release CI.

## Verification

The release workflow runs TypeScript, the complete test suite, deterministic evaluations, constrained-runtime and prompt benchmarks, the v1.7 release verifier and checklist, and \`npm pack --dry-run\` on Node 22.19.0 and Node 24 before creating tag \`v1.7.0\`.
`);

write(".github/workflows/release-v1-7.yml", `name: Release Novel Forge v1.7.0

on:
  push:
    branches: [main]
    paths:
      - package.json
      - package-lock.json
      - src/application/version-core.ts
      - docs/releases/v1.7.0.md
      - scripts/verify-v1-7-release.ts
      - .github/workflows/release-v1-7.yml
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ['22.19.0', '24']
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.sha }}
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: npm
      - run: test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
      - run: test "$(node -p "require('./package.json').version")" = "1.7.0"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run eval
      - run: npm run --silent benchmark:constrained-runtime
      - run: npm run --silent benchmark:prompts
      - run: npm run verify:release
      - run: npm run test:release
      - run: npm pack --dry-run

  release:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.sha }}
          fetch-depth: 0
      - run: test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
      - id: tag
        shell: bash
        run: |
          if git ls-remote --exit-code --tags origin refs/tags/v1.7.0 >/dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.tag.outputs.exists == 'false'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git tag -a v1.7.0 "$GITHUB_SHA" -m "Novel Forge v1.7.0"
          git push origin refs/tags/v1.7.0
      - if: steps.tag.outputs.exists == 'false'
        env:
          GH_TOKEN: \${{ github.token }}
        run: gh release create v1.7.0 --verify-tag --title "Novel Forge v1.7.0" --notes-file docs/releases/v1.7.0.md
      - if: steps.tag.outputs.exists == 'true'
        run: echo "v1.7.0 already exists; no duplicate release was created."
`);

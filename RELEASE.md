# Novel Forge Release Checklist

## Version 1.4.0 — Author Velocity baseline entry gate

The first 1.4 pull request changes evaluation only. It must not change production workflow behavior or package version.

- [ ] Four journey fixtures load and pass with at least one explicit current limitation each.
- [ ] Four author questions report exactly four.
- [ ] Duplicate accepted `draft-chapter` events do not inflate completed chapters.
- [ ] Pause and resume under one run ID preserve all counters.
- [ ] Rejected attempts and permitted retries are counted independently.
- [ ] Human gates and requested targets remain explicit stop reasons.
- [ ] `contextCharacters` records the maximum observed size.
- [ ] Architecture and Novel Forge 1.3 release fixtures remain unchanged and passing.
- [ ] Package version and dependency metadata remain unchanged.
- [ ] Invalid YAML returns `schema-validation`, the exact relative path, and one-retry eligibility.
- [ ] Missing canon or research references return `reference-validation`.
- [ ] Stale stage/hash rejections require reload and are not retryable.
- [ ] Disallowed paths and human gates never permit automatic retry.
- [ ] Wizard and Pi-tool failures expose the same structured detail.
- [ ] Unknown failures contain no stack trace, absolute project path, or raw thrown object.


## Version 1.3.0

Do not create the `v1.3.0` tag after the foundation PR alone. Create it only after all planned 1.3 phases are merged and the final `main` commit passes the complete Node 22.19.0 and Node 24 verification matrix through the repository's `Novel Forge tests` GitHub Actions workflow.

### Version and compatibility

- [ ] `package.json` reports `1.3.0`.
- [ ] `package-lock.json` reports `1.3.0` in the root package metadata without dependency re-resolution.
- [ ] New projects write `novel_forge_version: 1.3.0`.
- [ ] New projects contain the series-level taste, voice-guardrail, and voice-experiment index files.
- [ ] New books contain research-ledger, book-strategy, and voice-audit files in addition to the retained 1.2 publishing, marketing, and reader-kit files.
- [ ] Version 1.2 projects remain readable without mandatory migration.
- [ ] Missing 1.3 evidence produces one optional-backfill warning rather than a blocker.
- [ ] Metadata-only upgrades do not invent evidence or hide missing-evidence warnings.
- [ ] Projects written by a newer package version are blocked safely.

### Evidence-contract acceptance

- [ ] Every new 1.3 YAML artifact is validated by the guarded transaction layer.
- [ ] Planned and researching claims may remain incomplete.
- [ ] Ready claims require source provenance, verification, knowledge scope, risk, and at least one dramatic use.
- [ ] Planned voice experiments may exist before variants or a baseline are produced.
- [ ] Accepted voice experiments require exact anonymous variants A, B, and C plus a non-null baseline record.
- [ ] Voice approval hashes the voice profile, taste profile, voice guardrails, and experiment index.
- [ ] Book-plan approval hashes the book architecture, remarkability contract, research ledger, and book strategy.

### Research-update safety

- [ ] `research-update` is available only during the approved active creative stages.
- [ ] It accepts only allowlisted taste, voice, research, strategy, audit, and source-register evidence.
- [ ] It rejects empty, stale, duplicate, unsafe, manuscript, project-state, book-state, guidance, reader-evidence, publishing, marketing, and package-output submissions.
- [ ] It does not advance stage, change gates or approvals, alter active-book status, or write manuscript prose.
- [ ] Accepted updates still use schema validation, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.
- [ ] The public `novel_apply_event` tool remains UTF-8 text-only.

### Influence and originality acceptance

- [ ] Every influence records a specific role, admired qualities, excluded qualities, and neutral derived traits.
- [ ] Writer decisions, writer samples, and an accepted baseline outrank external references.
- [ ] Named-author imitation instructions are rejected from voice profiles, guardrails, experiment assets, and chapter context.
- [ ] Anonymous A/B/C variants and the accepted baseline each contain 600–900 words.
- [ ] Stored source, variant, and baseline hashes match normalized content exactly.
- [ ] Score summaries are deterministic evidence and never select prose automatically.
- [ ] Drafting context includes only validated neutral guardrails and a matching POV signature.
- [ ] Raw influence references and voice-experiment prose never enter chapter drafting context.

### Public-review and research acceptance

- [ ] Public-review observations are paraphrase-first and exclude reviewer identity by default.
- [ ] One- and two-star, three-star, and four- or five-star evidence remain distinct signals.
- [ ] One-star-only clusters can never exceed moderate confidence.
- [ ] Negative clusters retain positive counterweights and explicit writer decisions.
- [ ] Public market evidence cannot update reader-experiment metrics or manuscript-validation claims.
- [ ] Ready chapter packets cannot reference missing or unready research.
- [ ] Research claims expose source provenance and dramatic use in bounded context.

### Book strategy and audit acceptance

- [ ] Book strategy includes the reader promise, expectation decisions, friction decisions, accepted tradeoffs, originality risks, and approved guardrails.
- [ ] Plot decisions track immediate gain, deferred cost, irreversible effect, and payoff window.
- [ ] Voice-drift metrics are evidence rather than mechanical prose quotas.
- [ ] Repeated scene engines and state-neutral repeated conversations are flagged.
- [ ] Recurring revision problems become guardrail candidates only at the exact threshold.
- [ ] Guardrail promotion requires writer approval and does not retroactively rewrite unrelated prose.
- [ ] Chapter 1 and Chapter 3 create voice-audit evidence only when accepted baseline hash and metrics exist.
- [ ] Missing baseline evidence skips voice auditing without blocking drafting.
- [ ] Act and manuscript reviews append deterministic voice evidence without assigning automatic ticket severity.
- [ ] Intentional voice exceptions remain recorded and protected.
- [ ] Three distinct chapters or two distinct milestone reviews are the exact learning thresholds.
- [ ] Duplicate tickets within one chapter count as one chapter occurrence.
- [ ] Proposed and rejected learning rules never enter drafting context.
- [ ] Approved learning rules match the exact ticket, chapter, and milestone evidence.
- [ ] Audit and promotion paths do not modify existing manuscript files.

### Wizard and transaction safety

- [ ] The wizard binds only to `127.0.0.1` on an ephemeral port.
- [ ] Every API request requires the session credential and exact origin.
- [ ] Sessions expire and delete their upload directories.
- [ ] The browser has no direct filesystem-write or arbitrary-command route.
- [ ] Confirmed actions enforce expected stage and project hash.
- [ ] Binary files preserve exact bytes and participate in transaction rollback.
- [ ] The research wizard exposes sanitized snapshots, previews, and typed proposals only.
- [ ] `/novel-wizard research` opens Influence Palette, Anonymous Voice Comparison, Reader Friction, Research Ledger, and Revision Learning surfaces.
- [ ] Initial research snapshots exclude manuscript prose, reader-response bodies, reviewer identity, source-scene prose, and variant prose.
- [ ] Every research mutation requires a stored preview ID plus current stage and project hash.
- [ ] Confirmed research actions return through `research-update` and leave stage, gates, approvals, and manuscript prose unchanged.
- [ ] Public-review imports remain identity-stripped market evidence and never update manuscript reader metrics.
- [ ] Voice variants are shown only as A/B/C; scores do not choose the baseline automatically.
- [ ] Ready research claims require valid registered source support.
- [ ] Learning eligibility never activates a rule without explicit writer approval.
- [ ] Existing adoption, readers, packaging, and next-book wizard workflows remain passing.

### Existing 1.2 capability regression

- [ ] DOCX, EPUB, Markdown, text, and chapter-directory adoption remains safe and atomic.
- [ ] Reader kits remain isolated under `reader-kits/RE-NNN/`, with accepted human responses only affecting metrics.
- [ ] Publishing and marketing YAML remain canonical sources for reproducible package outputs.
- [ ] Source hashes prevent silent overwrite of stale outputs.
- [ ] Next-book inheritance validates locked canon and active threads without inventing outcomes.
- [ ] The continuity graph preserves bounded depth, explicit-before-discovered ordering, provisional restrictions, inactive-thread restrictions, later-book exclusions, and provenance reporting.
- [ ] Undo continues to create revert commits and never rewrites history.

### GitHub Actions verification

Use the repository's `Novel Forge tests` workflow as the authoritative verification record. Every phase PR and the final merged `main` commit must pass both Node jobs before merge or release.

- [ ] `npm ci` passes strictly from the committed lockfile.
- [ ] `npm run typecheck` passes on Node 22.19.0 and Node 24.
- [ ] `npm test` passes on Node 22.19.0 and Node 24.
- [ ] `npm run eval` passes.
- [ ] `npm run audit:voice -- <fixture-root>` returns deterministic JSON evidence or a clear non-mutating no-baseline result.
- [ ] Real Pi command/tool lifecycle tests pass.
- [ ] Packed-extension install/import/registration smoke tests pass.
- [ ] `npm pack --dry-run` contains the new source contracts and bundled wizard assets.
- [ ] The final diff contains no temporary workflow files, generated diagnostics, local artifacts, imported review corpora, or generated book outputs.


### Phase 7 release qualification

- [ ] Nine deterministic 1.3 release fixtures pass without claiming objective literary quality.
- [ ] The clean-project journey records honest skips for writer prose, real human evidence, supplied adoption files, approved packaging, and locked-canon next-book creation.
- [ ] `npm run verify:release` passes and reports all tree/package/release-note findings.
- [ ] The one-time `release-v1.3` workflow verifies the merged main commit before creating the annotated tag and GitHub release.

### Publish

1. Merge every GitHub-Actions-verified 1.3 phase pull request to `main`.
2. Confirm the final merged `main` commit's `Novel Forge tests` workflow is green under Node 22.19.0 and Node 24.
3. Create annotated tag `v1.3.0` only on that verified `main` commit.
4. Confirm installation with:

   ```bash
   pi install git:github.com/dustinober1/pi-book@v1.3.0
   ```

5. Run a clean `/novel-start` and `/novel` smoke test from the tagged package.
6. Exercise taste intake, voice baseline, research update, review-observation analysis, chapter context, voice audit, one DOCX adoption, one reader CSV merge, one package export, and one next-book creation from the tagged package.

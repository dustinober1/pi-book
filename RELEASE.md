# Novel Forge Release Checklist

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
- [ ] Existing audit, revision-ticket, and strategy files without Phase 5 fields remain readable.
- [ ] Projects without `voice-audits.yaml` are not retroactively blocked by milestone enforcement.
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
- [ ] First-chapter, act, and manuscript approvals hash their corresponding voice-audit evidence.

### Research-update safety

- [ ] `research-update` is available only during the approved active creative stages.
- [ ] It accepts only allowlisted taste, voice, research, strategy, audit, and source-register evidence.
- [ ] It rejects empty, stale, duplicate, unsafe, manuscript, project-state, book-state, guidance, reader-evidence, publishing, marketing, and package-output submissions.
- [ ] It does not advance stage, change gates or approvals, alter active-book status, or write manuscript prose.
- [ ] Learned-guardrail approval or rejection changes only book-strategy evidence.
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
- [ ] Voice metrics include sentence/paragraph distributions, dialogue, fragments, rhetorical questions, filter words, repeated body language, and interiority.
- [ ] Required audits occur after Chapter 1, Chapter 3, every act boundary, manuscript review, and explicit recalibration.
- [ ] A missed Chapter 1 or Chapter 3 audit cannot be bypassed by a later gate.
- [ ] Required milestone audits must be approved before the matching gate may be approved.
- [ ] `npm run audit:voice -- <project-root> [milestone]` produces read-only JSON and writes no project files.
- [ ] More than two consecutive identical scene engines are flagged.
- [ ] Whole-book scene-engine dominance is surfaced only as a diagnostic review finding.
- [ ] Dialogue-led scenes without case, relationship, power, character, pressure, or plot-state movement are flagged.
- [ ] Adjacent chapters with indistinguishable state-change vectors are flagged.
- [ ] Repeated findings in one chapter count once toward recurrence.
- [ ] Recurring revision problems become guardrail candidates only after three distinct chapters or two distinct milestone reviews.
- [ ] Guardrail promotion requires writer approval or rejection.
- [ ] Proposed and rejected rules never enter drafting context.
- [ ] Guardrail promotion does not retroactively rewrite unrelated prose or change stage/gates.

### Wizard and transaction safety

- [ ] The wizard binds only to `127.0.0.1` on an ephemeral port.
- [ ] Every API request requires the session credential and exact origin.
- [ ] Sessions expire and delete their upload directories.
- [ ] The browser has no direct filesystem-write or arbitrary-command route.
- [ ] Confirmed actions enforce expected stage and project hash.
- [ ] Binary files preserve exact bytes and participate in transaction rollback.
- [ ] The research wizard exposes sanitized snapshots, previews, and typed proposals only.
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
- [ ] Real Pi command/tool lifecycle tests pass.
- [ ] Packed-extension install/import/registration smoke tests pass.
- [ ] `npm pack --dry-run` contains the new source contracts, audit CLI, and bundled wizard assets.
- [ ] The final diff contains no temporary workflow files, generated diagnostics, local artifacts, imported review corpora, or generated book outputs.

### Publish

1. Merge every GitHub-Actions-verified 1.3 phase pull request to `main`.
2. Confirm the final merged `main` commit's `Novel Forge tests` workflow is green under Node 22.19.0 and Node 24.
3. Create annotated tag `v1.3.0` only on that verified `main` commit.
4. Confirm installation with:

   ```bash
   pi install git:github.com/dustinober1/pi-book@v1.3.0
   ```

5. Run a clean `/novel-start` and `/novel` smoke test from the tagged package.
6. Exercise taste intake, voice baseline, research update, review-observation analysis, chapter context, every required voice-audit milestone, one learned-rule approve/reject flow, one DOCX adoption, one reader CSV merge, one package export, and one next-book creation from the tagged package.

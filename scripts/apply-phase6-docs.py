from pathlib import Path

root = Path('.')


def insert_before(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor!r}')
    file.write_text(text.replace(anchor, addition + anchor, 1), encoding='utf-8')


def insert_after(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor!r}')
    file.write_text(text.replace(anchor, anchor + addition, 1), encoding='utf-8')

readme = '''## Guided voice and research wizard

Use the normal `/novel` workflow and choose **Review voice and research evidence**, or open the optional surface directly:

```text
/novel-wizard research
```

The local wizard provides five evidence workspaces:

- **Influence Palette** — capture private references, admired qualities, explicit exclusions, and neutral derived craft traits;
- **Anonymous Voice Comparison** — review only variants A, B, and C, record writer scores, and explicitly accept one or a custom combined baseline;
- **Reader Friction** — preview identity-stripped public-review CSV evidence, build evidence-backed clusters, and record prevent, mitigate, accepted-tradeoff, or irrelevant decisions;
- **Research Ledger** — inspect and validate planned, researching, or ready claims against registered source provenance;
- **Revision Learning** — inspect eligible recurrence patterns and explicitly propose, approve, or reject future drafting rules.

The browser receives a sanitized project snapshot. It does not receive manuscript prose, reader-response bodies, source-scene prose, anonymous variant prose until the writer explicitly opens a comparison, reviewer identity, or arbitrary filesystem access. Every mutation requires a successful preview and returns through the existing `research-update` event with stage/hash checks, typed validation, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.

Public market observations remain separate from real manuscript reader evidence. Scores never choose a voice baseline automatically, readiness findings never invent source support, and learning eligibility never approves a rule on the writer's behalf.

'''
insert_before('README.md', '## Graph-aware continuity context\n', readme)

skill = '''## Guided research wizard

`/novel-wizard research` is an optional loopback-only review surface. `/novel` remains the normal interface and may offer **Review voice and research evidence** as a non-primary action.

The research wizard may expose only sanitized summaries for taste evidence, experiment metadata, public-market observations and clusters, research items and source summaries, and revision-learning candidates. Do not include manuscript prose, reader-response bodies, raw public-review bodies, reviewer names/handles/profile URLs, voice source-scene prose, or variant prose in the initial snapshot.

All research-wizard changes must follow preview before apply. Store preview candidates in session memory under opaque IDs. On apply, reload canonical state, use the stored candidate rather than trusting resubmitted creative data, enforce the proposal's expected stage and project hash, and call `novel_apply_event` / `applyNovelEvent` with `event_type: research-update`. Never write project files directly from browser handlers.

Influence references remain private in `taste-profile.yaml`; only neutral derived traits may become drafting rules. Voice comparison displays anonymous A/B/C labels only. Writer scores summarize evidence and never choose prose automatically. Accepting a baseline requires 600–900 words, originality validation, exact hashes, baseline metrics, and consistent experiment/index/taste/guardrail updates in one transaction.

Public-review imports must remove reviewer identity and remain market evidence only. Research items marked ready must pass the existing source/readiness validator. Revision-learning candidates may be displayed, but only exact evidence plus explicit writer approval may create an approved future guardrail. No wizard action may mutate manuscript paths, reader evidence, publishing metadata, package outputs, project stage, gates, or approvals.

'''
insert_before('SKILL.md', '## Temporary browser wizard\n', skill)

changelog_added = '''- A loopback-only guided research wizard for influence evidence, anonymous voice comparison, public-review friction, research readiness, and revision-learning decisions.\n- Sanitized research snapshots and opaque in-memory preview records that exclude manuscript prose, reader-response bodies, reviewer identity, source-scene prose, and unrequested variant prose.\n- Preview-before-apply research actions that return through the guarded `research-update` transaction rather than browser filesystem writes.\n'''
insert_before('CHANGELOG.md', '### Changed\n', changelog_added)
insert_after('CHANGELOG.md', '- Approved learning rules are validated against exact recurrence evidence before `research-update` accepts them.\n', '- `/novel-wizard research` and the optional `/novel` research action now expose the five evidence workspaces without replacing the current primary stage or gate action.\n')
insert_after('CHANGELOG.md', '- New books begin with an empty revision-learning guardrail list. No existing ticket, audit, approval, or manuscript is backfilled or rewritten.\n', '- Existing adoption, readers, packaging, and next-book wizard workflows retain their routes, session security, uploads, and apply behavior.\n')
insert_after('CHANGELOG.md', '- Audit and promotion workflows never rewrite earlier manuscript prose automatically.\n', '- Research-wizard snapshots and applies cannot write manuscript, reader-evidence, publishing, marketing, package-output, project-state, or book-state paths.\n- The browser serves no remote scripts, fonts, analytics, scraping logic, arbitrary commands, or direct filesystem APIs.\n')

insert_after('RELEASE.md', '- [ ] The research wizard exposes sanitized snapshots, previews, and typed proposals only.\n', '- [ ] `/novel-wizard research` opens Influence Palette, Anonymous Voice Comparison, Reader Friction, Research Ledger, and Revision Learning surfaces.\n- [ ] Initial research snapshots exclude manuscript prose, reader-response bodies, reviewer identity, source-scene prose, and variant prose.\n- [ ] Every research mutation requires a stored preview ID plus current stage and project hash.\n- [ ] Confirmed research actions return through `research-update` and leave stage, gates, approvals, and manuscript prose unchanged.\n- [ ] Public-review imports remain identity-stripped market evidence and never update manuscript reader metrics.\n- [ ] Voice variants are shown only as A/B/C; scores do not choose the baseline automatically.\n- [ ] Ready research claims require valid registered source support.\n- [ ] Learning eligibility never activates a rule without explicit writer approval.\n- [ ] Existing adoption, readers, packaging, and next-book wizard workflows remain passing.\n')

(root / 'docs/novel-forge-phase6-research-wizard.md').write_text('''# Novel Forge Phase 6 — Guided Research Wizard

## Purpose

Phase 6 adds an optional local browser workspace for evidence-heavy author decisions. It does not add a new creative stage and does not replace `/novel`.

```text
/novel-wizard research
```

## Security boundary

The wizard binds to `127.0.0.1`, uses the existing fragment credential and exact-origin checks, expires after inactivity, and keeps uploads in session-owned temporary storage. Static assets are bundled locally. There are no remote scripts, fonts, analytics, scraping endpoints, direct filesystem routes, or arbitrary command routes.

The initial snapshot contains only validated summaries. It excludes manuscript prose, reader-response bodies, reviewer identity, public-review bodies, source-scene prose, and anonymous variant prose. Variant prose is loaded only for an explicit A/B/C comparison preview.

## Preview and apply

Each change follows the same sequence:

1. the writer submits a candidate in the browser;
2. the server validates and stores a typed preview under an opaque session-local ID;
3. the writer reviews the preview;
4. the writer confirms apply;
5. the server reloads canonical project state and applies the stored candidate through `research-update` using the preview envelope's expected stage and project hash;
6. Novel Forge validates, rolls back on failure, creates one Git checkpoint, and refreshes `STATUS.md` and `HANDOFF.md`.

The browser never writes project files directly.

## Evidence workspaces

### Influence Palette

Capture the private reference, its role, admired qualities, excluded qualities, and neutral derived traits. Named references remain in private taste evidence and do not enter drafting context.

### Anonymous Voice Comparison

Open a validated experiment and review only variants A, B, and C. Record writer scores and accepted traits. The writer may accept A, B, C, or provide a custom combined baseline. Acceptance requires 600–900 words, originality validation, exact content hashes, and one consistent transaction updating experiment, baseline, index, taste selection, and voice guardrails.

### Reader Friction

Upload or paste CSV evidence. Preview identity removal and rating bands before import. Build clusters from observation IDs, preserve positive counterweights, and record the writer's decision. These observations remain public market evidence and never count as human testing of the current manuscript.

### Research Ledger

Inspect or edit typed research items. Planned and researching claims may remain incomplete. A ready claim must pass the existing source provenance, reliability, date, fictionalization, knowledge scope, risk, dramatic-use, and story-decision checks.

### Revision Learning

View patterns that meet the exact recurrence threshold. Eligibility is diagnostic only. The writer explicitly proposes, approves, or rejects a future drafting rule. Approved rules must match the exact supporting tickets, distinct chapters, and milestone reviews.

## Compatibility

The existing adoption, reader, packaging, and next-book wizard workflows keep their established routes and behavior. Existing projects require no migration solely to open the research wizard; missing optional evidence remains visible as a repair need rather than invented or backfilled state.
''', encoding='utf-8')

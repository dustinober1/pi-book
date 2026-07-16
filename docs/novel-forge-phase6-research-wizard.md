# Novel Forge Phase 6 — Guided Research Wizard

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

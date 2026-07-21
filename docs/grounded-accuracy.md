# Grounded Research and Claim Audits

Novel Forge can attach bounded evidence anchors to ready research and audit proposed chapter claims before they become canonical manuscript prose.

## Evidence anchors

Research items may add:

```yaml
accuracy_risk: high
evidence_anchors:
  - source_id: SRC-001
    locator: Section 4.2, release procedure
    support_type: direct
    paraphrase: Two authorized operators must confirm release.
    excerpt_hash: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

`accuracy_risk` is `low`, `medium`, or `high`. Anchor support is `direct`, `corroborating`, or `contextual`.

Anchors are deliberately bounded:

- `source_id` must be listed in the research item's `source_ids`.
- The registered source must list the research item in `supports_research_ids`.
- `locator` must be nonblank.
- `paraphrase` is limited to 500 characters.
- Source excerpts are not stored. `excerpt_hash` is a normalized SHA-256 hash or `null`.
- High-risk ready research requires one valid direct anchor or two valid corroborating anchors from different sources.

Existing research ledgers remain readable. Novel Forge does not invent or backfill evidence for older items.

Use the existing research wizard to preview and save anchored items:

```text
/novel-wizard research
```

The save still passes through the guarded `research-update` event with stage, project-hash, schema, source, rollback, and Git-checkpoint validation.

## Drafting context

Only ready research selected for the active chapter enters drafting context. Its anchors travel inside the same complete research record. Unrelated research and anchors remain excluded.

This prevents a larger evidence collection from becoming an indiscriminate prompt dump.

## Claim-audit policy

Claim audits run according to quality tier and fact-checking policy:

| Tier | `risk-based` behavior |
|---|---|
| economy | No isolated claim audit; foreground usage remains tracked when enabled. |
| balanced | Audit historical chapters and deterministic high-risk chapters. |
| premium | Audit deterministic medium- and high-risk chapters. |
| editorial | Audit every proposed chapter. |

`fact_checking: always` audits all non-economy chapters. `fact_checking: off` disables claim audits.

## Audit sequence

When an audit is required, Novel Forge:

1. Produces the proposed guarded chapter event in cache.
2. Extracts line-specific factual, procedural, chronological, material, and biographical claims.
3. Verifies each line range and SHA-256 text hash deterministically.
4. Rejects research or invention IDs that were not supplied for the chapter.
5. Audits every proposed claim only against packet-relevant evidence anchors and declared historical inventions.
6. Stops immediately on an unsupported high-risk claim.
7. Permits at most one targeted qualification or generalization pass for repairable claims.
8. Re-extracts and re-audits the repaired chapter.
9. Runs the final editorial review when configured.
10. Calls the existing guarded `draft-chapter` event once.

No planning, candidate, critique, claim-extraction, claim-audit, or repair artifact is canonical manuscript state.

## Finding rules

Supported claims cite anchors as `RES-NNN#N`, where `N` is the one-based anchor position on the research item.

Historical inventions must reference an existing `INV-NNN` explicitly allowed by the chapter packet. They are accepted as declared inventions, not misrepresented as sourced facts.

A model's confidence, general knowledge, or contextual plausibility is never sufficient evidence. Deterministic validation—not model opinion—decides whether references and hashes are valid.

## Failure behavior

- Unsupported high-risk claims stop without canonical manuscript mutation.
- A second failed audit after targeted repair stops without canonical mutation.
- Failed artifacts remain in the ignored local quality cache according to the configured retention policy.
- Token and call reservations apply to extraction, audit, repair, and re-audit passes.
- Privacy-safe telemetry stores usage and content hashes, not prompts, chapter prose, source excerpts, or reasoning text.

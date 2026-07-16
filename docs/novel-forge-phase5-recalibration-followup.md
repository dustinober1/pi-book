# Novel Forge 1.3 Phase 5 Follow-up

This follow-up exposes the voice recalibration workflow already supported by the Phase 5 audit event and corrects one scene-audit false-positive boundary.

## Explicit recalibration

Run:

```text
/novel-review recalibration
```

The command is available during drafting, act review, revision, manuscript review, and packaging. It requires:

- an approved voice-baseline content hash;
- stored baseline metrics in `series/voice-guardrails.yaml`;
- at least one non-empty manuscript chapter.

Recalibration uses the existing state-neutral `research-update` event with `scope: recalibration`. It appends one evidence-only record to `books/<book-id>/voice-audits.yaml`.

It does not:

- change the creative stage;
- change gates or approvals;
- change `BOOK.yaml`;
- rewrite manuscript prose;
- create an automatic severity or revision verdict.

## Conversation state audit

A conversation-led scene is considered state-neutral only when all four recorded channels are neutral:

1. plot `state_change`;
2. `pressure_movement`;
3. `character_movement`;
4. `relationship_movement`.

A meaningful change in any one channel suppresses the state-neutral-conversation finding. The conversational engine family includes interviews, conversations, dialogue scenes, meetings, briefings, debriefs, interrogations, and questioning scenes.

This preserves the original purpose of the audit—finding scenes that truly fail to change state—without penalizing dialogue-led scenes that create relationship, character, or pressure movement even when the plot-grid summary itself says `unchanged`.

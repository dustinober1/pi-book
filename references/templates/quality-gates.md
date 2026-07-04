# Quality Gates

gate_status: blocked

## Hard gates

- PRD readiness: unknown
- Active hard blockers: unknown
- Writer approval required after PRD import, voice fingerprint, first-page/sample draft, chapter one, pre-full-drafting, and final polish.
- Autopilot may not change premise, audience, voice, ending, POV, genre promise, risk budget, or major structure without explicit writer approval.

## Approval gate statuses

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| PRD import | pending | Review `prd-gap-report.md` and `prd-traceability-map.md` |
| Voice fingerprint | pending | Run `/genesis-voice-ingest` or fill `author-voice-fingerprint.md` |
| First-page sample | pending | Draft and approve sample before full drafting |
| Chapter one | pending | Approve or repair Chapter 1 before chapter autopilot |
| Pre-full-drafting | pending | Approve outline, queue, continuity, and quality gates |
| Final polish | pending | Run adversarial audit and Genesis Score first |

## Gate status values

Use `open_for_next_safe_step` only when the next step is genuinely safe. Use `blocked` or `needs_writer_approval` when automation must stop.

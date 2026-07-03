---
description: Clear blockers when possible, then advance Genesis for Pi to the next pipeline step
argument-hint: "[instructions]"
---
Use the `genesis-for-pi` skill and advance the current Genesis for Pi project.

User instructions, if any: $ARGUMENTS

Rules:

1. Load `PROJECT_STATE.yaml`, `ASSUMPTIONS.md`, and `references/pipeline/manifest.yaml`.
2. Identify the current phase, the next incomplete required output, and any active blocker that prevents safe advancement.
3. Continue from the current state; do not restart the project unless state is missing or explicitly invalid.
4. Bypass optional writer approval gates for this turn unless the user explicitly asks for a check-in.
5. Do not bypass hard blockers: active drift-loop hard stops, open blocker/high revision tickets, missing required phase outputs, unresolved name-collision blockers, unresolved AI-tell blockers, unresolved author-voice blockers, or phase contract mismatches.
6. If blockers exist, clear them first when possible by updating the relevant blocker files and any necessary repair artifacts, manuscript files, or revision tickets. Do not merely report blockers if they can be resolved in this turn.
7. If a blocker cannot be cleared safely in this turn, report the blocker and the exact file/evidence needed to unblock.
8. Once blockers are cleared or none exist, produce only the next required step's outputs, update `PROJECT_STATE.yaml`, and commit each changed file separately.
9. Preserve the Human Voice Rule: optimize for reader trust, author fingerprint, subtext, rhythm, sensory authority, and controlled imperfection rather than AI-detector evasion.
10. Use `artifacts/review-personas.md`, `artifacts/author-voice-fingerprint.md`, `artifacts/voice-bible.md`, and `artifacts/human-source-bank.md` to protect voice when revising or unblocking.
11. Do not skip Phase 4. Do not run Final Score before Adversarial Audit is complete.

Proceed now.

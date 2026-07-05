# Genesis for Pi Best Practices

- Use `/genesis-start` for the fastest safe single-book bootstrap.
- Use `/genesis-prd-start <path>` when you already have a book PRD; let Genesis score completeness, create traceability, and ask only gap questions instead of repeating intake.
- Use `/genesis-cockpit` before long sessions to see what the writer must decide, which gates are blocked, and what automation is allowed to do.
- Use `/genesis-autopilot <target>` only for one bounded gated step; do not use it to skip writer approval, voice approval, or PRD gap answers.
- Use `/genesis-chapter-queue` before full drafting so every chapter has a packet with goals, promises, continuity constraints, taste-lock notes, and post-draft ledger tasks.
- Use `/genesis-post-chapter-update` after drafting chapters so continuity, promises, scorecards, and queue status stay synchronized.
- Use `/genesis-taste-lock` whenever feedback or revision pressure might smooth away intentional risk, weirdness, roughness, restraint, or author voice.
- Use `/genesis-prd-diff <path>` when you revise the PRD; review decision impact before accepting the new PRD as source of truth.
- Use `/genesis-questions` to reduce cognitive load: it should ask only writer-level decisions, not artifact chores.
- Use `/genesis-outline-stress-test` before drafting so weak architecture is repaired before prose exists.
- Use `/genesis-review-personas` early and `/genesis-persona-review` before major revision so feedback is tied to actual reader experience instead of abstract quality.
- Use `/genesis-regression-check` after significant revision or PRD changes to catch broken promises, continuity drift, reopened tickets, voice drift, or accidental padding.
- Use `/genesis-series-start` for a planned multi-book series so shared canon, series arc, timeline, character state, reveal order, and per-book projects stay separated.
- Use `/genesis-series-open` from a parent directory when you have multiple series workspaces.
- Use `/genesis-plan` before `/genesis-next` when resuming older work.
- Use `/genesis-resume` to understand where a project stalled.
- Use `/genesis-doctor` when install health, git state, lint findings, or missing directories feel suspicious.
- Use `/genesis-lint` when files technically exist but still feel half-finished.
- Use `/genesis-set-mode` early so the package can scaffold the right bundle.
- For published-series work, choose `series repair` instead of `series installment` when one or more earlier books are locked canon.
- Use `/genesis-score-to-tickets` after audit or scoring to convert findings into concrete revision work.
- Use `/genesis-migrate` on older or partial project trees before continuing.
- Treat `STATUS.md` as a dashboard, not the source of truth; project artifacts still win.
- In planned series work, run `/genesis-series-add-book` instead of hand-copying a book folder when the series expands.
- In planned series work, run `/genesis-series-blockers` when shared canon, payoff, or book state feels unsafe.
- In planned series work, keep future-book details provisional; do not treat planned endings or sequel setup as canon until locked.
- In planned series work, run `/genesis-series-lock-book` before treating a completed installment as canon for later books, and generate a book handoff packet when you do.
- In series repair, extract canon before rewriting later books; do not rely on memory or scattered manuscript notes.
- Use `/genesis-series-verify` before approving later installments that depend on earlier-book canon or promises.
- Use `/genesis-series-regression-check` after revisions, rewrites, or lock changes so timeline, character-state, reveal-order, and handoff drift get caught early.
- Use `/genesis-series-score` before packaging a series arc, and `/genesis-series-export` when preparing an editorial or archive handoff.
- For AI thrillers and system-driven novels, run `docs/ai-thriller-qa-checklist.md` before final scoring and before publication packaging.
- Use `docs/ai-thriller-review-prompt.md` when you want a fast publication-facing developmental review after a full draft or major revision.

## Model sampling profile by phase

Genesis does not auto-mutate model sampling parameters (temperature, top-p, etc.). Those values are model-dependent and an invisible per-phase shift would contradict the package's writer-gated, auditable design. Instead, calibrate sampling deliberately per phase, and treat the numbers below as **starting bands to test against your specific model, not fixed values**.

Why not hardcode a single creative temperature (e.g. 0.8):

- temperature scales are not portable. 0.8 is moderately high on OpenAI chat models, below default on Anthropic, and somewhere else again on Gemini and open models. Copying one number across models will over- or under-shoot.
- "creative work" is not one band. Within the generative phases the package also does fidelity-critical tasks (voice-fingerprint matching, sacred-source mapping, scripture-source maps, continuity-ledger updates) that want low variance, not high.
- the package's real creative-quality levers are structural (voice bible, ear-pass, over-polish audit, negative-capability, discarded-choices, human-specificity, rhetoric-density scan). Temperature is a crude global token-variance knob; it mostly affects surface noise, not whether a scene lands.

Recommended bands (calibrate to your model):

| phase / task | sampling guidance | rationale |
| --- | --- | --- |
| Phase 0 Intake, Phase 5 Score, Phase 6 packaging | low (deterministic) | PRD gaps, scoring, and metadata should be stable and reproducible. |
| Phase 1 Foundation — premise/theme/character brainstorm, name generation | medium-high | divergent ideation benefits from variance. |
| Phase 1 Foundation — voice-fingerprint capture, sacred-source mapping | low | fidelity to supplied samples and source must win over novelty. |
| Phase 2 Architecture — outline, causality, continuity ledger | low-medium | structural correctness and consistency matter more than surprise. |
| Phase 3 Drafting — prose generation | medium-high | this is where variance serves voice and avoids AI-smooth prose. |
| Phase 3 Drafting — continuity/promise/scorecard updates after a block | low | ledger updates must be exact, not creative. |
| Phase 4 Adversarial Audit, all `audit:*` scanners' interpretation | low | audits should be reproducible; high temperature makes findings inconsistent across runs. |
| Regression checks, PRD diffs, blocker triage | low | these are verification tasks. |

Operating rules:

- default to **low** for anything that writes to a ledger, scorecard, PRD, or continuity artifact. Creativity there is a bug.
- raise sampling **only for net-new prose and divergent ideation**, and re-audit the result with the voice and ear-pass tools — higher temperature increases the chance of AI-tell prose that the Phase 4 audits exist to catch.
- if you want phase-gated sampling automated, implement it as an **opt-in** `before_provider_request` hook driven by a `sampling:` block in `PROJECT_STATE.yaml`, default off, so the operator owns the values and can see them. Do not bake a magic number into the extension.
- when in doubt, keep sampling conservative and lean on the package's structural levers (voice fingerprint, taste-lock, rhetoric-density scan) for creative range. They are more reliable than temperature and they leave an auditable trail.

# Genesis for Pi

> Private repository/package: intended for private use unless you explicitly choose to publish it.

Genesis for Pi is the Pi-native packaging of Book Genesis Universal Core.

It can be used for novels, memoir, narrative nonfiction, prescriptive nonfiction, study guides, certification-prep books, and installments within a larger series.

This package is now extension-first: it exposes Pi commands, blocker-triage UI/tooling, the primary `genesis-for-pi` skill, and the `book-genesis-codex` compatibility alias for durable intake, foundation, architecture, drafting, adversarial audit, Genesis Score, and editorial package generation.

## Install in Pi

From this local folder:

```bash
pi install /Users/dustinober/.codex/skills/genesis-for-pi
```

For one-off use without installing:

```bash
pi -e /Users/dustinober/.codex/skills/genesis-for-pi
```

## Use

Genesis for Pi can be used in two ways:

1. **Extension-first** — recommended for normal use in Pi
2. **Skill-first** — useful when you want to explicitly load the workflow contract

### Skill commands

Primary skill:

```text
/skill:genesis-for-pi
```

Legacy alias:

```text
/skill:book-genesis-codex
```

You can also ask naturally, for example:

```text
Start a Genesis for Pi book project from this idea.
Continue my Genesis project.
Run the next Genesis phase.
```

### Pi extension commands

This package provides Pi-native extension commands:

```text
/genesis-init
/genesis-open
/genesis-status
/genesis-plan
/genesis-next
/genesis-validate
/genesis-set-mode
/genesis-blockers
/genesis-scaffold-templates
/genesis-audit-fluff
```

Legacy aliases remain available:

```text
/bg-init
/bg-open
/bg-status
/bg-plan
/bg-next
/bg-validate
/bg-set-mode
/bg-blockers
/bg-scaffold-templates
/bg-audit-fluff
```

Use `/genesis-init` to create a fresh Genesis project tree, initialize git when needed, scaffold research folders, and optionally kick off Phase 0 intake.

Use `/genesis-open` to pick an existing Genesis project under the current working directory, then inspect it or continue it.

Use `/genesis-status` to inspect the current Genesis project root, detected phase, phase-aware missing expected files, git state, and potential blocker files.

Use `/genesis-plan` for a dry-run summary of what Genesis would do next before any agent turn is queued.

Use `/genesis-next` to clear blockers when possible, then advance the current Genesis project to the next incomplete pipeline step. It bypasses optional approval pauses for that turn, but it does not bypass hard blockers such as active drift alarms, open blocker/high revision tickets, unresolved AI-tell or author-voice blockers, missing required phase outputs, phase contract mismatches, or missing git initialization.

Use `/genesis-validate` to run a stricter phase-contract check for the current project before advancing. It also checks mode-specific artifacts for series, nonfiction, study-guide, and certification-prep workflows.

Use `/genesis-set-mode` to explicitly set the workflow mode, update `PROJECT_STATE.yaml`, `ASSUMPTIONS.md`, and `artifacts/00-brief.md`, and offer mode-specific scaffold files when templates exist.

Use `/genesis-blockers` for interactive blocker triage. It lets you inspect blocker evidence and queue a targeted fix turn from the UI.

Use `/genesis-scaffold-templates` to copy core artifact templates such as `voice-bible.md`, `continuity-ledger.md`, `revision-tickets.md`, `expansion-integrity.md`, `series-bible.md`, `argument-spine.md`, `certification-blueprint-map.md`, and `research/reference-inventory.md` into the active project.

Use `/genesis-audit-fluff` to run a focused anti-padding audit when a draft feels thin, repetitive, or suspiciously long for how little it changes.

You can append instructions:

```text
/genesis-next main checkpoints only
```

Fallback prompt templates are also available as:

```text
/genesis-next-prompt
/bg-next-prompt
```

## Recommended workflow

### 1. Create a new project

From the directory where you want the project folder to be created:

```text
/genesis-init
```

What happens:

- you are prompted for a project name
- a new project directory is created
- the standard Genesis folders are created
- starter files such as `PROJECT_STATE.yaml`, `ASSUMPTIONS.md`, and intake artifacts are scaffolded
- research folders such as `research/reference-inventory.md`, `research/notes/`, and `research/sources/` are scaffolded
- `git init` runs automatically if needed
- you can immediately kick off Phase 0 intake

You can also use the legacy alias:

```text
/bg-init
```

### 2. Open an existing project

If you already have one or more Genesis projects under your current working directory:

```text
/genesis-open
```

This lets you pick a project and then:

- show status
- show a dry-run plan
- inspect blockers
- continue the next step

Legacy alias:

```text
/bg-open
```

### 3. Check project status

```text
/genesis-status
```

Use this when you want a quick read on:

- detected current phase
- likely blocker files
- missing expected outputs
- updated `STATUS.md` dashboard for easy resume

Legacy alias:

```text
/bg-status
```

### 4. Preview the next step

```text
/genesis-plan
```

Use this when you want a dry-run summary of:

- hard blockers and warnings
- the next expected file for the current phase
- what `/genesis-next` will try to do

Legacy alias:

```text
/bg-plan
```

### 5. Advance the project

```text
/genesis-next
```

This is the main working command.

What it does:

- reads the current project state
- checks for blockers
- tries to clear blockers first when possible
- advances only the next required pipeline step
- preserves the human-voice rules and artifact contract

Useful examples:

```text
/genesis-next main checkpoints only
/genesis-next do not draft prose yet
/genesis-next careful mode
/genesis-next clear blockers first
```

Legacy alias:

```text
/bg-next
```

### 6. Validate the current phase contract

```text
/genesis-validate
```

Use this when you want to verify:

- detected phase
- required outputs for that phase
- missing outputs
- blocker and warning state
- likely mismatch between `PROJECT_STATE.yaml` and actual files

Legacy alias:

```text
/bg-validate
```

### 7. Set the workflow mode

```text
/genesis-set-mode
```

Use this when you want to explicitly mark a project as:

- novel
- memoir
- narrative nonfiction
- prescriptive nonfiction
- study guide
- certification prep
- series installment
- other

When templates are available for the selected mode, Genesis can also scaffold those mode-specific starter files immediately.

Legacy alias:

```text
/bg-set-mode
```

### 8. Inspect blockers directly

```text
/genesis-blockers
```

Use this when you want targeted triage before advancing. The command lets you:

- inspect blocker evidence
- see suggested repair actions
- queue a focused blocker-fix turn

Legacy alias:

```text
/bg-blockers
```

### 9. Scaffold core templates

```text
/genesis-scaffold-templates
```

Use this when you want to quickly create or replace structured starter files for:

- `voice-bible.md`
- `continuity-ledger.md`
- `revision-tickets.md`
- `expansion-integrity.md`
- `series-bible.md`
- `argument-spine.md`
- `certification-blueprint-map.md`
- `study-guide-objectives.md`
- `evidence-map.md`
- `research/reference-inventory.md`

Legacy alias:

```text
/bg-scaffold-templates
```

### 10. Audit fluff directly

```text
/genesis-audit-fluff
```

Use this when you want a focused pass on:

- padding
- ornamental subplots
- repeated introspection
- duplicate exposition
- low-consequence chapter blocks
- scenes that increase length without increasing pressure

Legacy alias:

```text
/bg-audit-fluff
```

## Typical ways to work

### Start from scratch

1. `cd` into the parent directory where you want your book project stored
2. run `/genesis-init`
3. provide the seed idea
4. allow Genesis to start Phase 0 intake
5. keep using `/genesis-next` until the phase is complete
6. repeat `/genesis-next` as the project moves through the pipeline

### Resume existing work

1. `cd` into the directory that contains your Genesis projects
2. run `/genesis-open` or `/genesis-status`
3. if blockers appear, use `/genesis-blockers`
4. run `/genesis-next` to continue safely

### Workflow modes

During intake, Genesis should record a workflow mode such as:

- novel
- memoir
- narrative nonfiction
- prescriptive nonfiction
- study guide
- certification prep
- series installment

This helps the system decide whether to emphasize subplots, argument flow, reference integrity, objective coverage, or series continuity.

### Force explicit skill usage

If you want the agent to operate with the full workflow contract explicitly loaded first:

1. run `/skill:genesis-for-pi`
2. then ask for the exact phase or task you want
3. or follow with `/genesis-next`

Example:

```text
/skill:genesis-for-pi
Continue this project from the current phase and preserve the author's voice.
```

## Pipeline overview

Genesis for Pi uses this sequence:

1. **Phase 0: Intake**
   - idea capture
   - assumptions
   - brief
   - market map
   - story engine
   - creative sovereignty files
   - review personas
2. **Phase 1: Foundation**
   - characters
   - theme
   - voice bible
   - author voice fingerprint
   - human source bank
   - name audits
3. **Phase 2: Architecture**
   - outline
   - subplot/pressure-line map
   - causality or argument chain
   - continuity ledger
   - reader promise tracker
   - expansion integrity plan
   - optional series / nonfiction / study-guide support artifacts
4. **Phase 3: Drafting**
   - chapter drafting
   - chapter scorecards
   - specificity, subtext, ear-pass, and over-polish tracking
5. **Phase 4: Adversarial Audit**
   - narrative fingerprint audit
   - AI-tell mitigation audit
   - revision tickets
6. **Phase 5: Final Score**
   - Genesis Score evaluation
7. **Phase 6: Editorial Package**
   - editorial and delivery assets

## Human-voice guidance

Genesis for Pi is designed to avoid generic AI-clean prose.

In practice, that means:

- preserve the writer's rhythm, taste, roughness, and obsessions
- do not pad to reach word count; if the book needs to grow, add real subplot pressure, consequence, and aftermath instead of filler
- use `review-personas.md` to catch false notes early
- use `author-voice-fingerprint.md` and `voice-bible.md` during drafting and revision
- clear blockers by repairing the underlying prose or structure, not by cosmetic word swaps
- avoid over-smoothing scenes that should stay strange, awkward, withheld, or human

## Multi-machine use

For multiple machines, put this folder in a private git repo and install from git:

```bash
pi install git:github.com/YOUR_USER/genesis-for-pi@v0.1.0
```

## Privacy and local-use notes

- This repo is intended to stay private by default.
- `package.json` uses `"license": "UNLICENSED"`.
- Do not commit secrets, `.env` files, `.pi/`, `.agents/`, build output, or local `node_modules/`.
- Review machine-specific absolute paths before pushing future changes.

Use tags or commit refs to keep machines pinned to the same version.

## Package contents

- `SKILL.md` — primary `genesis-for-pi` skill entrypoint and workflow contract
- `book-genesis-codex.md` — legacy compatibility alias skill
- `references/` — pipeline prompts, scoring contract, and reference docs
- `extensions/genesis.ts` — Pi-native `/genesis-init`, `/genesis-open`, `/genesis-status`, `/genesis-plan`, `/genesis-next`, `/genesis-validate`, `/genesis-set-mode`, `/genesis-blockers`, `/genesis-scaffold-templates`, `/genesis-audit-fluff`, `/bg-init`, `/bg-open`, `/bg-status`, `/bg-plan`, `/bg-next`, `/bg-validate`, `/bg-set-mode`, `/bg-blockers`, `/bg-scaffold-templates`, and `/bg-audit-fluff` commands plus the `genesis_blocker_triage` tool
- `references/templates/` — starter templates for high-friction artifacts such as `voice-bible.md`, `continuity-ledger.md`, `revision-tickets.md`, `expansion-integrity.md`, `series-bible.md`, `argument-spine.md`, `certification-blueprint-map.md`, `study-guide-objectives.md`, `evidence-map.md`, and `research/reference-inventory.md`
- `prompts/genesis-next-prompt.md` and `prompts/bg-next-prompt.md` — fallback prompt-template versions of `/genesis-next`
- `agents/openai.yaml` — adapter metadata

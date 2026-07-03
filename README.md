# Genesis for Pi

> Private repository/package: intended for private use unless you explicitly choose to publish it.

Genesis for Pi is the Pi-native packaging of Book Genesis Universal Core.

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
/genesis-next
/genesis-blockers
```

Legacy aliases remain available:

```text
/bg-init
/bg-open
/bg-status
/bg-next
/bg-blockers
```

Use `/genesis-init` to create a fresh Genesis project tree, initialize git when needed, and optionally kick off Phase 0 intake.

Use `/genesis-open` to pick an existing Genesis project under the current working directory, then inspect it or continue it.

Use `/genesis-status` to inspect the current Genesis project root, detected phase, missing expected files, and potential blocker files.

Use `/genesis-next` to clear blockers when possible, then advance the current Genesis project to the next incomplete pipeline step. It bypasses optional approval pauses for that turn, but it does not bypass hard blockers such as active drift alarms, open blocker/high revision tickets, unresolved AI-tell or author-voice blockers, missing required phase outputs, or phase contract mismatches.

Use `/genesis-blockers` for interactive blocker triage. It lets you inspect blocker evidence and queue a targeted fix turn from the UI.

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

Legacy alias:

```text
/bg-status
```

### 4. Advance the project

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

### 5. Inspect blockers directly

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
   - subplot map
   - causality chain
   - continuity ledger
   - reader promise tracker
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
- `extensions/genesis.ts` — Pi-native `/genesis-init`, `/genesis-open`, `/genesis-status`, `/genesis-next`, `/genesis-blockers`, `/bg-init`, `/bg-open`, `/bg-status`, `/bg-next`, and `/bg-blockers` commands plus the `genesis_blocker_triage` tool
- `prompts/genesis-next-prompt.md` and `prompts/bg-next-prompt.md` — fallback prompt-template versions of `/genesis-next`
- `agents/openai.yaml` — adapter metadata

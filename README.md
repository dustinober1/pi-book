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

In Pi:

```text
/skill:genesis-for-pi
```

Legacy alias:

```text
/skill:book-genesis-codex
```

Or ask naturally for the Genesis for Pi workflow.

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

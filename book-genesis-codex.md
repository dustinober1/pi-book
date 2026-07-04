---
name: book-genesis-codex
description: "Legacy compatibility alias for Genesis for Pi. Use when an older slash command or workflow still refers to book-genesis-codex."
disable-model-invocation: true
---

# Legacy Book Genesis Codex Alias

This is a compatibility alias for `genesis-for-pi`.

When invoked:

- load `./SKILL.md`
- treat `genesis-for-pi` as the canonical skill
- preserve legacy compatibility for older slash commands, prompts, and habits
- prefer Pi-native commands such as `/genesis-start`, `/genesis-init`, `/genesis-open`, `/genesis-status`, `/genesis-plan`, `/genesis-resume`, `/genesis-doctor`, `/genesis-next`, and `/genesis-blockers`

If both names appear, follow the `genesis-for-pi` skill contract.

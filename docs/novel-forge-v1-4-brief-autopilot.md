# Novel Forge 1.4 Brief Bootstrap and Safe Autopilot

## Start from a brief

Novel Forge can initialize a project from one authorized Markdown or text brief:

```text
/novel-start "Project Name" --profile thriller --type planned-series --target-words 110000 --brief /path/to/brief.md
```

The brief is read only during bootstrap. Novel Forge does not modify, move, or copy the source into the project or package.

Explicit brief fields become author evidence and writer decisions. Missing language or audience fields remain low-confidence assumptions with visible blockers until the writer confirms them.

## Expected brief fields

A complete Markdown brief may contain:

```markdown
## Idea
The core author idea.

Language: English
Audience: Adult thriller readers
Profile: thriller
Target Words: 110000

## Seed Elements
- protagonist
- essential situation
```

A one-sentence idea is also accepted. Novel Forge preserves the idea and marks unresolved setup assumptions instead of silently promoting defaults to facts.

## Auto-advance to a writer gate

Use `--auto-to` to persist a target and queue the first safe action immediately:

```text
/novel-start "Project Name" --profile thriller --type planned-series --brief /path/to/brief.md --auto-to book-plan-approval
```

Autopilot uses the normal typed planning prompts and guarded events. It reloads canonical state after accepted work and stops before:

- every pending human approval;
- premise selection;
- a rejected gate;
- missing evidence or a nonretryable rejection;
- the requested target.

It never approves a gate, selects a premise, fabricates evidence, or writes creative artifacts outside the normal event boundary.

## Resume behavior

The target is stored in the persistent automation run. `/novel-run --resume` continues from the current stage after checking the creative-state hash. During book planning it queues premise comparison first, then stops for the writer's explicit selection before book architecture proceeds.

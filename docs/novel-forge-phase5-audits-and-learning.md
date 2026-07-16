# Novel Forge 1.3 — Voice, Scene, and Revision Learning

Phase 5 adds evidence-driven quality controls without turning prose into a numeric optimization problem. The normal author workflow remains `/novel`.

## Voice audits

Novel Forge schedules a voice audit at five points:

1. after Chapter 1;
2. after Chapter 3;
3. at each act-boundary gate;
4. at manuscript review;
5. when the writer explicitly runs `/novel-review recalibration`.

A due audit appears before the corresponding gate can be approved or more drafting can continue. Earlier missed milestones remain due; an act gate cannot hide a missing Chapter 3 audit.

The audit records:

- sentence mean, median, and 90th percentile;
- paragraph mean and median;
- dialogue ratio;
- short-fragment frequency;
- rhetorical-question rate;
- filter-word rate;
- repeated body-language vocabulary;
- interiority density.

When an approved POV baseline exists, it takes precedence for that POV. Otherwise the approved project baseline is used.

Metrics are **evidence only**. Novel Forge does not turn a numeric delta into an automatic blocker, severity, verdict, or rewrite. Approved intentional exceptions remain visible—for example, a panic scene that deliberately uses fragments.

Voice evidence is stored in `books/<book-id>/voice-audits.yaml`. It may be written through a milestone `review` event or the state-neutral `research-update` event. It does not advance the project or alter manuscript prose.

For a read-only report:

```bash
npm run audit:voice -- /path/to/project chapter-3
```

The command prints JSON and does not change project files.

## Scene and state-change diversity

Milestone reviews inspect the approved chapter queue and plot grid for structural repetition.

Novel Forge flags:

- more than two consecutive chapters using the same `scene_engine`;
- one engine occupying more than half of a sufficiently large plan;
- an interview, conversation, briefing, debrief, meeting, dialogue scene, or interrogation that changes no case, relationship, power, character, pressure, or plot state;
- adjacent chapters whose pressure, character, relationship, and plot-state vectors are indistinguishable.

These are diagnostic findings, not instructions to randomize every chapter. A repeated engine may remain when it is intentional and the scenes create materially different state changes.

## Revision recurrence

Revision tickets receive a stable normalized pattern key. Repeated findings within the same chapter count once.

A pattern becomes eligible for a learned guardrail at exactly one of these thresholds:

- three distinct chapters; or
- two distinct milestone reviews.

Eligibility creates a **candidate**, not an approved rule. Novel Forge presents one direct writer decision: approve or reject.

An approved learned guardrail stores:

- the concise future-facing rule;
- source ticket IDs;
- source milestone-review IDs;
- the approval timestamp.

A rejected rule remains recorded so it is not repeatedly proposed.

Only approved, nonblank rules enter the **Approved book guardrails** drafting-context section. Proposed and rejected rules remain excluded.

## What promotion does not do

Guardrail promotion changes only `books/<book-id>/book-strategy.yaml` through `research-update`.

It does not:

- rewrite earlier chapters;
- edit unrelated revision tickets;
- advance the creative stage;
- change a gate;
- replace the writer’s judgment;
- treat a metric as a prose quota.

## Compatibility

Existing voice-audit, revision-ticket, and book-strategy files without Phase 5 fields remain readable. Projects that do not yet contain `voice-audits.yaml` are not retroactively blocked; the milestone system begins after the author intentionally backfills or creates that artifact.

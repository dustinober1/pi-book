# Novel Forge Thriller and Romantasy Design

## Decision

Replace Genesis for Pi with one compact series-capable novel engine and two data-driven profiles: thriller and romantasy.

## Product boundary

Novel Forge supports novels and series only. It excludes nonfiction, memoir, study guides, certification preparation, sacred retellings, generic PRD workflows, and mandatory market/compliance phases.

## Architecture

A typed domain and application core owns project state, profiles, context selection, review, migration, and transactions. The Pi extension is a thin command adapter. One canonical workflow file and versioned YAML schemas govern the system.

## Durable model

The active control model consists of voice, canon, story threads, plot grid, revision tickets, and a small amount of workflow state. Standalone projects are series-capable from creation.

## Quality strategy

Voice is grounded in writer-approved evidence. Drafting uses bounded context. Light deterministic checks run after chapters; independent review lanes run at milestones. Findings become targeted tickets and revisions must pass regression checks.

## Automation strategy

`/novel-run` performs repeatable work until a declared limit, human gate, blocker, context problem, or canon/reveal conflict. It never grants final creative approval to itself.

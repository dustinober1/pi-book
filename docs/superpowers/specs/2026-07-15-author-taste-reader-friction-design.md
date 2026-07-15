# Author Taste, Research, and Reader Friction Design

## Purpose

Extend Novel Forge with structured author-taste discovery, anonymous voice experiments, story-use research, and public-review friction analysis while preserving author-specific originality, conservative evidence claims, the existing `/novel` workflow, and guarded transactional writes.

The feature must help a writer answer four distinct questions:

1. What reading and prose qualities does this writer genuinely value?
2. What original voice should this project use?
3. What factual and human research is required for the story to work?
4. What recurring reader frustrations should the book prevent, mitigate, intentionally accept, or ignore?

## Product principles

- `/novel` remains the primary interface.
- A future `/novel-wizard research` surface may collect and preview evidence, but it never writes project files directly.
- Author and book references are translated into neutral craft traits; drafting prompts never request direct imitation.
- Writer decisions, writer samples, and an accepted project baseline outrank outside influences.
- Public reviews are market evidence, not human validation of the current manuscript.
- Existing `reader-experiments` remain the only source of outside-reader evidence about Novel Forge manuscript samples.
- Research must have a story use, knowledge boundary, or dramatic consequence before it becomes draft-ready.
- Negative-review findings are paired with positive-reader value so the system improves execution without erasing the book's intended pleasures.
- Existing 1.2 projects remain readable and are not retroactively blocked by absent 1.3 artifacts.

## Workflow placement

```text
Author North Star
→ Influence Palette
→ Anonymous Voice Experiment
→ Voice Approval
→ Series Planning
→ Comparable and Research Intake
→ Reader Promise and Friction Strategy
→ Book Planning
→ Chapter Queue
→ Drafting
→ Voice / Scene / Research Audits
→ Revision
```

No new top-level creative stage is required. Research updates are non-transitioning events allowed at defined existing stages.

## Evidence classes

### Author taste evidence

Private project evidence about admired books, authors, scenes, prose qualities, negative references, and the writer's own samples.

This evidence may influence neutral craft rules but cannot be represented as reader validation or factual research.

### Public market evidence

Paraphrased observations derived from public reviews, genre discussions, comparable-title analysis, and user-supplied notes.

This evidence may support reader-friction clusters and positioning decisions. It cannot update manuscript reader metrics, mark a reader experiment validated, or claim that readers approved the current manuscript.

### Project reader evidence

Accepted, de-identified `source: human` responses collected through the existing reader experiment workflow.

This remains isolated under `books/<book-id>/reader-kits/` and is the only evidence class that can support claims about reactions to the current manuscript.

### Story-world and human-authenticity research

Source-backed facts, practices, procedures, behaviors, and lived-reality observations required by the manuscript.

Each item records sources, confidence, verification date, story use, knowledge scope, fictionalization, and risk.

## Durable artifacts

```text
series/
  taste-profile.yaml
  voice-profile.md
  voice-guardrails.yaml
  voice-experiments/
    index.yaml
    VE-001/
      experiment.yaml
      source-scene.md
      variant-a.md
      variant-b.md
      variant-c.md
      baseline.md

books/<book-id>/
  research-ledger.yaml
  book-strategy.yaml
  voice-audits.yaml
  plot-grid.yaml
  revision-tickets.yaml

research/
  source-register.yaml
```

Existing files are extended where they already own the concept. New files are used only when they represent a distinct responsibility.

## Taste profile

`taste-profile.yaml` stores raw references and their derived purpose.

Each influence requires:

- stable ID;
- reference label;
- influence type;
- admired qualities;
- explicitly excluded qualities;
- neutral derived traits.

Supported influence types are:

- `voice`;
- `reader-experience`;
- `structure`;
- `characterization`;
- `atmosphere`;
- `market-position`.

The precedence order is fixed:

1. explicit writer decisions;
2. writer samples;
3. accepted voice baseline;
4. approved project voice profile;
5. influence references;
6. genre defaults.

## Voice guardrails and experiment

`voice-guardrails.yaml` stores operational `must`, `prefer`, `avoid`, and `monitor` rules plus the accepted baseline path and content hash.

It may not contain direct imitation instructions or depend on an author name to express a rule.

Anonymous voice experiments generate multiple versions of one controlled scene. Variants are labelled by neutral qualities, not source-author names. The writer scores the variants for fit, propulsion, intimacy, naturalness, distinctiveness, and density, then accepts or combines traits into a baseline.

The accepted baseline is immutable evidence for later drift comparisons unless the writer explicitly recalibrates voice.

## Research ledger

`research-ledger.yaml` supports four lanes:

- `taste-and-voice`;
- `story-world`;
- `human-authenticity`;
- `reader-and-market`.

Every item includes:

- stable ID and lane;
- claim or observation;
- source IDs;
- confidence and verification date;
- story-use chapters and dramatic functions;
- affected decision or misunderstanding;
- knowledge scope;
- fictionalization status and reason;
- risk list;
- status.

Allowed dramatic functions include obstacle, false assumption, hidden capability, deadline, vulnerability, forensic clue, procedural constraint, credibility detail, relationship pressure, and moral choice.

A research item cannot be `ready` unless it changes a decision, misunderstanding, constraint, vulnerability, clue, deadline, relationship, or moral choice.

## Public review observations

Version 1.3 does not scrape retailer or review platforms directly.

The workflow accepts agent research, user-supplied links, pasted notes, and CSV imports. Stored observations omit reviewer identity and full review bodies. Each observation records a paraphrase, optional short excerpt, source reference, rating band, comparable title, classification, and project relevance.

Classifications are:

- genre mismatch;
- genre-promise failure;
- execution problem;
- character friction;
- pacing problem;
- style preference;
- production problem;
- content or ideological objection.

Rating bands are negative (one or two stars), mixed (three stars), and positive (four or five stars).

## Reader-friction clustering

Clusters are created from repeated, specific, project-relevant observations across comparable titles.

Confidence is bounded as follows:

- weak: fewer than three observations or one affected title;
- moderate: at least three observations across two titles;
- strong: at least six observations across three titles, with execution relevance and a positive counterweight.

Evidence drawn only from one-star reviews can never exceed moderate confidence.

Each cluster is paired with the positive-reader value that could be damaged by overcorrection. The writer chooses one decision:

- `prevent`;
- `mitigate`;
- `accept-as-tradeoff`;
- `irrelevant-to-project`.

Only approved, project-specific results become drafting or review guardrails.

## Book strategy

`book-strategy.yaml` owns:

- reader promise;
- expectation map;
- reader-friction observations and clusters;
- accepted tradeoffs;
- originality risks and mitigations;
- approved review-derived guardrails.

Genre expectations are marked `satisfy`, `delay`, `invert`, or `avoid` rather than being universally subverted.

## Originality controls

The system checks for premise overlap, protagonist-configuration overlap, signature plot-device reuse, one-to-one beat correspondence, distinctive phrasing, and recurring imagery that depends too closely on a named reference.

The repair action is to restate the desired effect in neutral craft terms and implement it through a different story mechanism.

## Architecture integration

The existing chapter queue continues to reference research through `required_research`. In 1.3 those references resolve to ready research-ledger items, which in turn reference source-register records.

The derived continuity graph may add safe research-item-to-source provenance edges after the schemas are stable. It must keep the existing depth limit, terminal-node behavior, source-of-truth rules, and future-book boundaries.

Raw public reviews, raw influence names, and reader response rows are excluded from drafting context.

## Revision learning

Revision tickets gain optional recurrence metadata. A problem becomes a guardrail candidate after three distinct chapter occurrences or two separate milestone reviews.

Promotion requires writer approval. An approved rule is added to `book-strategy.yaml` and applies to future drafting and relevant revision work. It does not authorize automatic rewriting of unaffected prose.

## Voice and scene audits

Later work adds deterministic supporting metrics for sentence and paragraph distribution, dialogue ratio, fragment and rhetorical-question frequency, repeated body-language vocabulary, and interiority density.

Metrics are evidence, not style scores or quotas.

Scene-engine review uses the existing `scene_engine` field to identify repeated scene machinery and conversations that do not change information, power, relationship, or case state.

## Compatibility

- New projects receive all 1.3 artifacts.
- Existing 1.2 projects remain readable without mandatory migration.
- Missing 1.3 artifacts on previously approved work create advisories and guided backfill actions, not blockers.
- Rebuilding a voice profile or book plan under 1.3 requires the relevant new artifacts.
- Existing manuscript prose, approvals, canon, and reader evidence are preserved.
- A metadata upgrade does not change creative stage or gate state.

## Transaction and security model

A new `research-update` event is text-only, stage-checked, project-hash-checked, schema-validated, allowlisted, rollback-capable, and Git-checkpointed.

It may update only the relevant taste, voice experiment, research, strategy, audit, and evidence-proposal files. It cannot update manuscript prose, `PROJECT.yaml`, `BOOK.yaml`, accepted reader rows, publishing approval, or gate transitions directly.

All derived status and handoff changes remain owned by the existing application transaction layer.

## Testing and release boundary

Implementation proceeds in four independently mergeable pull requests:

1. schemas, events, templates, compatibility;
2. Influence Palette, anonymous voice experiments, originality controls;
3. research ledger, public-review import, friction clustering, book strategy;
4. architecture integration, audits, wizard, documentation, and release.

Every PR uses red-green TDD and must pass typecheck, focused tests, the full test suite, evaluation fixtures, and package dry-run on Node 22.19.0 and Node 24 before merge.

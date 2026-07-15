# Novel Forge 1.3 Phase 2 Influence and Voice Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe influence capture, precedence-aware neutral guardrail compilation, anonymous voice calibration, stable baseline hashing, and drafting-context protection without adding the research wizard or allowing named-author imitation.

**Architecture:** Keep raw names and titles only in `taste-profile.yaml`. Add focused application modules for neutral-rule compilation and voice-experiment verification. Guard every accepted mutation at the existing event boundary, then include only validated `voice-guardrails.yaml` content in bounded drafting context while retaining the readable voice profile only when it is free of raw influence labels and imitation language.

**Tech Stack:** TypeScript 5.9, Node.js 22.19+/24, TypeBox, YAML, Node test runner, existing Novel Forge event transactions, SHA-256, current context budgeter.

## Global Constraints

- Version target remains exactly `1.3.0`; do not create a release tag in this phase.
- `/novel` remains the normal author interface; do not add a new command or wizard workflow.
- Do not add a top-level creative stage.
- Do not add dependencies or remote services.
- Named influence references may exist only in private taste evidence and must never enter drafting instructions, voice variants, accepted baselines, or chapter context.
- Writer decisions, writer samples, accepted baseline, and approved voice profile outrank influence references and genre defaults in that order.
- `research-update` remains non-transitioning and cannot write manuscript prose or protected project state.
- Every mutation continues to use typed validation, expected stage/hash checks, rollback, one Git checkpoint, `STATUS.md`, and `HANDOFF.md`.
- Phase 3 review-observation import, Phase 4 research graph integration, Phase 5 audits, and Phase 6 browser UI remain out of scope.
- Do not trigger, inspect, rerun, or rely on GitHub Actions. Append `[skip ci]` to development commits. Run all verification manually on the development computer and record the results in PR #10 before merge.

## Delivered implementation

### 1. Canonical precedence and influence compilation

- `VOICE_PRECEDENCE_VALUES` and `VOICE_PRECEDENCE` lock the evidence order.
- `compileVoiceGuardrails` keeps the highest-priority occurrence of each normalized rule and records suppressed lower-priority rules.
- Taste profiles with reordered precedence fail schema validation.

### 2. Imitation and raw-reference safety

- `voiceSafetyFindings` rejects direct imitation language and raw author/book references from readable profiles and operational guardrails.
- The shared guided-event boundary applies this validation to `voice-profile` and state-neutral `research-update` mutations.
- Neutral, high-level craft traits remain valid.

### 3. Anonymous experiment verification

- Accepted/scoring experiments require exact A/B/C variants.
- Planned experiments may exist before variants or a baseline are produced.
- Existing partial variants must be unique and appear in A/B/C order.
- Source, variant, and baseline assets use canonical paths inside their own `VE-NNN` directory.
- Source, variants, and accepted baselines contain 600–900 words.
- Stored hashes use normalized line endings and must match exact content.
- Variants and baselines may not contain direct imitation language or private influence references.
- Score summaries are deterministic evidence and never select prose automatically.

### 4. Cross-file accepted-baseline integrity

- A final voice selection validates the experiment index against each experiment record.
- The taste profile, experiment index, experiment record, guardrail baseline, and accepted baseline bytes must identify the same experiment, path, status, and hash.
- Experiment YAML cannot borrow arbitrary files elsewhere in the project.
- Changing taste evidence revalidates any indexed experiments before the update can proceed.

### 5. Existing prompt workflow

- `voicePlanPrompt` remains the only public planning entry point.
- It captures `admired_for`, `not_for`, and neutral derived traits.
- It may stage an anonymous A/B/C experiment through `research-update`, then uses the returned project hash for the final `voice-profile` bundle.
- It never adds a command or browser workflow.

### 6. Context-safe approved guardrails

- `renderContextGuardrails` renders only neutral must/prefer/avoid/monitor rules and the matching POV signature.
- `buildChapterContext` validates existing taste, voice profile, and guardrails before drafting.
- A bounded `Approved voice guardrails` section is included when rules exist.
- Raw influence references and voice-experiment source/variant prose are explicitly excluded.
- Existing 1.2 projects without the new files remain readable.

## Manual verification gate

Verification has **not** been run after the no-GitHub-Actions rule. Keep PR #10 in draft until the following commands pass locally on the development computer.

Run under Node 22.19.0 and Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Focused Phase 2 gate:

```bash
node --import tsx --test \
  tests/influence-palette.test.ts \
  tests/voice-experiment.test.ts \
  tests/originality-guardrails.test.ts \
  tests/context.test.ts \
  tests/context-integrity.test.ts \
  tests/guided-command-prompts.test.ts \
  tests/research-event.test.ts \
  tests/v1-3-schemas.test.ts
```

Before merge, confirm:

- no wizard workflow or browser assets changed;
- no dependency or lockfile change;
- no manuscript fixture or generated package output was added;
- raw names/titles appear only in tests, documentation examples, and private taste evidence;
- no Phase 3–6 behavior is claimed as delivered;
- all review threads are resolved;
- the local verification record has zero failures.

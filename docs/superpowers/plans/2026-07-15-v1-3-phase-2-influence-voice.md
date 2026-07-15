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

## File Map

- Create `src/application/influence-palette.ts`: precedence constants, normalized neutral-rule compiler, imitation/reference findings, context-safe guardrail rendering.
- Create `src/application/voice-experiment.ts`: stable SHA-256 hashing, anonymous asset verification, word-count limits, deterministic score summaries, baseline verification.
- Modify `src/domain/v1-3-schemas.ts`: lock the canonical precedence order and require distinct A/B/C variants for scoring/accepted experiments.
- Modify `src/application/events.ts`: validate voice/taste/guardrail/experiment overlays before guarded writes.
- Modify `src/application/prompts.ts`: conduct the Phase 2 influence and anonymous-calibration workflow through existing events.
- Modify `src/context/context-builder.ts`: parse validated guardrails, exclude raw influence evidence, and add a bounded approved-guardrail section.
- Modify `src/application/project-hash.ts` only if new accepted voice assets are not already covered; preserve current state-neutral stale protection.
- Create `tests/influence-palette.test.ts`, `tests/voice-experiment.test.ts`, and `tests/originality-guardrails.test.ts`.
- Extend `tests/context.test.ts`, `tests/guided-command-prompts.test.ts`, and focused event tests.

---

### Task 1: Canonical precedence and influence compilation

**Files:**
- Create: `tests/influence-palette.test.ts`
- Create: `src/application/influence-palette.ts`
- Modify: `src/domain/v1-3-schemas.ts`

**Interfaces:**
- Produces `VOICE_PRECEDENCE: readonly VoiceEvidenceLayer[]`.
- Produces `compileVoiceGuardrails(input: VoiceCompilationInput): VoiceCompilationResult`.
- Produces `voiceSafetyFindings(input: VoiceSafetyInput): VoiceSafetyFinding[]`.
- Produces `renderContextGuardrails(guardrails: VoiceGuardrails): string`.

- [ ] **Step 1: Write failing precedence and schema tests**

Create `tests/influence-palette.test.ts` with:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { TasteProfileSchema, defaultTasteProfile } from "../src/domain/v1-3-schemas.js";
import { VOICE_PRECEDENCE, compileVoiceGuardrails } from "../src/application/influence-palette.js";

test("taste profiles require the canonical evidence precedence", () => {
  const valid = defaultTasteProfile();
  parseYaml(stringifyYaml(valid), TasteProfileSchema, "taste-profile.yaml");
  assert.deepEqual(valid.precedence, VOICE_PRECEDENCE);
  assert.throws(() => parseYaml(stringifyYaml({ ...valid, precedence: [...valid.precedence].reverse() }), TasteProfileSchema, "taste-profile.yaml"), /schema validation/i);
});

test("higher-priority writer evidence defeats a conflicting influence trait", () => {
  const result = compileVoiceGuardrails({
    explicitWriterDecisions: { must: [], prefer: [], avoid: [], monitor: [] },
    writerSamples: { must: [], prefer: [], avoid: ["ornamental metaphors"], monitor: [] },
    acceptedBaseline: { must: [], prefer: [], avoid: [], monitor: [] },
    approvedVoiceProfile: { must: [], prefer: [], avoid: [], monitor: [] },
    influenceReferences: { must: [], prefer: ["ornamental metaphors"], avoid: [], monitor: [] },
    genreDefaults: { must: [], prefer: [], avoid: [], monitor: [] },
  });
  assert.deepEqual(result.guardrails.avoid, ["ornamental metaphors"]);
  assert.equal(result.guardrails.prefer.includes("ornamental metaphors"), false);
  assert.ok(result.suppressed.some((item) => item.rule === "ornamental metaphors" && item.layer === "influence-references"));
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --import tsx --test tests/influence-palette.test.ts
```

Expected: failure because `influence-palette.ts` does not exist and the schema accepts reordered precedence.

- [ ] **Step 3: Lock the schema precedence**

Replace the free-form precedence array with this exact tuple in `src/domain/v1-3-schemas.ts`:

```ts
export const VOICE_PRECEDENCE_VALUES = [
  "explicit-writer-decisions",
  "writer-samples",
  "accepted-voice-baseline",
  "approved-voice-profile",
  "influence-references",
  "genre-defaults",
] as const;

const VoicePrecedenceSchema = Type.Tuple([
  Type.Literal("explicit-writer-decisions"),
  Type.Literal("writer-samples"),
  Type.Literal("accepted-voice-baseline"),
  Type.Literal("approved-voice-profile"),
  Type.Literal("influence-references"),
  Type.Literal("genre-defaults"),
]);
```

Use `VoicePrecedenceSchema` in `TasteProfileSchema` and keep the default in the same order.

- [ ] **Step 4: Implement the minimal precedence compiler**

Create `src/application/influence-palette.ts`:

```ts
import type { TasteProfile, VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { VOICE_PRECEDENCE_VALUES } from "../domain/v1-3-schemas.js";

export type VoiceEvidenceLayer = typeof VOICE_PRECEDENCE_VALUES[number];
export const VOICE_PRECEDENCE: readonly VoiceEvidenceLayer[] = VOICE_PRECEDENCE_VALUES;
export interface VoiceRuleSet { must: string[]; prefer: string[]; avoid: string[]; monitor: string[] }
export interface VoiceCompilationInput {
  explicitWriterDecisions: VoiceRuleSet;
  writerSamples: VoiceRuleSet;
  acceptedBaseline: VoiceRuleSet;
  approvedVoiceProfile: VoiceRuleSet;
  influenceReferences: VoiceRuleSet;
  genreDefaults: VoiceRuleSet;
}
export interface SuppressedVoiceRule { rule: string; category: keyof VoiceRuleSet; layer: VoiceEvidenceLayer; winnerLayer: VoiceEvidenceLayer }
export interface VoiceCompilationResult { guardrails: VoiceRuleSet; suppressed: SuppressedVoiceRule[] }

function key(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, " "); }

export function compileVoiceGuardrails(input: VoiceCompilationInput): VoiceCompilationResult {
  const layers: Record<VoiceEvidenceLayer, VoiceRuleSet> = {
    "explicit-writer-decisions": input.explicitWriterDecisions,
    "writer-samples": input.writerSamples,
    "accepted-voice-baseline": input.acceptedBaseline,
    "approved-voice-profile": input.approvedVoiceProfile,
    "influence-references": input.influenceReferences,
    "genre-defaults": input.genreDefaults,
  };
  const guardrails: VoiceRuleSet = { must: [], prefer: [], avoid: [], monitor: [] };
  const claimed = new Map<string, { layer: VoiceEvidenceLayer; category: keyof VoiceRuleSet }>();
  const suppressed: SuppressedVoiceRule[] = [];
  for (const layer of VOICE_PRECEDENCE) for (const category of ["must", "prefer", "avoid", "monitor"] as const) {
    for (const raw of layers[layer][category]) {
      const rule = raw.trim();
      if (!rule) continue;
      const normalized = key(rule);
      const winner = claimed.get(normalized);
      if (winner) { suppressed.push({ rule, category, layer, winnerLayer: winner.layer }); continue; }
      claimed.set(normalized, { layer, category });
      guardrails[category].push(rule);
    }
  }
  return { guardrails, suppressed };
}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
node --import tsx --test tests/influence-palette.test.ts tests/v1-3-schemas.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/v1-3-schemas.ts src/application/influence-palette.ts tests/influence-palette.test.ts
git commit -m "feat: compile precedence-aware voice guardrails"
```

---

### Task 2: Imitation and raw-reference safety

**Files:**
- Modify: `tests/influence-palette.test.ts`
- Create: `tests/originality-guardrails.test.ts`
- Modify: `src/application/influence-palette.ts`
- Modify: `src/application/events.ts`

**Interfaces:**
- `voiceSafetyFindings({ taste, voiceProfile, guardrails }): VoiceSafetyFinding[]` returns blockers with `code`, `path`, and `message`.
- `assertVoiceEvidenceSafe(...)` throws one grouped error at the event boundary.

- [ ] **Step 1: Add failing safety tests**

Add tests proving:

```ts
test("direct imitation language is blocked while neutral craft language is accepted", () => {
  const taste = { ...defaultTasteProfile(), influences: [{ id: "INF-001", reference: "Example Author — Example Book", influence_type: "voice", admired_for: ["compression"], not_for: ["signature phrasing"], derived_traits: ["compressed interiority"], status: "approved" }] };
  assert.ok(voiceSafetyFindings({ taste, voiceProfile: "Write in the style of Example Author.", guardrails: defaultVoiceGuardrails() }).some((item) => item.code === "direct-imitation"));
  assert.deepEqual(voiceSafetyFindings({ taste, voiceProfile: "Use compressed interiority and concrete sensory detail.", guardrails: { ...defaultVoiceGuardrails(), prefer: ["compressed interiority"] } }), []);
});

test("raw influence names are blocked from compiled guardrails and voice profile", () => {
  const taste = tasteWithExampleReference();
  assert.ok(voiceSafetyFindings({ taste, voiceProfile: "Example Author is the model.", guardrails: defaultVoiceGuardrails() }).some((item) => item.code === "raw-reference"));
  assert.ok(voiceSafetyFindings({ taste, voiceProfile: "Neutral.", guardrails: { ...defaultVoiceGuardrails(), prefer: ["Use Example Book pacing"] } }).some((item) => item.code === "raw-reference"));
});
```

Add an event test that submits unsafe `voice-profile.md` plus otherwise valid bundle and expects `/imitation|reference/i` rejection.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --import tsx --test tests/influence-palette.test.ts tests/originality-guardrails.test.ts tests/gate-guidance.test.ts
```

Expected: failures because no safety validator exists and the event accepts unsafe text.

- [ ] **Step 3: Implement safety findings**

Add to `src/application/influence-palette.ts`:

```ts
export interface VoiceSafetyFinding { code: "direct-imitation" | "raw-reference"; path: string; message: string }
export interface VoiceSafetyInput { taste: TasteProfile; voiceProfile: string; guardrails: VoiceGuardrails }
const IMITATION_PATTERNS = [/\bwrite like\b/i, /\bimitate\b/i, /\bin the style of\b/i, /\bsound like\b/i, /\bchannel (?:the voice of )?\b/i];
function guardrailStrings(value: VoiceGuardrails): string[] { return [...value.must, ...value.prefer, ...value.avoid, ...value.monitor, ...value.pov_signatures.flatMap((item) => [...item.must, ...item.prefer, ...item.avoid])]; }
function referenceTokens(taste: TasteProfile): string[] {
  return [...taste.influences.map((item) => item.reference), ...taste.negative_references.map((item) => item.reference)]
    .flatMap((reference) => [reference, ...reference.split(/[—–:\-]/).map((item) => item.trim())])
    .filter((item) => item.length >= 4);
}
export function voiceSafetyFindings(input: VoiceSafetyInput): VoiceSafetyFinding[] {
  const targets = [{ path: "series/voice-profile.md", text: input.voiceProfile }, ...guardrailStrings(input.guardrails).map((text) => ({ path: "series/voice-guardrails.yaml", text }))];
  const findings: VoiceSafetyFinding[] = [];
  for (const target of targets) {
    if (IMITATION_PATTERNS.some((pattern) => pattern.test(target.text))) findings.push({ code: "direct-imitation", path: target.path, message: `${target.path} contains direct imitation language.` });
    for (const reference of referenceTokens(input.taste)) if (target.text.toLowerCase().includes(reference.toLowerCase())) findings.push({ code: "raw-reference", path: target.path, message: `${target.path} exposes raw influence reference ${reference}.` });
  }
  return findings;
}
```

- [ ] **Step 4: Enforce safety in guarded events**

In `src/application/events.ts`, parse the overlayed taste profile and guardrails for `voice-profile` and for any `research-update` touching taste/guardrail/experiment evidence. Read the overlayed or existing `series/voice-profile.md`. Reject blockers with:

```ts
const findings = voiceSafetyFindings({ taste, voiceProfile, guardrails });
if (findings.length) throw new Error(`Voice originality validation blocked ${input.eventType}:\n${findings.map((item) => `- ${item.message}`).join("\n")}`);
```

Do not add any new stage transition or allowlisted path.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --import tsx --test tests/influence-palette.test.ts tests/originality-guardrails.test.ts tests/gate-guidance.test.ts tests/research-event.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/influence-palette.ts src/application/events.ts tests/influence-palette.test.ts tests/originality-guardrails.test.ts tests/gate-guidance.test.ts tests/research-event.test.ts
git commit -m "feat: block imitation and raw influence leakage"
```

---

### Task 3: Anonymous voice experiment verification and baseline hashing

**Files:**
- Create: `tests/voice-experiment.test.ts`
- Create: `src/application/voice-experiment.ts`
- Modify: `src/domain/v1-3-schemas.ts`
- Modify: `src/application/events.ts`

**Interfaces:**
- `stableContentHash(content: string): string` hashes exact normalized UTF-8 with line endings converted to `\n`.
- `voiceExperimentFindings(experiment, assets, taste): VoiceExperimentFinding[]` validates path, hash, anonymity, word count, and accepted baseline.
- `summarizeVoiceScores(experiment): VoiceScoreSummary[]` returns deterministic averages ordered score-descending then A/B/C.

- [ ] **Step 1: Write failing experiment tests**

Create tests for:

```ts
test("stable baseline hashes ignore CRLF versus LF but not prose changes", () => {
  assert.equal(stableContentHash("one\r\ntwo\r\n"), stableContentHash("one\ntwo\n"));
  assert.notEqual(stableContentHash("one two"), stableContentHash("one three"));
});

test("accepted experiments require distinct A B and C variants", () => {
  const experiment = acceptedExperiment();
  experiment.variants = [experiment.variants[0], { ...experiment.variants[1], id: "A" }, experiment.variants[2]];
  assert.throws(() => parseYaml(stringifyYaml(experiment), VoiceExperimentFileSchema, "experiment.yaml"), /schema validation/i);
});

test("variants are 600 to 900 words and contain no influence labels", () => {
  const result = voiceExperimentFindings(acceptedExperiment(), assetMap({ A: words(599), B: words(600), C: `Example Author ${words(600)}`, baseline: words(650), source: words(700) }), tasteWithExampleReference());
  assert.ok(result.some((item) => item.code === "variant-word-count" && item.variantId === "A"));
  assert.ok(result.some((item) => item.code === "variant-reference" && item.variantId === "C"));
});

test("stored hashes and accepted baseline hash must match content", () => {
  const experiment = acceptedExperimentForAssets(validAssets());
  assert.deepEqual(voiceExperimentFindings(experiment, validAssets(), defaultTasteProfile()), []);
  assert.ok(voiceExperimentFindings({ ...experiment, baseline_hash: "0".repeat(64) }, validAssets(), defaultTasteProfile()).some((item) => item.code === "hash-mismatch"));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --import tsx --test tests/voice-experiment.test.ts
```

Expected: failure because the application module does not exist and duplicate variant IDs pass schema validation.

- [ ] **Step 3: Require exact A/B/C tuple for scoring and accepted experiments**

Replace the three-item arrays for `scoring` and `accepted` with:

```ts
const VoiceVariantFor = (id: "A" | "B" | "C") => Type.Object({
  id: Type.Literal(id),
  path: Type.String({ minLength: 1 }),
  content_hash: HashSchema,
}, { additionalProperties: false });
const CompleteVoiceVariantsSchema = Type.Tuple([VoiceVariantFor("A"), VoiceVariantFor("B"), VoiceVariantFor("C")]);
```

Use `CompleteVoiceVariantsSchema` for accepted/scoring records. Planned/drafting records retain a maximum-three partial array.

- [ ] **Step 4: Implement experiment verification**

Create `src/application/voice-experiment.ts` with exact line-ending normalization, `countWords`, path-content lookup, hash verification, 600–900 word checks for source/variants/baseline, imitation/reference checks against taste references, and score averages:

```ts
import { createHash } from "node:crypto";
import type { TasteProfile, VoiceExperimentFile } from "../domain/v1-3-schemas.js";
import { countWords } from "../infrastructure/files.js";
export type VoiceExperimentAssetMap = Record<string, string>;
export interface VoiceExperimentFinding { code: "missing-asset" | "hash-mismatch" | "source-word-count" | "variant-word-count" | "variant-reference" | "baseline-word-count"; path: string; variantId?: "A" | "B" | "C"; message: string }
export interface VoiceScoreSummary { variantId: "A" | "B" | "C"; evaluatorCount: number; average: number; densityAverage: number }
export function stableContentHash(content: string): string { return createHash("sha256").update(content.replace(/\r\n?/g, "\n"), "utf8").digest("hex"); }
```

The validator must not generate or select prose. It verifies writer/model-proposed assets and summarizes scores only.

- [ ] **Step 5: Enforce experiment verification at research-update**

When `research-update` submits an `experiment.yaml`, build an overlay map from submitted Markdown assets plus existing experiment-directory files. Parse the experiment and taste profile, call `voiceExperimentFindings`, and reject any finding. Accepted experiment updates must include or already possess all source, variant, and baseline files referenced by the YAML.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --import tsx --test tests/voice-experiment.test.ts tests/v1-3-schemas.test.ts tests/research-event.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain/v1-3-schemas.ts src/application/voice-experiment.ts src/application/events.ts tests/voice-experiment.test.ts tests/v1-3-schemas.test.ts tests/research-event.test.ts
git commit -m "feat: verify anonymous voice experiments"
```

---

### Task 4: Existing prompt workflow for influence capture and calibration

**Files:**
- Modify: `tests/guided-command-prompts.test.ts`
- Modify: `src/application/prompts.ts`

**Interfaces:**
- `voicePlanPrompt(root)` remains the only public planning entry point.
- The prompt may call `research-update` before the final `voice-profile` event but does not add a command or wizard.

- [ ] **Step 1: Add failing prompt assertions**

Assert that the voice prompt requires:

```ts
assert.match(voice, /admired_for/i);
assert.match(voice, /not_for/i);
assert.match(voice, /neutral derived traits/i);
assert.match(voice, /600[–-]900 words/i);
assert.match(voice, /anonymous variants A, B, and C/i);
assert.match(voice, /never label a variant with an author or book/i);
assert.match(voice, /research-update/i);
assert.match(voice, /writer samples.*outrank/i);
```

- [ ] **Step 2: Run and verify RED**

```bash
node --import tsx --test tests/guided-command-prompts.test.ts
```

Expected: failures for missing Phase 2 workflow language.

- [ ] **Step 3: Update `voicePlanPrompt`**

The prompt must direct the model to:

1. capture each influence with explicit admired and excluded qualities;
2. translate references into neutral traits;
3. inspect writer samples before external references;
4. use one 600–900 word source scene and anonymous A/B/C variants when calibration is needed;
5. store experiment assets and YAML through `research-update`;
6. present variants anonymously for writer scoring;
7. verify the accepted/combined baseline hash;
8. submit the final profile, taste profile, guardrails, and index through `voice-profile`;
9. never place names/titles or imitation language in variants, baseline, profile, or guardrails.

- [ ] **Step 4: Verify GREEN**

```bash
node --import tsx --test tests/guided-command-prompts.test.ts tests/pi-runtime.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/application/prompts.ts tests/guided-command-prompts.test.ts
git commit -m "feat: guide anonymous voice calibration"
```

---

### Task 5: Context-safe approved guardrails

**Files:**
- Modify: `tests/context.test.ts`
- Modify: `tests/originality-guardrails.test.ts`
- Modify: `src/application/influence-palette.ts`
- Modify: `src/context/context-builder.ts`

**Interfaces:**
- `renderContextGuardrails(guardrails)` returns only neutral `must`, `prefer`, `avoid`, `monitor`, and matching POV signature rules.
- Context builder includes a capped `Approved voice guardrails` section and never includes `taste-profile.yaml`.

- [ ] **Step 1: Add failing context tests**

Create a project with an approved taste influence containing a distinctive author/book label and neutral guardrails. Make Chapter 1 ready, then assert:

```ts
const context = buildChapterContext(root, 1, 72000);
assert.match(context.text, /Approved voice guardrails/);
assert.match(context.text, /compressed interiority/);
assert.doesNotMatch(context.text, /Example Author|Example Book/);
assert.ok(context.report.included.includes("approved voice guardrails"));
assert.ok(context.report.excluded.includes("raw influence references"));
assert.ok(context.report.estimatedTokens <= 18000);
```

Add a test that unsafe existing guardrails cause `buildChapterContext` to throw instead of leaking the raw reference.

- [ ] **Step 2: Run and verify RED**

```bash
node --import tsx --test tests/context.test.ts tests/originality-guardrails.test.ts
```

Expected: missing section and unsafe guardrails are not rejected.

- [ ] **Step 3: Implement bounded rendering**

Add:

```ts
export function renderContextGuardrails(guardrails: VoiceGuardrails, pov?: string): string {
  const lines = [
    ...guardrails.must.map((rule) => `MUST: ${rule}`),
    ...guardrails.prefer.map((rule) => `PREFER: ${rule}`),
    ...guardrails.avoid.map((rule) => `AVOID: ${rule}`),
    ...guardrails.monitor.map((rule) => `MONITOR: ${rule}`),
  ];
  const signature = pov ? guardrails.pov_signatures.find((item) => item.pov === pov) : undefined;
  if (signature) lines.push(...signature.must.map((rule) => `POV MUST: ${rule}`), ...signature.prefer.map((rule) => `POV PREFER: ${rule}`), ...signature.avoid.map((rule) => `POV AVOID: ${rule}`));
  return lines.join("\n");
}
```

- [ ] **Step 4: Update context builder**

Read and parse taste/guardrail artifacts when present. Validate voice profile and guardrails through `voiceSafetyFindings`; throw a clear drafting blocker on unsafe content. Add `Approved voice guardrails` before the voice-profile excerpt with a cap of 6000 characters. Do not serialize taste-profile or influence records into context. Add report entries:

```ts
included.push("approved voice guardrails");
excluded.push("raw influence references", "voice experiment source and variants");
```

Existing 1.2 projects without guardrail files remain readable; omit the section when the file is absent.

- [ ] **Step 5: Verify GREEN and context budget**

```bash
node --import tsx --test tests/context.test.ts tests/context-integrity.test.ts tests/originality-guardrails.test.ts tests/story-graph.test.ts
npm run typecheck
```

Expected: all pass; context remains within the existing default budget.

- [ ] **Step 6: Commit**

```bash
git add src/application/influence-palette.ts src/context/context-builder.ts tests/context.test.ts tests/originality-guardrails.test.ts
git commit -m "feat: add context-safe voice guardrails"
```

---

### Task 6: Documentation, full verification, and integration

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `SKILL.md`
- Modify: `RELEASE.md`
- Test: full repository suite

- [ ] **Step 1: Update delivered Phase 2 documentation**

Document only shipped behavior: private influence evidence, neutral guardrail compilation, anonymous A/B/C calibration, stable baseline hashes, event validation, and context exclusion. State explicitly that review import, research graph integration, audits, and the browser research wizard remain later phases.

- [ ] **Step 2: Run the Phase 2 gate**

```bash
node --import tsx --test tests/influence-palette.test.ts tests/voice-experiment.test.ts tests/originality-guardrails.test.ts tests/context.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run the full verification matrix locally or in CI**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected: zero failures and package assets intact.

- [ ] **Step 4: Final diff and safety review**

Confirm:

- no wizard workflow or browser assets changed;
- no dependency or lockfile change;
- no manuscript fixture or generated package output was added;
- raw names/titles appear only in test fixtures and private taste evidence;
- no Phase 3–6 behavior is claimed in docs;
- every review thread is resolved.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md CHANGELOG.md SKILL.md RELEASE.md
git commit -m "docs: document v1.3 influence and voice calibration"
```

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch`. Keep the PR as a focused Phase 2 change and do not tag `v1.3.0`.

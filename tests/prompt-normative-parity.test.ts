import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt, normativeEntries } from "../src/application/prompt-compiler.js";
import { bookPlanStageSpec, reviewStageSpec } from "../src/application/stage-specs/index.js";
import type { StageSpec } from "../src/application/stage-specs/types.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

const spec: StageSpec = {
  id: "review",
  role: "Independent manuscript reviewer",
  objective: "Produce evidence-backed review findings without manufacturing reader evidence.",
  inputs: ["approved manuscript", "remarkability.yaml", "reader-experiments.yaml"],
  must: ["Require manuscript evidence.", "Preserve accepted tradeoffs.", "Separate target-reader evidence from wrong-reader noise."],
  avoid: ["Treat public reviews as reader evidence for this manuscript.", "Turn voice metrics into prose quotas."],
  outputs: ["review-report.md", "revision-tickets.yaml"],
  validation: ["Every blocker names concrete manuscript evidence.", "Every ticket includes regression protection."],
  toolRules: ["Submit the complete review through one guarded review event."],
};

test("standard and compact prompts retain every normalized normative entry", () => {
  const standard = compilePrompt(spec, RUNTIME_PROFILES.full).text;
  const compact = compilePrompt(spec, RUNTIME_PROFILES.local).text;
  for (const entry of normativeEntries(spec)) {
    assert.ok(standard.includes(entry), `standard prompt lost: ${entry}`);
    assert.ok(compact.includes(entry), `compact prompt lost: ${entry}`);
  }
});

test("normative entries are stable and de-duplicated without changing order", () => {
  const duplicated: StageSpec = { ...spec, must: ["Preserve accepted tradeoffs.", "Preserve accepted tradeoffs.", "Require manuscript evidence."] };
  assert.deepEqual(normativeEntries(duplicated), [
    "Independent manuscript reviewer",
    "Produce evidence-backed review findings without manufacturing reader evidence.",
    "approved manuscript",
    "remarkability.yaml",
    "reader-experiments.yaml",
    "Preserve accepted tradeoffs.",
    "Require manuscript evidence.",
    "Treat public reviews as reader evidence for this manuscript.",
    "Turn voice metrics into prose quotas.",
    "review-report.md",
    "revision-tickets.yaml",
    "Every blocker names concrete manuscript evidence.",
    "Every ticket includes regression protection.",
    "Submit the complete review through one guarded review event.",
  ]);
});

test("book planning standard prompt retains the current controlling requirements", () => {
  const stage = bookPlanStageSpec({
    root: "/project",
    bookId: "book-01",
    intakeContext: "Original author idea: A signal nobody else can hear.",
    premiseContext: "Selected premise: variant-2.",
    planningQuestions: ["What pressure makes delay costly?"],
    profileRules: [],
    profileOutputs: [],
    projectHash: "hash-123",
  });
  const standard = compilePrompt(stage, RUNTIME_PROFILES.full).text;
  for (const phrase of [
    "safe, predictable version of this book that must be avoided",
    "decision-and-consequence ledger",
    "all ten stress concerns",
    "Research uses exactly four lanes",
    "Public-review observations are market evidence, never reader evidence for this manuscript",
    "pending or blocked checks cannot proceed to approval",
  ]) assert.ok(standard.includes(phrase), `book-plan standard prompt lost: ${phrase}`);
  const compact = compilePrompt(stage, RUNTIME_PROFILES.local);
  assert.ok(compact.characterCount <= Math.floor(compilePrompt(stage, RUNTIME_PROFILES.full).characterCount * 0.7));
});

test("review standard prompt retains evidence and recurrence boundaries", () => {
  const stage = reviewStageSpec({
    root: "/project",
    bookId: "book-01",
    scope: "manuscript",
    expectedStage: "manuscript-review",
    lintEvidence: "## Deterministic prose-lint evidence\n\n- chapter-01.md:7 — mechanical/doubled-word",
    reviewLanes: ["continuity", "voice", "reader promise"],
    projectHash: "hash-456",
  });
  const standard = compilePrompt(stage, RUNTIME_PROFILES.full).text;
  for (const phrase of [
    "independent review lanes",
    "Missing, simulated, model-only, or persona-only responses are not outside-reader evidence",
    "Voice metrics are evidence, not quotas",
    "Eligibility is not approval",
    "Require manuscript evidence",
    "Preserve accepted tradeoffs",
    "Deterministic patterns do not establish authorship",
    "approved guardrails and protected exceptions",
    "No style-pattern finding creates a ticket by itself",
    "exact manuscript location and confirmed problem",
  ]) assert.ok(standard.includes(phrase), `review standard prompt lost: ${phrase}`);

  for (const profile of [RUNTIME_PROFILES.full, RUNTIME_PROFILES.local, RUNTIME_PROFILES["tiny-local"]]) {
    const prompt = compilePrompt(stage, profile).text;
    for (const entry of normativeEntries(stage)) {
      assert.ok(prompt.includes(entry), `${profile.id} review prompt lost: ${entry}`);
    }
  }
});

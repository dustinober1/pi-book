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
  assert.deepEqual(normativeEntries(duplicated).filter((entry) => entry === "Preserve accepted tradeoffs."), ["Preserve accepted tradeoffs."]);
});

test("book planning standard prompt retains the current controlling requirements", () => {
  const stage = bookPlanStageSpec({
    root: "/project",
    bookId: "book-01",
    intakeContext: "Original author idea: A signal nobody else can hear.",
    premiseContext: "Selected premise: variant-2.",
    planningQuestions: ["What pressure makes delay costly?"],
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
  ]) assert.ok(standard.includes(phrase), `review standard prompt lost: ${phrase}`);
});

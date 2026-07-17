import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt, normativeEntries } from "../src/application/prompt-compiler.js";
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

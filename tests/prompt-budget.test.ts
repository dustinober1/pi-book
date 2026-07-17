import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt, PromptBudgetError } from "../src/application/prompt-compiler.js";
import type { StageSpec } from "../src/application/stage-specs/types.js";
import { RUNTIME_PROFILES, type RuntimeProfile } from "../src/domain/runtime-profile.js";

const spec: StageSpec = {
  id: "oversized-stage",
  role: "Budget test role",
  objective: "Demonstrate deterministic prompt budget enforcement.",
  inputs: ["canonical project state"],
  must: ["Preserve every normative rule without truncation.", "Report the largest rendered sections."],
  avoid: ["Silently drop a requirement."],
  outputs: ["one complete artifact"],
  validation: ["The prompt fits before inference."],
  toolRules: ["Stop before inference when the budget is exceeded."],
};

test("prompt budget errors expose stage profile counts and largest sections", () => {
  const constrained: RuntimeProfile = { ...RUNTIME_PROFILES.local, maxPromptChars: 120 };
  assert.throws(
    () => compilePrompt(spec, constrained),
    (error: unknown) => {
      if (!(error instanceof PromptBudgetError)) return false;
      assert.equal(error.stageId, "oversized-stage");
      assert.equal(error.profileId, "local");
      assert.equal(error.maxChars, 120);
      assert.ok(error.actualChars > error.maxChars);
      assert.ok(error.largestSections.length >= 2);
      assert.match(error.message, /oversized-stage/);
      assert.match(error.message, /local/);
      assert.match(error.message, /actual=/);
      assert.match(error.message, /maximum=120/);
      return true;
    },
  );
});

test("budget enforcement never returns a truncated prompt", () => {
  const exact = compilePrompt(spec, { ...RUNTIME_PROFILES.full, maxPromptChars: 50_000 });
  const tooSmall: RuntimeProfile = { ...RUNTIME_PROFILES.full, maxPromptChars: exact.characterCount - 1 };
  assert.throws(() => compilePrompt(spec, tooSmall), PromptBudgetError);
  assert.ok(exact.text.includes("Preserve every normative rule without truncation."));
});

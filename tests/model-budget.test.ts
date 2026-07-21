import test from "node:test";
import assert from "node:assert/strict";
import { resolveModelBudget } from "../src/domain/model-budget.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

test("full profile separates instruction evidence output and safety budgets", () => {
  assert.deepEqual(RUNTIME_PROFILES.full.modelBudget, {
    maxInstructionChars: 24_000,
    maxEvidenceChars: 72_000,
    reservedOutputTokens: 8_000,
    safetyMarginTokens: 2_000,
  });
  assert.equal(RUNTIME_PROFILES.full.maxPromptChars, RUNTIME_PROFILES.full.modelBudget.maxInstructionChars);
  assert.equal(RUNTIME_PROFILES.full.maxContextChars, RUNTIME_PROFILES.full.modelBudget.maxEvidenceChars);
});

test("model context capacity further bounds evidence after instructions and reserves", () => {
  const envelope = RUNTIME_PROFILES.full.modelBudget;
  const unconstrained = resolveModelBudget(envelope, 4_000);
  assert.equal(unconstrained.estimatedInstructionTokens, 1_000);
  assert.equal(unconstrained.modelContextTokens, null);
  assert.equal(unconstrained.maximumEvidenceTokens, 18_000);

  const largeModel = resolveModelBudget(envelope, 4_000, 32_000);
  assert.equal(largeModel.maximumEvidenceTokens, 18_000);

  const smallerModel = resolveModelBudget(envelope, 4_000, 15_000);
  assert.equal(smallerModel.maximumEvidenceTokens, 4_000);
});

test("invalid envelopes and impossible model capacity fail before inference", () => {
  const valid = RUNTIME_PROFILES.full.modelBudget;
  assert.throws(() => resolveModelBudget(valid, valid.maxInstructionChars + 1), /Instruction budget exceeded/);
  assert.throws(() => resolveModelBudget({ ...valid, maxEvidenceChars: -1 }, 1), /Evidence character budget/);
  assert.throws(() => resolveModelBudget({ ...valid, reservedOutputTokens: 0 }, 1), /Reserved output tokens/);
  assert.throws(() => resolveModelBudget(valid, 4_000, 10_000), /cannot fit instructions, reserved output, and safety margin/);
});

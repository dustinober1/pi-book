import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt, PromptBudgetError } from "../src/application/prompt-compiler.js";
import { allocateContext, ContextBudgetError } from "../src/context/context-budget.js";
import type { StageSpec } from "../src/application/stage-specs/types.js";
import { runContextBoundaryBenchmark } from "../src/evaluation/constrained-runtime.js";
import { RUNTIME_PROFILES, type RuntimeProfile } from "../src/domain/runtime-profile.js";

const profileIds = ["tiny-local", "local", "full"] as const;

test("every runtime profile prepares a prompt near both supported boundaries", () => {
  const results = runContextBoundaryBenchmark();
  assert.deepEqual(results.map((result) => result.profile), profileIds);

  for (const result of results) {
    const profile = RUNTIME_PROFILES[result.profile];
    assert.equal(result.passed, true);
    assert.ok(result.instructionChars <= profile.modelBudget.maxInstructionChars);
    assert.ok(result.instructionChars >= profile.modelBudget.maxInstructionChars - 100);
    assert.ok(result.evidenceChars <= profile.modelBudget.maxEvidenceChars);
    assert.ok(result.evidenceChars >= profile.modelBudget.maxEvidenceChars - 200);
    assert.equal(result.requiredRecords, result.includedRecords);
    assert.equal(result.omittedOptionalRecords, 1);
  }
});

test("one character above an instruction limit still fails before inference", () => {
  const spec: StageSpec = {
    id: "boundary-instruction",
    role: "a boundary verifier",
    objective: "verify exact instruction enforcement",
    inputs: ["canonical state"],
    must: ["Preserve every rule."],
    avoid: ["Truncate instructions."],
    outputs: ["one result"],
    validation: ["The result is complete."],
    toolRules: ["Do not mutate state."],
  };
  const exact = compilePrompt(spec, RUNTIME_PROFILES.full);
  const tooSmall: RuntimeProfile = {
    ...RUNTIME_PROFILES.full,
    maxPromptChars: exact.characterCount - 1,
    modelBudget: { ...RUNTIME_PROFILES.full.modelBudget, maxInstructionChars: exact.characterCount - 1 },
  };
  assert.throws(() => compilePrompt(spec, tooSmall), PromptBudgetError);
});

test("one additional required record fails with the exact record ID", () => {
  const first = { id: "REQ-001", body: "A".repeat(80), required: true, priority: 10 };
  const second = { id: "REQ-002", body: "B", required: true, priority: 9 };
  const firstOnly = allocateContext([{ id: "required", title: "Required", maxChars: 1_000, records: [first] }], 1_000);
  assert.throws(
    () => allocateContext([{ id: "required", title: "Required", maxChars: 1_000, records: [first, second] }], firstOnly.text.length),
    (error: unknown) => {
      assert.ok(error instanceof ContextBudgetError);
      assert.deepEqual(error.requiredRecordIds, ["REQ-002"]);
      return true;
    },
  );
});

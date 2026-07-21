import test from "node:test";
import assert from "node:assert/strict";
import { preparePrompt } from "../src/application/prepared-prompt.js";
import { normativeEntries } from "../src/application/prompt-compiler.js";
import { draftStageSpec } from "../src/application/stage-specs/index.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

function draftSpec() {
  return draftStageSpec({
    root: "/project",
    bookId: "book-01",
    chapter: 7,
    estimatedTokens: 10_000,
    excluded: ["future books", "unreferenced canon"],
    projectHash: "hash-123",
  });
}

test("drafting evidence is budgeted separately from normative instructions", () => {
  const evidence = `# Drafting Context\n\n${"E".repeat(40_000)}`;
  const spec = draftSpec();
  const prepared = preparePrompt(spec, evidence, RUNTIME_PROFILES.full);

  assert.ok(prepared.instructionChars <= RUNTIME_PROFILES.full.modelBudget.maxInstructionChars);
  assert.equal(prepared.evidenceChars, evidence.length);
  assert.ok(prepared.evidenceChars > RUNTIME_PROFILES.full.modelBudget.maxInstructionChars);
  assert.ok(prepared.evidenceChars <= RUNTIME_PROFILES.full.modelBudget.maxEvidenceChars);
  assert.ok(prepared.text.includes("## Evidence and bounded project context"));
  assert.ok(prepared.text.endsWith(evidence));
  assert.equal(prepared.estimatedInputTokens, Math.ceil(prepared.text.length / 4));
});

test("prepared draft prompts preserve every normative instruction", () => {
  const spec = draftSpec();
  for (const profile of [RUNTIME_PROFILES.full, RUNTIME_PROFILES.local, RUNTIME_PROFILES["tiny-local"]]) {
    const prepared = preparePrompt(spec, "bounded evidence", profile);
    for (const entry of normativeEntries(spec)) {
      assert.ok(prepared.text.includes(entry), `${profile.id} prepared prompt lost: ${entry}`);
    }
  }
});

test("prepared prompts reject evidence above the profile evidence limit", () => {
  const evidence = "E".repeat(RUNTIME_PROFILES.full.modelBudget.maxEvidenceChars + 1);
  assert.throws(() => preparePrompt(draftSpec(), evidence, RUNTIME_PROFILES.full), /Evidence budget exceeded/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { preparePrompt } from "../src/application/prepared-prompt.js";
import { normativeEntries } from "../src/application/prompt-compiler.js";
import { draftStageSpec } from "../src/application/stage-specs/index.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

test("tiny-local draft prompts fit without dropping normative entries", () => {
  const spec = draftStageSpec({
    root: "/benchmark/novel",
    bookId: "book-01",
    chapter: 1,
    estimatedTokens: 1_150,
    excluded: ["series/canon.yaml"],
    projectHash: "benchmark-project-hash",
  });
  const prepared = preparePrompt(spec, "x".repeat(4_600), RUNTIME_PROFILES["tiny-local"]);
  assert.ok(prepared.instructionChars <= RUNTIME_PROFILES["tiny-local"].modelBudget.maxInstructionChars);
  assert.ok(prepared.evidenceChars <= RUNTIME_PROFILES["tiny-local"].modelBudget.maxEvidenceChars);
  for (const entry of normativeEntries(spec)) assert.ok(prepared.text.includes(entry), entry);
});

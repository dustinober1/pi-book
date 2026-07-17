import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt, normativeEntries } from "../src/application/prompt-compiler.js";
import { draftStageSpec } from "../src/application/stage-specs/index.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

test("tiny-local draft prompts fit without dropping normative entries", () => {
  const spec = draftStageSpec({
    root: "/benchmark/novel",
    bookId: "book-01",
    chapter: 1,
    contextText: "x".repeat(4_600),
    estimatedTokens: 1_150,
    excluded: ["series/canon.yaml"],
    projectHash: "benchmark-project-hash",
  });
  const compiled = compilePrompt(spec, RUNTIME_PROFILES["tiny-local"]);
  assert.ok(compiled.characterCount <= RUNTIME_PROFILES["tiny-local"].maxPromptChars);
  for (const entry of normativeEntries(spec)) assert.ok(compiled.text.includes(entry), entry);
});

import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt } from "../src/application/prompt-compiler.js";
import type { StageSpec } from "../src/application/stage-specs/types.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

const spec: StageSpec = {
  id: "book-plan",
  role: "Novel architecture planner",
  objective: "Prepare an evidence-backed book plan for writer approval.",
  inputs: ["PROJECT.yaml", "BOOK.yaml", "approved premise evidence"],
  must: ["Preserve accepted decisions.", "Record consequences for consequential choices."],
  avoid: ["Select a premise for the writer.", "Invent research evidence."],
  outputs: ["book-bible.md", "plot-grid.yaml"],
  validation: ["All required schemas and references pass."],
  toolRules: ["Apply one guarded book-plan event."],
};

test("standard renderer compiles every StageSpec section deterministically", () => {
  const first = compilePrompt(spec, RUNTIME_PROFILES.full);
  const second = compilePrompt(spec, RUNTIME_PROFILES.full);
  assert.equal(first.text, second.text);
  assert.equal(first.characterCount, first.text.length);
  assert.match(first.text, /Novel architecture planner/);
  assert.match(first.text, /Apply one guarded book-plan event/);
});

test("compact renderer uses the locked section order", () => {
  const compiled = compilePrompt(spec, RUNTIME_PROFILES.local);
  const headings = ["ROLE", "OBJECTIVE", "INPUTS", "MUST", "NEVER", "OUTPUT", "VALIDATE", "TOOL RULES"];
  let previous = -1;
  for (const heading of headings) {
    const position = compiled.text.indexOf(`${heading}:`);
    assert.ok(position > previous, `${heading} should follow the prior section`);
    previous = position;
  }
});

test("compact rendering reduces a representative rules-heavy prompt by at least thirty percent", () => {
  const representative: StageSpec = {
    ...spec,
    must: Array.from({ length: 12 }, (_, index) => `Preserve requirement ${index + 1} exactly and verify its evidence before proposing a change.`),
    avoid: Array.from({ length: 8 }, (_, index) => `Bypass prohibition ${index + 1} or weaken its controlling validation boundary.`),
    validation: Array.from({ length: 6 }, (_, index) => `Validation lane ${index + 1} passes with concrete repository evidence.`),
    toolRules: Array.from({ length: 5 }, (_, index) => `Tool rule ${index + 1} is followed atomically without direct file writes.`),
  };
  const standard = compilePrompt(representative, RUNTIME_PROFILES.full);
  const compact = compilePrompt(representative, RUNTIME_PROFILES.local);
  assert.ok(compact.characterCount <= Math.floor(standard.characterCount * 0.7), `${compact.characterCount} should be at most 70% of ${standard.characterCount}`);
});

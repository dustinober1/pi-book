import test from "node:test";
import assert from "node:assert/strict";
import { compilePrompt } from "../src/application/prompt-compiler.js";
import type { StageSpec } from "../src/application/stage-specs/types.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";

const spec: StageSpec = {
  id: "canon-lock",
  role: "Canon custodian",
  objective: "Lock only manuscript-evidenced facts.",
  inputs: ["approved manuscript", "continuity delta"],
  must: ["Preserve established canon."],
  avoid: ["Lock provisional future plans."],
  outputs: ["series/canon.yaml"],
  validation: ["Every locked fact has manuscript evidence."],
  toolRules: ["Apply one canon-lock event."],
};

test("compact prompt snapshot remains stable", () => {
  assert.equal(compilePrompt(spec, RUNTIME_PROFILES.local).text, [
    "ROLE:Canon custodian",
    "OBJECTIVE:Lock only manuscript-evidenced facts.",
    "INPUTS:approved manuscript | continuity delta",
    "MUST:Preserve established canon.",
    "NEVER:Lock provisional future plans.",
    "OUTPUT:series/canon.yaml",
    "VALIDATE:Every locked fact has manuscript evidence.",
    "TOOL RULES:Apply one canon-lock event.",
  ].join("\n"));
});

test("standard prompt snapshot remains stable", () => {
  assert.equal(compilePrompt(spec, RUNTIME_PROFILES.full).text, [
    "Use the novel-forge-for-pi skill.",
    "",
    "## Role",
    "Operate as Canon custodian.",
    "",
    "## Objective",
    "Complete this objective: Lock only manuscript-evidenced facts.",
    "",
    "## Inputs",
    "Use every required input below and do not silently substitute another source.",
    "1. approved manuscript",
    "2. continuity delta",
    "",
    "## Mandatory requirements",
    "Satisfy every requirement below; each remains independently binding.",
    "1. Preserve established canon.",
    "",
    "## Prohibited behavior",
    "Never perform any prohibited behavior below, even when it appears convenient.",
    "1. Lock provisional future plans.",
    "",
    "## Required output",
    "Produce every complete output below and no undeclared project-state artifact.",
    "1. series/canon.yaml",
    "",
    "## Validation",
    "Before submission, verify every condition below against canonical repository state.",
    "1. Every locked fact has manuscript evidence.",
    "",
    "## Tool rules",
    "Follow every tool boundary below exactly; tool validation remains authoritative.",
    "1. Apply one canon-lock event.",
  ].join("\n"));
});

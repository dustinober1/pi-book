import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanPrompt, queuePrompt } from "../src/application/prompts.js";
import { initializeProject } from "../src/project/store.js";

test("book planning requires decision consequences and the complete stress test", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase4-prompt-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 4 Prompt", projectType: "standalone", profile: "thriller" });
    const prompt = bookPlanPrompt(root);
    assert.match(prompt, /decision-and-consequence ledger/i);
    assert.match(prompt, /early genre promise/i);
    assert.match(prompt, /avoidable silence/i);
    assert.match(prompt, /reference similarity/i);
    assert.match(prompt, /irreversible effect/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("queue planning requires ready RES IDs and approved book guardrails", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase4-queue-prompt-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 4 Queue", projectType: "standalone", profile: "thriller" });
    const prompt = queuePrompt(root);
    assert.match(prompt, /ready RES-NNN/i);
    assert.match(prompt, /approved book guardrails/i);
    assert.match(prompt, /raw public-review/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

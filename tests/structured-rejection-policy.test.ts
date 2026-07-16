import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventRejectionDetail } from "../src/application/event-rejection.js";
import { rejectionRunDecision } from "../src/application/run.js";
import { queuePrompt } from "../src/application/prompts.js";
import { initializeProject } from "../src/project/store.js";

function detail(code: EventRejectionDetail["code"], retryable = false, requiresReload = false): EventRejectionDetail {
  return {
    code,
    message: `${code} example`,
    retryable,
    requiresReload,
    invalidPaths: [],
    issues: [],
    currentStage: "chapter-queue",
    currentProjectHash: "hash-current",
  };
}

test("schema and reference failures permit one corrected resubmission only", () => {
  for (const code of ["schema-validation", "reference-validation"] as const) {
    const first = rejectionRunDecision(detail(code, true), 0);
    assert.equal(first.action, "repair-rejection");
    assert.match(first.message, /once/i);
    assert.match(first.message, /correct only the rejected payload/i);

    const second = rejectionRunDecision(detail(code, true), 1);
    assert.equal(second.action, "blocked");
    assert.equal(second.prompt, null);
    assert.match(second.message, /retry limit/i);
  }
});

test("stale state requires reload while unsafe failures stop automatic work", () => {
  for (const code of ["stale-stage", "stale-project-hash"] as const) {
    const decision = rejectionRunDecision(detail(code, false, true));
    assert.equal(decision.action, "reload-state");
    assert.equal(decision.prompt, null);
    assert.match(decision.message, /reload canonical state/i);
  }

  for (const code of ["wrong-stage", "allowlist-violation", "human-gate-required", "integrity-failure", "filesystem-failure", "unknown"] as const) {
    const decision = rejectionRunDecision(detail(code));
    assert.equal(decision.action, "blocked");
    assert.equal(decision.prompt, null);
    assert.match(decision.message, /stop automatic work/i);
  }
});

test("all event prompts include the structured one-retry policy", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-rejection-prompt-"));
  try {
    const root = initializeProject(parent, { projectName: "Rejection Prompt", projectType: "standalone", profile: "thriller" });
    const prompt = queuePrompt(root);
    assert.match(prompt, /structured rejection code/i);
    assert.match(prompt, /schema-validation.*reference-validation/is);
    assert.match(prompt, /resubmit once/i);
    assert.match(prompt, /stale-stage.*stale-project-hash/is);
    assert.match(prompt, /reload canonical state/i);
    assert.match(prompt, /all other rejection codes.*stop/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

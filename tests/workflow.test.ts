import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkflow, nextStageAfterGate } from "../src/domain/workflow.js";

test("canonical workflow validates and owns gate transitions", () => {
  const workflow = loadWorkflow();
  assert.equal(workflow.product, "novel-forge-for-pi");
  assert.equal(nextStageAfterGate("voice-approval"), "series-planning");
  assert.equal(nextStageAfterGate("manuscript-approval"), "canon-lock");
});

test("invalid workflow fails loudly without a fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "novel-workflow-invalid-"));
  try {
    const path = join(dir, "workflow.yaml");
    writeFileSync(path, 'schema_version: "0.2.0"\nproduct: wrong\nstages: []\ngate_transitions: {}\n', "utf8");
    assert.throws(() => loadWorkflow(path), /schema validation/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeModelUsage } from "../src/application/model-usage.js";
import { decideNextRun } from "../src/application/run.js";
import { getProjectStatus } from "../src/application/status.js";
import { initializeProject } from "../src/project/store.js";

test("status and run decisions expose the active model execution profile", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-small-model-status-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Small Model Status",
      projectType: "standalone",
      profile: "thriller",
      runtimeProfile: "tiny-local",
      modelExecutionProfile: "small-12b-q4",
    });
    const status = getProjectStatus(root, { gitDirtyOverride: 0 });
    assert.equal(status.modelExecutionProfile, "small-12b-q4");
    assert.match(status.markdown, /Model execution profile: small-12b-q4/);
    const decision = decideNextRun(root, { modelExecutionProfile: "host-default" });
    assert.equal(decision.modelExecutionProfile, "host-default");
    assert.match(decision.message, /Model execution profile: host-default/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("model job metadata reaches privacy-safe call telemetry", () => {
  const result = normalizeModelUsage({}, {
    callId: "CALL-JOB",
    stage: "small-model-drafting",
    chapter: 1,
    pass: "candidate",
    jobType: "draft-scene",
    sceneId: "SCN-001",
    attempt: 1,
    contractHash: "d".repeat(64),
    capsuleHash: "e".repeat(64),
    includedRecordCount: 11,
    prompt: "private prompt",
    context: "private context",
    output: "private prose",
    elapsedMs: 1,
  });
  assert.equal(result.jobType, "draft-scene");
  assert.equal(result.sceneId, "SCN-001");
  assert.equal(result.attempt, 1);
  assert.equal(result.contractHash, "d".repeat(64));
  assert.equal(result.capsuleHash, "e".repeat(64));
  assert.equal(result.includedRecordCount, 11);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private prompt"), false);
  assert.equal(serialized.includes("private context"), false);
  assert.equal(serialized.includes("private prose"), false);
});

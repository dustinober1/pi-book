import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeQualityCache, writeQualityArtifact } from "../src/infrastructure/quality-cache.js";

function artifact(order = 1) {
  return {
    schema_version: "1.0.0",
    run_id: "RUN-001",
    chapter: 2,
    source_hashes: ["a".repeat(64)],
    creation_order: order,
    artifact_type: "scene-plan",
    objective: "Escalate the evidence trap.",
    beats: ["Enter", "Discover", "Choose"],
    protected_constraints: ["Preserve endpoint."],
    ending_hook: "The record changes.",
    evidence_refs: ["CAN-001"],
  };
}

test("quality artifacts are written atomically to strict ignored paths with hashes", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-quality-cache-"));
  try {
    const result = writeQualityArtifact(root, {
      runId: "RUN-001",
      chapter: 2,
      name: "scene-plan",
      artifact: artifact(),
    });
    assert.equal(result.relativePath, ".pi-book/cache/generation/RUN-001/chapter-02/scene-plan.json");
    assert.match(result.hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(JSON.parse(readFileSync(result.path, "utf8")), artifact());
    assert.deepEqual(readdirSync(join(root, ".pi-book", "cache", "generation", "RUN-001", "chapter-02")), ["scene-plan.json"]);
    assert.throws(() => writeQualityArtifact(root, { runId: "../escape", chapter: 1, name: "scene-plan", artifact: {} }), /run ID/i);
    assert.throws(() => writeQualityArtifact(root, { runId: "RUN-001", chapter: 1, name: "../escape", artifact: {} }), /artifact name/i);
    assert.match(readFileSync(join(process.cwd(), ".gitignore"), "utf8"), /^\.pi-book\/cache\/$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cache retention supports delete-on-success, keep-latest, and keep-all", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-quality-retention-"));
  try {
    writeQualityArtifact(root, { runId: "RUN-001", chapter: 1, name: "plan", artifact: artifact(1) });
    writeQualityArtifact(root, { runId: "RUN-002", chapter: 1, name: "plan", artifact: { ...artifact(2), run_id: "RUN-002" } });
    finalizeQualityCache(root, "RUN-002", "keep-latest");
    assert.equal(existsSync(join(root, ".pi-book", "cache", "generation", "RUN-001")), false);
    assert.equal(existsSync(join(root, ".pi-book", "cache", "generation", "RUN-002")), true);

    finalizeQualityCache(root, "RUN-002", "keep-all");
    assert.equal(existsSync(join(root, ".pi-book", "cache", "generation", "RUN-002")), true);
    finalizeQualityCache(root, "RUN-002", "delete-on-success");
    assert.equal(existsSync(join(root, ".pi-book", "cache", "generation", "RUN-002")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

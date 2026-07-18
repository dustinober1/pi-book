import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runV13CleanProjectJourney } from "../../src/evaluation/v1-3-journey.js";

test("a clean 1.4 project exercises the honest 1.3 evidence journey", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-v13-journey-"));
  try {
    const report = await runV13CleanProjectJourney(parent);
    assert.equal(report.initializedVersion, "1.5.0");
    assert.deepEqual(report.invariantFailures, []);
    for (const id of [
      "initialize-project",
      "research-snapshot",
      "influence-preview-apply",
      "planned-voice-experiment",
      "research-item",
      "public-review-identity-strip",
      "strategy-graph-load",
      "voice-audit-no-baseline",
      "packaging-checklist",
      "next-book-refusal",
    ]) assert.ok(report.completedChecks.includes(id), id);
    assert.ok(report.skippedChecks.some((item) => item.id === "accepted-voice-baseline" && /writer-selected prose/i.test(item.reason)));
    assert.ok(report.skippedChecks.some((item) => item.id === "human-reader-merge" && /real human/i.test(item.reason)));
    assert.ok(report.skippedChecks.some((item) => item.id === "docx-adoption" && /source file/i.test(item.reason)));
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

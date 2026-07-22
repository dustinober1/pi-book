import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildQualityJobPlan, renderQualityJobPlanManifest } from "../src/application/quality/job-plan.js";
import { writeQualityJobPlanManifest } from "../src/infrastructure/quality-job-plan-store.js";

test("manifest replay is idempotent only for byte-identical plans", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-job-plan-store-"));
  try {
    const premium = buildQualityJobPlan({ tier: "premium", risk: {} });
    const balanced = buildQualityJobPlan({ tier: "balanced", risk: {} });
    const relative = writeQualityJobPlanManifest(root, "QDR-REPLAY", premium);

    assert.equal(writeQualityJobPlanManifest(root, "QDR-REPLAY", premium), relative);
    assert.equal(readFileSync(join(root, relative), "utf8"), renderQualityJobPlanManifest(premium));
    assert.throws(
      () => writeQualityJobPlanManifest(root, "QDR-REPLAY", balanced),
      /conflicting quality job plan.*QDR-REPLAY/i,
    );
    assert.equal(readFileSync(join(root, relative), "utf8"), renderQualityJobPlanManifest(premium));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

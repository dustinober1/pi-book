import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildQualityJobPlan,
  parseQualityJobPlanTier,
  renderQualityJobPlanManifest,
} from "../src/application/quality/job-plan.js";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

test("existing quality tier names parse without changing their public identity", () => {
  assert.equal(parseQualityJobPlanTier("economy"), "economy");
  assert.equal(parseQualityJobPlanTier("balanced"), "balanced");
  assert.equal(parseQualityJobPlanTier("premium"), "premium");
  assert.equal(parseQualityJobPlanTier("editorial"), "editorial");
  assert.throws(() => parseQualityJobPlanTier("unlimited"), /unknown quality tier/i);
});

test("quality job plan manifests are deterministic and contain no prompts or prose", () => {
  const plan = buildQualityJobPlan({
    tier: "premium",
    risk: { key_scene: true, factuality_required: true },
  });
  const first = renderQualityJobPlanManifest(plan);
  const second = renderQualityJobPlanManifest(plan);
  assert.equal(second, first);
  assert.equal(hash(first), hash(second));
  assert.doesNotMatch(first, /prompt|prose|source excerpt|private reasoning/i);
  const parsed = JSON.parse(first) as Record<string, unknown>;
  assert.equal(parsed.schema_version, "1.0.0");
  assert.equal(parsed.tier, "premium");
  assert.equal(parsed.candidate_count, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityJobPlan,
  qualityJobPlanLimits,
  type QualityJobPlanTier,
} from "../src/application/quality/job-plan.js";

const tiers: QualityJobPlanTier[] = ["economy", "balanced", "premium", "editorial"];

function ids(tier: QualityJobPlanTier, risk: Parameters<typeof buildQualityJobPlan>[0]["risk"] = {}) {
  return buildQualityJobPlan({ tier, risk }).jobs.map((job) => job.id);
}

test("quality tiers add bounded jobs instead of enlarging one prompt", () => {
  const economy = ids("economy");
  const balanced = ids("balanced");
  const premium = ids("premium");
  const editorial = ids("editorial");

  assert.deepEqual(economy, [
    "compile-contract",
    "plan-scene",
    "draft-scene",
    "deterministic-validation",
    "extract-state-delta",
    "scene-accept",
    "chapter-stitch",
    "chapter-commit",
  ]);
  assert.ok(balanced.includes("critic-combined"));
  assert.ok(balanced.includes("patch-spans"));
  assert.ok(premium.includes("critic-continuity"));
  assert.ok(premium.includes("critic-causality"));
  assert.ok(premium.includes("critic-character-intent"));
  assert.ok(premium.includes("critic-style"));
  assert.ok(editorial.includes("verify-chapter"));
  assert.ok(editorial.includes("review-book-chronology"));
  assert.ok(editorial.includes("review-book-knowledge"));
  assert.ok(editorial.includes("review-book-character-arcs"));
  assert.ok(editorial.includes("review-book-setup-payoff"));
  assert.ok(editorial.includes("human-escalation"));

  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: {} });
    assert.ok(plan.jobs.every((job) => job.maximum_calls >= 0 && job.maximum_calls <= 2));
    assert.ok(plan.jobs.every((job) => job.maximum_attempts >= 1 && job.maximum_attempts <= 2));
    assert.equal(plan.prompt_mode, "job-specific");
    assert.ok(plan.planned_model_calls <= plan.limits.maximum_model_calls);
  }
});

test("risk selects bounded depth without changing configured ceilings", () => {
  for (const tier of tiers) {
    const low = buildQualityJobPlan({ tier, risk: {} });
    const high = buildQualityJobPlan({
      tier,
      risk: {
        key_scene: true,
        factuality_required: true,
        unresolved_blocker: true,
      },
    });
    assert.deepEqual(high.limits, low.limits);
    assert.deepEqual(high.limits, qualityJobPlanLimits(tier));
    assert.ok(high.planned_model_calls <= high.limits.maximum_model_calls);
    assert.ok(high.planned_generated_tokens <= high.limits.maximum_generated_tokens);
  }

  assert.equal(ids("premium").includes("critic-factuality"), false);
  assert.equal(ids("premium", { factuality_required: true }).includes("critic-factuality"), true);
  assert.equal(ids("balanced", { factuality_required: true }).includes("critic-factuality"), false);
  assert.equal(ids("editorial", { unresolved_blocker: true }).includes("stronger-model-escalation"), true);
});

test("only key scenes at premium or editorial receive a second candidate", () => {
  assert.equal(buildQualityJobPlan({ tier: "economy", risk: { key_scene: true } }).candidate_count, 1);
  assert.equal(buildQualityJobPlan({ tier: "balanced", risk: { key_scene: true } }).candidate_count, 1);
  assert.equal(buildQualityJobPlan({ tier: "premium", risk: {} }).candidate_count, 1);
  assert.equal(buildQualityJobPlan({ tier: "premium", risk: { key_scene: true } }).candidate_count, 2);
  assert.equal(buildQualityJobPlan({ tier: "editorial", risk: { key_scene: true } }).candidate_count, 2);

  const premiumKey = buildQualityJobPlan({ tier: "premium", risk: { key_scene: true } });
  const draft = premiumKey.jobs.find((job) => job.id === "draft-scene");
  assert.equal(draft?.maximum_calls, 2);
  assert.equal(premiumKey.jobs.filter((job) => job.id === "draft-scene").length, 1);
});

test("repair and correction loops remain capped at two attempts", () => {
  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: { key_scene: true, factuality_required: true } });
    const patch = plan.jobs.find((job) => job.id === "patch-spans");
    if (patch) assert.equal(patch.maximum_attempts, 2);
    assert.equal(plan.maximum_correction_attempts, 1);
    assert.equal(plan.maximum_repair_attempts, tier === "economy" ? 0 : 2);
  }
});

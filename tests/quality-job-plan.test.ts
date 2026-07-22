import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityJobPlan,
  initialQualityJobPlanUsage,
  qualityJobPlanHas,
  qualityJobPlanLimits,
  recordQualityJobPlanUsage,
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
  assert.ok(balanced.includes("synthesize-event-output"));
  assert.ok(balanced.includes("patch-spans"));
  assert.equal(premium.includes("critic-combined"), false);
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
    assert.ok(plan.jobs.every((job) => job.maximum_calls >= 0 && job.maximum_calls <= 3));
    assert.ok(plan.jobs.every((job) => job.maximum_attempts >= 1 && job.maximum_attempts <= 2));
    assert.equal(plan.prompt_mode, "job-specific");
    assert.ok(plan.planned_model_calls <= plan.limits.maximum_model_calls);
    assert.ok(plan.planned_generated_tokens <= plan.limits.maximum_generated_tokens);
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
  const factuality = buildQualityJobPlan({ tier: "premium", risk: { factuality_required: true } }).jobs.find((job) => job.id === "critic-factuality");
  assert.equal(factuality?.maximum_calls, 2);
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
  assert.equal(qualityJobPlanHas(premiumKey, "candidate-selection"), true);
});

test("repair and correction loops remain capped", () => {
  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: { key_scene: true, factuality_required: true } });
    const patch = plan.jobs.find((job) => job.id === "patch-spans");
    if (patch) assert.equal(patch.maximum_attempts, 2);
    assert.equal(plan.maximum_correction_attempts, 1);
    assert.equal(plan.maximum_repair_attempts, tier === "economy" ? 0 : 2);
  }
});

test("fixed ceilings cover each tier's declared conditional chapter repair capacity", () => {
  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: { key_scene: true, factuality_required: true } });
    const conditionalChapterJobs = plan.jobs.filter((job) => job.scope === "chapter" && job.kind === "model" && job.conditional);
    const conditionalCalls = conditionalChapterJobs.reduce((sum, job) => sum + job.maximum_calls, 0);
    const conditionalTokens = conditionalChapterJobs.reduce((sum, job) => sum + job.maximum_calls * job.estimated_output_tokens, 0);
    assert.ok(plan.planned_model_calls + conditionalCalls <= plan.limits.maximum_model_calls, `${tier} call ceiling excludes its repair path`);
    assert.ok(plan.planned_generated_tokens + conditionalTokens <= plan.limits.maximum_generated_tokens, `${tier} token ceiling excludes its repair path`);
  }
  const premiumRepair = buildQualityJobPlan({ tier: "premium", risk: { key_scene: true, factuality_required: true } }).jobs.find((job) => job.id === "patch-spans");
  assert.equal(premiumRepair?.maximum_calls, 2);
});

test("editorial book review jobs are deferred from the chapter call budget", () => {
  const plan = buildQualityJobPlan({ tier: "editorial", risk: { key_scene: true, factuality_required: true } });
  const bookJobs = plan.jobs.filter((job) => job.scope === "book");
  assert.ok(bookJobs.length >= 8);
  assert.ok(bookJobs.every((job) => job.kind === "model"));
  assert.ok(plan.deferred_job_ids.includes("review-book-chronology"));
  assert.ok(plan.deferred_job_ids.includes("review-book-repetition"));
  assert.equal(plan.planned_model_calls, 13);
});

test("runtime usage cannot exceed fixed tier call or generated-token ceilings", () => {
  const plan = buildQualityJobPlan({ tier: "premium", risk: { key_scene: true, factuality_required: true } });
  let usage = initialQualityJobPlanUsage();
  for (let index = 0; index < plan.limits.maximum_model_calls; index += 1) {
    usage = recordQualityJobPlanUsage(plan, usage, { outputTokens: 10 });
  }
  assert.equal(usage.model_calls, plan.limits.maximum_model_calls);
  assert.throws(() => recordQualityJobPlanUsage(plan, usage, { outputTokens: 1 }), /model-call ceiling/i);
  assert.throws(() => recordQualityJobPlanUsage(plan, initialQualityJobPlanUsage(), { outputTokens: plan.limits.maximum_generated_tokens + 1 }), /generated-token ceiling/i);
});

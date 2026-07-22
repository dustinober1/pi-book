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
    "scene-accept",
    "chapter-stitch",
    "chapter-commit",
  ]);
  assert.ok(balanced.includes("critic-combined"));
  assert.ok(balanced.includes("synthesize-event-output"));
  assert.equal(balanced.includes("patch-spans"), false);
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
  assert.equal(ids("balanced", { factuality_required: true }).includes("critic-factuality"), true);
  assert.equal(ids("economy", { factuality_required: true }).includes("critic-factuality"), false);
  assert.equal(ids("editorial", { unresolved_blocker: true }).includes("stronger-model-escalation"), true);
  const factuality = buildQualityJobPlan({ tier: "premium", risk: { factuality_required: true } }).jobs.find((job) => job.id === "critic-factuality");
  assert.equal(factuality?.maximum_calls, 2);
});

test("balanced plans schedule factuality work when claim-audit policy selects it", () => {
  const plan = buildQualityJobPlan({ tier: "balanced", risk: { factuality_required: true } });

  assert.equal(qualityJobPlanHas(plan, "critic-factuality"), true);
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

test("premium key scenes preserve a resolved one-candidate setting", () => {
  const plan = buildQualityJobPlan({
    tier: "premium",
    keySceneCandidates: 1,
    risk: { key_scene: true },
  });

  assert.equal(plan.candidate_count, 1);
  assert.equal(plan.jobs.find((job) => job.id === "draft-scene")?.maximum_calls, 1);
  assert.equal(qualityJobPlanHas(plan, "candidate-selection"), false);
});

test("repair and correction loops remain capped", () => {
  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: { key_scene: true, factuality_required: true } });
    const patch = plan.jobs.find((job) => job.id === "patch-spans");
    if (patch) assert.equal(patch.maximum_attempts, 2);
    const factualRepair = plan.jobs.find((job) => job.id === "repair-factuality");
    if (factualRepair) assert.equal(factualRepair.maximum_attempts, 1);
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
  const premiumRepair = buildQualityJobPlan({ tier: "premium", risk: { key_scene: true, factuality_required: true } }).jobs.find((job) => job.id === "repair-factuality");
  assert.equal(premiumRepair?.maximum_calls, 1);
});

test("fixed ceilings cover declared correction capacity for scheduled and conditional chapter calls", () => {
  for (const tier of tiers) {
    const plan = buildQualityJobPlan({ tier, risk: { key_scene: true, factuality_required: true } });
    const conditionalChapterJobs = plan.jobs.filter((job) => job.scope === "chapter" && job.kind === "model" && job.conditional);
    const conditionalCalls = conditionalChapterJobs.reduce((sum, job) => sum + job.maximum_calls, 0);
    const conditionalTokens = conditionalChapterJobs.reduce((sum, job) => sum + job.maximum_calls * job.estimated_output_tokens, 0);
    const attemptsPerCall = 1 + plan.maximum_correction_attempts;
    const declaredCalls = (plan.planned_model_calls + conditionalCalls) * attemptsPerCall;
    const declaredTokens = (plan.planned_generated_tokens + conditionalTokens) * attemptsPerCall;

    assert.ok(declaredCalls <= plan.limits.maximum_model_calls, `${tier} call ceiling excludes its correction capacity`);
    assert.ok(declaredTokens <= plan.limits.maximum_generated_tokens, `${tier} token ceiling excludes its correction capacity`);
  }
});

test("compatibility plans declare the exact factual-repair graph and worst-case correction capacity", () => {
  const premium = buildQualityJobPlan({
    tier: "premium",
    keySceneCandidates: 2,
    risk: { key_scene: true, factuality_required: true },
  });
  const editorial = buildQualityJobPlan({
    tier: "editorial",
    keySceneCandidates: 2,
    risk: { key_scene: true, factuality_required: true },
  });
  const balanced = buildQualityJobPlan({
    tier: "balanced",
    risk: { factuality_required: true },
  });

  for (const plan of [balanced, premium, editorial]) {
    assert.equal(qualityJobPlanHas(plan, "extract-state-delta"), false);
    assert.equal(qualityJobPlanHas(plan, "patch-spans"), false);
    assert.deepEqual(
      plan.jobs
        .filter((job) => ["extract-factual-claims", "critic-factuality", "repair-factuality"].includes(job.id))
        .map((job) => [job.id, job.maximum_calls, job.estimated_output_tokens, job.conditional]),
      [
        ["extract-factual-claims", 2, 1_000, false],
        ["critic-factuality", 2, 1_000, false],
        ["repair-factuality", 1, 4_200, true],
      ],
    );
  }

  assert.deepEqual(premium.limits, { maximum_model_calls: 28, maximum_generated_tokens: 54_000 });
  assert.deepEqual(editorial.limits, { maximum_model_calls: 30, maximum_generated_tokens: 56_400 });
  assert.deepEqual(balanced.limits, { maximum_model_calls: 18, maximum_generated_tokens: 38_000 });
});

test("editorial book review jobs are deferred from the chapter call budget", () => {
  const plan = buildQualityJobPlan({ tier: "editorial", risk: { key_scene: true, factuality_required: true } });
  const bookJobs = plan.jobs.filter((job) => job.scope === "book");
  assert.ok(bookJobs.length >= 8);
  assert.ok(bookJobs.every((job) => job.kind === "model"));
  assert.ok(plan.deferred_job_ids.includes("review-book-chronology"));
  assert.ok(plan.deferred_job_ids.includes("review-book-repetition"));
  assert.equal(plan.planned_model_calls, 14);
});

test("runtime usage cannot exceed fixed tier call or generated-token ceilings", () => {
  const plan = buildQualityJobPlan({ tier: "premium", risk: { key_scene: true, factuality_required: true } });
  let usage = initialQualityJobPlanUsage();
  const executableJobs = plan.jobs.filter((job) => job.kind === "model" && job.scope === "chapter");
  for (const job of executableJobs) {
    for (let index = 0; index < job.maximum_calls; index += 1) {
      usage = recordQualityJobPlanUsage(plan, usage, { jobId: job.id, attempt: 1, outputTokens: 10 });
      usage = recordQualityJobPlanUsage(plan, usage, { jobId: job.id, attempt: 2, outputTokens: 10 });
    }
  }
  assert.equal(usage.model_calls, plan.limits.maximum_model_calls);
  assert.throws(
    () => recordQualityJobPlanUsage(plan, usage, { jobId: "plan-scene", attempt: 1, outputTokens: 1 }),
    /primary-call ceiling|model-call ceiling/i,
  );
  assert.throws(
    () => recordQualityJobPlanUsage(plan, initialQualityJobPlanUsage(), { jobId: "plan-scene", attempt: 1, outputTokens: plan.limits.maximum_generated_tokens + 1 }),
    /generated-token ceiling/i,
  );
});

test("runtime usage enforces scheduled primary jobs and one correction per primary", () => {
  const plan = buildQualityJobPlan({ tier: "premium", risk: {} });
  let usage = initialQualityJobPlanUsage();

  assert.throws(
    () => recordQualityJobPlanUsage(plan, usage, { jobId: "extract-state-delta", attempt: 1, outputTokens: 1 }),
    /not a scheduled chapter model job/i,
  );
  usage = recordQualityJobPlanUsage(plan, usage, { jobId: "plan-scene", attempt: 1, outputTokens: 1 });
  usage = recordQualityJobPlanUsage(plan, usage, { jobId: "plan-scene", attempt: 2, outputTokens: 1 });
  assert.throws(
    () => recordQualityJobPlanUsage(plan, usage, { jobId: "plan-scene", attempt: 1, outputTokens: 1 }),
    /primary-call ceiling/i,
  );
  assert.throws(
    () => recordQualityJobPlanUsage(plan, usage, { jobId: "plan-scene", attempt: 3, outputTokens: 1 }),
    /correction attempt/i,
  );
});

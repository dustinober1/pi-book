export type QualityJobPlanTier = "economy" | "balanced" | "premium" | "editorial";

export type QualityJobId =
  | "compile-contract"
  | "plan-scene"
  | "draft-scene"
  | "deterministic-validation"
  | "critic-combined"
  | "critic-continuity"
  | "critic-causality"
  | "critic-character-intent"
  | "critic-style"
  | "critic-factuality"
  | "patch-spans"
  | "extract-state-delta"
  | "scene-accept"
  | "chapter-stitch"
  | "verify-chapter"
  | "chapter-commit"
  | "review-book-chronology"
  | "review-book-knowledge"
  | "review-book-character-arcs"
  | "review-book-setup-payoff"
  | "review-book-object-location"
  | "review-book-terminology"
  | "review-book-research"
  | "review-book-style-drift"
  | "review-book-repetition"
  | "stronger-model-escalation"
  | "human-escalation";

export type QualityJobKind = "model" | "deterministic" | "human";

export interface QualityJobPlanRisk {
  key_scene?: boolean;
  factuality_required?: boolean;
  unresolved_blocker?: boolean;
}

export interface QualityJobPlanLimits {
  maximum_model_calls: number;
  maximum_generated_tokens: number;
}

export interface QualityJobPlanJob {
  id: QualityJobId;
  kind: QualityJobKind;
  maximum_calls: number;
  maximum_attempts: number;
  estimated_output_tokens: number;
  conditional: boolean;
}

export interface QualityJobPlan {
  schema_version: "1.0.0";
  tier: QualityJobPlanTier;
  prompt_mode: "job-specific";
  candidate_count: 1 | 2;
  maximum_correction_attempts: 1;
  maximum_repair_attempts: 0 | 2;
  jobs: QualityJobPlanJob[];
  limits: QualityJobPlanLimits;
  planned_model_calls: number;
  planned_generated_tokens: number;
}

const LIMITS: Record<QualityJobPlanTier, QualityJobPlanLimits> = {
  economy: { maximum_model_calls: 3, maximum_generated_tokens: 8_000 },
  balanced: { maximum_model_calls: 5, maximum_generated_tokens: 12_000 },
  premium: { maximum_model_calls: 11, maximum_generated_tokens: 22_000 },
  editorial: { maximum_model_calls: 22, maximum_generated_tokens: 40_000 },
};

const OUTPUT_TOKENS: Record<QualityJobId, number> = {
  "compile-contract": 0,
  "plan-scene": 1_200,
  "draft-scene": 4_200,
  "deterministic-validation": 0,
  "critic-combined": 1_200,
  "critic-continuity": 1_000,
  "critic-causality": 1_000,
  "critic-character-intent": 1_000,
  "critic-style": 1_000,
  "critic-factuality": 1_000,
  "patch-spans": 1_500,
  "extract-state-delta": 1_200,
  "scene-accept": 0,
  "chapter-stitch": 0,
  "verify-chapter": 1_200,
  "chapter-commit": 0,
  "review-book-chronology": 1_200,
  "review-book-knowledge": 1_200,
  "review-book-character-arcs": 1_200,
  "review-book-setup-payoff": 1_200,
  "review-book-object-location": 1_200,
  "review-book-terminology": 1_200,
  "review-book-research": 1_200,
  "review-book-style-drift": 1_200,
  "review-book-repetition": 1_200,
  "stronger-model-escalation": 2_000,
  "human-escalation": 0,
};

function job(
  id: QualityJobId,
  kind: QualityJobKind,
  options: { maximumCalls?: number; maximumAttempts?: number; conditional?: boolean } = {},
): QualityJobPlanJob {
  return {
    id,
    kind,
    maximum_calls: options.maximumCalls ?? (kind === "model" ? 1 : 0),
    maximum_attempts: options.maximumAttempts ?? 1,
    estimated_output_tokens: OUTPUT_TOKENS[id],
    conditional: options.conditional ?? false,
  };
}

function economyJobs(candidateCount: 1 | 2): QualityJobPlanJob[] {
  return [
    job("compile-contract", "deterministic"),
    job("plan-scene", "model"),
    job("draft-scene", "model", { maximumCalls: candidateCount }),
    job("deterministic-validation", "deterministic"),
    job("extract-state-delta", "model"),
    job("scene-accept", "deterministic"),
    job("chapter-stitch", "deterministic"),
    job("chapter-commit", "deterministic"),
  ];
}

function insertBefore(jobs: QualityJobPlanJob[], target: QualityJobId, additions: QualityJobPlanJob[]): void {
  const index = jobs.findIndex((item) => item.id === target);
  if (index < 0) throw new Error(`Quality job plan is missing insertion target ${target}.`);
  jobs.splice(index, 0, ...additions);
}

function planJobs(tier: QualityJobPlanTier, risk: QualityJobPlanRisk, candidateCount: 1 | 2): QualityJobPlanJob[] {
  const jobs = economyJobs(candidateCount);
  if (tier !== "economy") {
    insertBefore(jobs, "extract-state-delta", [
      job("critic-combined", "model"),
      job("patch-spans", "model", { maximumAttempts: 2, conditional: true }),
    ]);
  }
  if (tier === "premium" || tier === "editorial") {
    insertBefore(jobs, "patch-spans", [
      job("critic-continuity", "model"),
      job("critic-causality", "model"),
      job("critic-character-intent", "model"),
      job("critic-style", "model"),
      ...(risk.factuality_required ? [job("critic-factuality", "model")] : []),
    ]);
  }
  if (tier === "editorial") {
    insertBefore(jobs, "chapter-commit", [job("verify-chapter", "model")]);
    jobs.push(
      job("review-book-chronology", "model"),
      job("review-book-knowledge", "model"),
      job("review-book-character-arcs", "model"),
      job("review-book-setup-payoff", "model"),
      job("review-book-object-location", "model"),
      job("review-book-terminology", "model"),
      job("review-book-research", "model", { conditional: true }),
      job("review-book-style-drift", "model"),
      job("review-book-repetition", "model"),
      ...(risk.unresolved_blocker ? [job("stronger-model-escalation", "model", { conditional: true })] : []),
      job("human-escalation", "human", { conditional: true }),
    );
  }
  return jobs;
}

export function qualityJobPlanLimits(tier: QualityJobPlanTier): QualityJobPlanLimits {
  return { ...LIMITS[tier] };
}

export function parseQualityJobPlanTier(value: string): QualityJobPlanTier {
  if (value === "economy" || value === "balanced" || value === "premium" || value === "editorial") return value;
  throw new Error(`Unknown quality tier: ${value}.`);
}

export function buildQualityJobPlan(input: {
  tier: QualityJobPlanTier;
  risk?: QualityJobPlanRisk;
}): QualityJobPlan {
  const risk = input.risk ?? {};
  const candidateCount: 1 | 2 = risk.key_scene && (input.tier === "premium" || input.tier === "editorial") ? 2 : 1;
  const jobs = planJobs(input.tier, risk, candidateCount);
  const plannedModelCalls = jobs
    .filter((item) => item.kind === "model")
    .reduce((sum, item) => sum + item.maximum_calls, 0);
  const plannedGeneratedTokens = jobs
    .filter((item) => item.kind === "model")
    .reduce((sum, item) => sum + item.maximum_calls * item.estimated_output_tokens, 0);
  const limits = qualityJobPlanLimits(input.tier);
  if (plannedModelCalls > limits.maximum_model_calls) {
    throw new Error(`Quality job plan requires ${plannedModelCalls} model calls, above the ${limits.maximum_model_calls}-call ${input.tier} ceiling.`);
  }
  if (plannedGeneratedTokens > limits.maximum_generated_tokens) {
    throw new Error(`Quality job plan requires ${plannedGeneratedTokens} generated tokens, above the ${limits.maximum_generated_tokens}-token ${input.tier} ceiling.`);
  }
  return {
    schema_version: "1.0.0",
    tier: input.tier,
    prompt_mode: "job-specific",
    candidate_count: candidateCount,
    maximum_correction_attempts: 1,
    maximum_repair_attempts: input.tier === "economy" ? 0 : 2,
    jobs,
    limits,
    planned_model_calls: plannedModelCalls,
    planned_generated_tokens: plannedGeneratedTokens,
  };
}

export function renderQualityJobPlanManifest(plan: QualityJobPlan): string {
  const manifest = {
    schema_version: plan.schema_version,
    tier: plan.tier,
    candidate_count: plan.candidate_count,
    maximum_correction_attempts: plan.maximum_correction_attempts,
    maximum_repair_attempts: plan.maximum_repair_attempts,
    limits: plan.limits,
    planned_model_calls: plan.planned_model_calls,
    planned_generated_tokens: plan.planned_generated_tokens,
    jobs: plan.jobs.map((item) => ({
      id: item.id,
      kind: item.kind,
      maximum_calls: item.maximum_calls,
      maximum_attempts: item.maximum_attempts,
      estimated_output_tokens: item.estimated_output_tokens,
      conditional: item.conditional,
    })),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

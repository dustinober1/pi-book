export type QualityJobPlanTier = "economy" | "balanced" | "premium" | "editorial";

export type QualityJobId =
  | "compile-contract"
  | "plan-scene"
  | "draft-scene"
  | "candidate-selection"
  | "deterministic-validation"
  | "critic-combined"
  | "critic-continuity"
  | "critic-causality"
  | "critic-character-intent"
  | "critic-style"
  | "extract-factual-claims"
  | "critic-factuality"
  | "repair-factuality"
  | "patch-spans"
  | "synthesize-event-output"
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
export type QualityJobScope = "chapter" | "book" | "human";

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
  scope: QualityJobScope;
  maximum_calls: number;
  maximum_attempts: number;
  estimated_output_tokens: number;
  conditional: boolean;
}

export interface QualityJobPlanUsage {
  model_calls: number;
  generated_tokens: number;
  job_calls: Partial<Record<QualityJobId, {
    primary: number;
    corrections: number;
  }>>;
}

export interface QualityJobPlanCall {
  jobId: QualityJobId;
  attempt: number;
  outputTokens?: number | undefined;
}

export interface QualityJobPlan {
  schema_version: "1.0.0";
  tier: QualityJobPlanTier;
  prompt_mode: "job-specific";
  candidate_count: 1 | 2;
  maximum_correction_attempts: 1;
  maximum_repair_attempts: 0 | 2;
  jobs: QualityJobPlanJob[];
  deferred_job_ids: QualityJobId[];
  limits: QualityJobPlanLimits;
  planned_model_calls: number;
  planned_generated_tokens: number;
}

const LIMITS: Record<QualityJobPlanTier, QualityJobPlanLimits> = {
  economy: { maximum_model_calls: 4, maximum_generated_tokens: 10_800 },
  balanced: { maximum_model_calls: 18, maximum_generated_tokens: 38_000 },
  premium: { maximum_model_calls: 28, maximum_generated_tokens: 54_000 },
  editorial: { maximum_model_calls: 30, maximum_generated_tokens: 56_400 },
};

const OUTPUT_TOKENS: Record<QualityJobId, number> = {
  "compile-contract": 0,
  "plan-scene": 1_200,
  "draft-scene": 4_200,
  "candidate-selection": 1_000,
  "deterministic-validation": 0,
  "critic-combined": 1_200,
  "critic-continuity": 1_000,
  "critic-causality": 1_000,
  "critic-character-intent": 1_000,
  "critic-style": 1_000,
  "extract-factual-claims": 1_000,
  "critic-factuality": 1_000,
  "repair-factuality": 4_200,
  "patch-spans": 1_500,
  "synthesize-event-output": 4_200,
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

const SPECIALIST_CRITICS: QualityJobId[] = [
  "critic-continuity",
  "critic-causality",
  "critic-character-intent",
  "critic-style",
];

function job(
  id: QualityJobId,
  kind: QualityJobKind,
  options: {
    maximumCalls?: number;
    maximumAttempts?: number;
    conditional?: boolean;
    scope?: QualityJobScope;
  } = {},
): QualityJobPlanJob {
  return {
    id,
    kind,
    scope: options.scope ?? (kind === "human" ? "human" : "chapter"),
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

function addCandidateSelection(jobs: QualityJobPlanJob[], candidateCount: 1 | 2): void {
  if (candidateCount !== 2) return;
  insertBefore(jobs, "deterministic-validation", [job("candidate-selection", "model")]);
}

function addEditorialBookJobs(jobs: QualityJobPlanJob[], risk: QualityJobPlanRisk): void {
  jobs.push(
    job("review-book-chronology", "model", { scope: "book" }),
    job("review-book-knowledge", "model", { scope: "book" }),
    job("review-book-character-arcs", "model", { scope: "book" }),
    job("review-book-setup-payoff", "model", { scope: "book" }),
    job("review-book-object-location", "model", { scope: "book" }),
    job("review-book-terminology", "model", { scope: "book" }),
    job("review-book-research", "model", { conditional: true, scope: "book" }),
    job("review-book-style-drift", "model", { scope: "book" }),
    job("review-book-repetition", "model", { scope: "book" }),
    ...(risk.unresolved_blocker
      ? [job("stronger-model-escalation", "model", { conditional: true, scope: "book" })]
      : []),
    job("human-escalation", "human", { conditional: true, scope: "human" }),
  );
}

function planJobs(tier: QualityJobPlanTier, risk: QualityJobPlanRisk, candidateCount: 1 | 2): QualityJobPlanJob[] {
  const jobs = economyJobs(candidateCount);
  addCandidateSelection(jobs, candidateCount);

  const factualityJobs = risk.factuality_required && tier !== "economy"
    ? [
        job("extract-factual-claims", "model", { maximumCalls: 2 }),
        job("critic-factuality", "model", { maximumCalls: 2 }),
        job("repair-factuality", "model", { maximumCalls: 1, maximumAttempts: 1, conditional: true }),
      ]
    : [];

  if (tier === "balanced") {
    insertBefore(jobs, "scene-accept", [
      job("critic-combined", "model"),
      job("synthesize-event-output", "model"),
      ...factualityJobs,
    ]);
  }

  if (tier === "premium" || tier === "editorial") {
    insertBefore(jobs, "scene-accept", [
      ...SPECIALIST_CRITICS.map((id) => job(id, "model")),
      job("synthesize-event-output", "model"),
      ...factualityJobs,
    ]);
  }

  if (tier === "editorial") {
    insertBefore(jobs, "chapter-commit", [job("verify-chapter", "model")]);
    addEditorialBookJobs(jobs, risk);
  }
  return jobs;
}

function plannedChapterModelJobs(jobs: readonly QualityJobPlanJob[]): QualityJobPlanJob[] {
  return jobs.filter((item) => item.scope === "chapter" && item.kind === "model" && !item.conditional);
}

export function qualityJobPlanLimits(tier: QualityJobPlanTier): QualityJobPlanLimits {
  return { ...LIMITS[tier] };
}

export function parseQualityJobPlanTier(value: string): QualityJobPlanTier {
  if (value === "economy" || value === "balanced" || value === "premium" || value === "editorial") return value;
  throw new Error(`Unknown quality tier: ${value}.`);
}

export function qualityJobPlanHas(plan: QualityJobPlan, id: QualityJobId): boolean {
  return plan.jobs.some((item) => item.id === id);
}

export function initialQualityJobPlanUsage(): QualityJobPlanUsage {
  return { model_calls: 0, generated_tokens: 0, job_calls: {} };
}

export function assertQualityJobPlanCallAllowed(
  plan: QualityJobPlan,
  current: QualityJobPlanUsage,
  call: Pick<QualityJobPlanCall, "jobId" | "attempt">,
): void {
  const scheduled = plan.jobs.find((item) => item.id === call.jobId);
  if (!scheduled || scheduled.kind !== "model" || scheduled.scope !== "chapter") {
    throw new Error(`Quality job ${call.jobId} is not a scheduled chapter model job.`);
  }
  if (!Number.isInteger(call.attempt) || call.attempt < 1 || call.attempt > 1 + plan.maximum_correction_attempts) {
    throw new Error(`Quality job ${call.jobId} correction attempt exceeds the plan allowance.`);
  }
  const jobUsage = current.job_calls[call.jobId] ?? { primary: 0, corrections: 0 };
  if (call.attempt === 1 && jobUsage.primary >= scheduled.maximum_calls) {
    throw new Error(`Quality job ${call.jobId} primary-call ceiling of ${scheduled.maximum_calls} exceeded.`);
  }
  if (call.attempt > 1 && jobUsage.corrections >= jobUsage.primary * plan.maximum_correction_attempts) {
    throw new Error(`Quality job ${call.jobId} has no primary call available for correction attempt ${call.attempt}.`);
  }
  if (current.model_calls + 1 > plan.limits.maximum_model_calls) {
    throw new Error(`Quality job plan model-call ceiling exceeded for ${plan.tier}.`);
  }
}

export function recordQualityJobPlanUsage(
  plan: QualityJobPlan,
  current: QualityJobPlanUsage,
  call: QualityJobPlanCall,
): QualityJobPlanUsage {
  assertQualityJobPlanCallAllowed(plan, current, call);
  const outputTokens = call.outputTokens ?? 0;
  if (!Number.isInteger(outputTokens) || outputTokens < 0) throw new Error("Quality job plan output tokens must be a non-negative integer.");
  const previousJobUsage = current.job_calls[call.jobId] ?? { primary: 0, corrections: 0 };
  const next = {
    model_calls: current.model_calls + 1,
    generated_tokens: current.generated_tokens + outputTokens,
    job_calls: {
      ...current.job_calls,
      [call.jobId]: {
        primary: previousJobUsage.primary + Number(call.attempt === 1),
        corrections: previousJobUsage.corrections + Number(call.attempt > 1),
      },
    },
  };
  if (next.generated_tokens > plan.limits.maximum_generated_tokens) {
    throw new Error(`Quality job plan generated-token ceiling exceeded for ${plan.tier}.`);
  }
  return next;
}

export function buildQualityJobPlan(input: {
  tier: QualityJobPlanTier;
  keySceneCandidates?: number;
  risk?: QualityJobPlanRisk;
}): QualityJobPlan {
  const maximumCorrectionAttempts = 1;
  const risk = input.risk ?? {};
  const configuredCandidates = input.keySceneCandidates ?? 2;
  if (!Number.isInteger(configuredCandidates) || configuredCandidates < 1 || configuredCandidates > 2) {
    throw new Error("Quality job plan key-scene candidates must be one or two.");
  }
  const candidateCount: 1 | 2 = risk.key_scene && (input.tier === "premium" || input.tier === "editorial")
    ? configuredCandidates as 1 | 2
    : 1;
  const jobs = planJobs(input.tier, risk, candidateCount);
  const plannedJobs = plannedChapterModelJobs(jobs);
  const plannedModelCalls = plannedJobs.reduce((sum, item) => sum + item.maximum_calls, 0);
  const plannedGeneratedTokens = plannedJobs.reduce(
    (sum, item) => sum + item.maximum_calls * item.estimated_output_tokens,
    0,
  );
  const limits = qualityJobPlanLimits(input.tier);
  if (plannedModelCalls > limits.maximum_model_calls) {
    throw new Error(`Quality job plan requires ${plannedModelCalls} model calls, above the ${limits.maximum_model_calls}-call ${input.tier} ceiling.`);
  }
  if (plannedGeneratedTokens > limits.maximum_generated_tokens) {
    throw new Error(`Quality job plan requires ${plannedGeneratedTokens} generated tokens, above the ${limits.maximum_generated_tokens}-token ${input.tier} ceiling.`);
  }
  const conditionalChapterJobs = jobs.filter((item) => item.scope === "chapter" && item.kind === "model" && item.conditional);
  const declaredChapterJobs = [...plannedJobs, ...conditionalChapterJobs];
  const attemptsPerCall = 1 + maximumCorrectionAttempts;
  const declaredModelCalls = declaredChapterJobs.reduce((sum, item) => sum + item.maximum_calls, 0) * attemptsPerCall;
  const declaredGeneratedTokens = declaredChapterJobs.reduce(
    (sum, item) => sum + item.maximum_calls * item.estimated_output_tokens,
    0,
  ) * attemptsPerCall;
  if (declaredModelCalls > limits.maximum_model_calls) {
    throw new Error(`Quality job plan declares ${declaredModelCalls} model calls including corrections and conditional repairs, above the ${limits.maximum_model_calls}-call ${input.tier} ceiling.`);
  }
  if (declaredGeneratedTokens > limits.maximum_generated_tokens) {
    throw new Error(`Quality job plan declares ${declaredGeneratedTokens} generated tokens including corrections and conditional repairs, above the ${limits.maximum_generated_tokens}-token ${input.tier} ceiling.`);
  }
  return {
    schema_version: "1.0.0",
    tier: input.tier,
    prompt_mode: "job-specific",
    candidate_count: candidateCount,
    maximum_correction_attempts: maximumCorrectionAttempts,
    maximum_repair_attempts: input.tier === "economy" ? 0 : 2,
    jobs,
    deferred_job_ids: jobs.filter((item) => item.scope !== "chapter").map((item) => item.id),
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
    deferred_job_ids: plan.deferred_job_ids,
    limits: plan.limits,
    planned_model_calls: plan.planned_model_calls,
    planned_generated_tokens: plan.planned_generated_tokens,
    jobs: plan.jobs.map((item) => ({
      id: item.id,
      kind: item.kind,
      scope: item.scope,
      maximum_calls: item.maximum_calls,
      maximum_attempts: item.maximum_attempts,
      estimated_output_tokens: item.estimated_output_tokens,
      conditional: item.conditional,
    })),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

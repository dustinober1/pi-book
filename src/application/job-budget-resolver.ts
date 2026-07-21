import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { ModelJobType } from "../domain/model-job.js";

export function resolveJobPolicy(profile: ModelExecutionProfile, jobType: ModelJobType) {
  return { budget: profile.job_budgets[jobType], decoding: profile.decoding[jobType] };
}

export function assertEvidenceWithinJobBudget(profile: ModelExecutionProfile, jobType: ModelJobType, evidenceTokens: number): void {
  const maximum = profile.job_budgets[jobType].maximumEvidenceTokens;
  if (!Number.isInteger(evidenceTokens) || evidenceTokens < 0) throw new Error("Evidence token count must be a non-negative integer.");
  if (evidenceTokens > maximum) throw new Error(`${jobType} evidence exceeds the ${maximum}-token job budget before inference.`);
}

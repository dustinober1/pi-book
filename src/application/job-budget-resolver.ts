import type {
  DecodingPolicy,
  JobBudgetPolicy,
  ModelExecutionProfile,
} from "../domain/model-execution-profile.js";
import type { ModelJobType } from "../domain/model-job.js";

export interface ResolveJobExecutionPolicyInput {
  profile: ModelExecutionProfile;
  jobType: ModelJobType;
  instructionTokens: number;
  evidenceTokens: number;
}

export interface ResolvedJobExecutionPolicy {
  profileId: ModelExecutionProfile["id"];
  jobType: ModelJobType;
  budget: JobBudgetPolicy;
  decoding: DecodingPolicy;
}

function nonnegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
}

export function resolveJobExecutionPolicy(input: ResolveJobExecutionPolicyInput): ResolvedJobExecutionPolicy {
  nonnegativeInteger(input.instructionTokens, "Instruction tokens");
  nonnegativeInteger(input.evidenceTokens, "Evidence tokens");
  const budget = input.profile.job_budgets[input.jobType];
  const decoding = input.profile.decoding[input.jobType];
  if (!budget || !decoding) throw new Error(`Model execution profile ${input.profile.id} does not define ${input.jobType}.`);
  if (input.instructionTokens > budget.maximumInstructionTokens) {
    throw new Error(`${input.jobType} instructions exceed the job budget before inference.`);
  }
  if (input.evidenceTokens > budget.maximumEvidenceTokens) {
    throw new Error(`${input.jobType} evidence exceeds the job budget before inference.`);
  }
  if (budget.reservedOutputTokens > input.profile.maximum_output_tokens || decoding.maximumOutputTokens > input.profile.maximum_output_tokens) {
    throw new Error(`${input.jobType} output reserve exceeds model profile ${input.profile.id}.`);
  }
  const total = input.instructionTokens + input.evidenceTokens + budget.reservedOutputTokens + budget.safetyMarginTokens;
  if (total > input.profile.reliable_context_tokens) {
    throw new Error(`${input.jobType} exceeds the reliable context budget before inference.`);
  }
  return {
    profileId: input.profile.id,
    jobType: input.jobType,
    budget,
    decoding,
  };
}

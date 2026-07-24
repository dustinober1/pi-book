import type {
  ModelExecutionProfile,
  TokenEstimationPolicy,
} from "../domain/model-execution-profile.js";
import type { ModelJobType } from "../domain/model-job.js";
import {
  appendTokenEstimatorCalibration,
  readTokenEstimatorRunReport,
} from "../infrastructure/token-estimator-report-store.js";
import { resolveJobExecutionPolicy } from "./job-budget-resolver.js";

export type { TokenEstimationPolicy } from "../domain/model-execution-profile.js";

export interface ModelTokenEstimateCounts {
  instructionTokens: number;
  evidenceTokens: number;
  totalReservedTokens: number;
}

export interface ModelTokenCalibrationTelemetry {
  estimatedInstructionTokens: number;
  estimatedEvidenceTokens: number;
  totalReservedTokens: number;
  inputTokenEstimateRatio?: number;
  escalationCode?: "token-estimator-underflow";
  outcome?: "escalated";
}

const underflowedRuns = new Set<string>();

function runKey(root: string | undefined, runId: string): string {
  return root ? `${root}\u0000${runId}` : runId;
}

function positiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive.`);
  return value;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

export function estimateModelTokens(text: string, policy: TokenEstimationPolicy): number {
  const bytesPerToken = positiveFinite(policy.utf8_bytes_per_token, "UTF-8 bytes per token");
  const envelope = nonnegativeInteger(policy.fixed_envelope_tokens, "Fixed token envelope");
  return Math.ceil(Buffer.byteLength(text, "utf8") / bytesPerToken) + envelope;
}

export function assertModelJobFits(input: {
  root?: string;
  runId?: string;
  instruction: string;
  evidence: string;
  profile: ModelExecutionProfile;
  jobType: ModelJobType;
}): ModelTokenEstimateCounts {
  if (input.runId) {
    const underflowed = underflowedRuns.has(runKey(input.root, input.runId))
      || (input.root !== undefined
        && readTokenEstimatorRunReport(input.root, input.runId)?.calibrations
          .some((item) => item.escalationCode === "token-estimator-underflow"));
    if (underflowed) {
      throw new Error(`Run ${input.runId} is blocked after a token estimator underflow.`);
    }
  }
  const instructionTokens = estimateModelTokens(input.instruction, input.profile.token_estimation);
  const evidenceTokens = estimateModelTokens(input.evidence, input.profile.token_estimation);
  const budget = input.profile.job_budgets[input.jobType];
  if (!budget) throw new Error(`Model execution profile ${input.profile.id} does not define ${input.jobType}.`);
  const totalReservedTokens = instructionTokens
    + evidenceTokens
    + budget.reservedOutputTokens
    + budget.safetyMarginTokens;
  if (totalReservedTokens > input.profile.reliable_context_tokens) {
    throw new Error(`${input.jobType} exceeds the reliable context budget before inference.`);
  }
  resolveJobExecutionPolicy({
    profile: input.profile,
    jobType: input.jobType,
    instructionTokens,
    evidenceTokens,
  });
  return { instructionTokens, evidenceTokens, totalReservedTokens };
}

export function recordModelTokenCalibration(input: {
  root?: string;
  runId: string;
  callId?: string;
  profile: ModelExecutionProfile;
  counts: ModelTokenEstimateCounts;
  actualInputTokens?: number;
}): ModelTokenCalibrationTelemetry {
  const telemetry: ModelTokenCalibrationTelemetry = {
    estimatedInstructionTokens: input.counts.instructionTokens,
    estimatedEvidenceTokens: input.counts.evidenceTokens,
    totalReservedTokens: input.counts.totalReservedTokens,
  };
  if (input.actualInputTokens !== undefined) {
    const actualInputTokens = nonnegativeInteger(input.actualInputTokens, "Actual input tokens");
    const estimatedInputTokens = input.counts.instructionTokens + input.counts.evidenceTokens;
    const inputTokenEstimateRatio = actualInputTokens / estimatedInputTokens;
    telemetry.inputTokenEstimateRatio = inputTokenEstimateRatio;
    const allowance = positiveFinite(
      input.profile.token_estimation.maximum_observed_underestimate_ratio,
      "Maximum observed underestimate ratio",
    );
    if (inputTokenEstimateRatio > allowance) {
      underflowedRuns.add(runKey(input.root, input.runId));
      telemetry.escalationCode = "token-estimator-underflow";
      telemetry.outcome = "escalated";
    }
  }
  if (input.root !== undefined) {
    if (!input.callId) throw new Error("Token estimator run telemetry requires a call ID.");
    appendTokenEstimatorCalibration(input.root, input.runId, {
      callId: input.callId,
      policyId: input.profile.token_estimation.id,
      estimatedInstructionTokens: telemetry.estimatedInstructionTokens,
      estimatedEvidenceTokens: telemetry.estimatedEvidenceTokens,
      totalReservedTokens: telemetry.totalReservedTokens,
      ...(input.actualInputTokens !== undefined ? { actualInputTokens: input.actualInputTokens } : {}),
      ...(telemetry.inputTokenEstimateRatio !== undefined ? { inputTokenEstimateRatio: telemetry.inputTokenEstimateRatio } : {}),
      ...(telemetry.escalationCode !== undefined ? { escalationCode: telemetry.escalationCode } : {}),
    });
  }
  return telemetry;
}

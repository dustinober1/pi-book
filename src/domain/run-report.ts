import { Type, type Static } from "@sinclair/typebox";
import { ModelExecutionProfileIdSchema } from "./model-execution-profile.js";
import { ModelJobTypeSchema } from "./model-job.js";
import { QualityTierIdSchema } from "./quality-profile.js";
import { RuntimeProfileIdSchema } from "./runtime-profile.js";

export const RunMetricSchema = Type.Object({
  label: Type.String({ minLength: 1 }),
  elapsedMs: Type.Number({ minimum: 0 }),
  rssBytes: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false });
export type RunMetric = Static<typeof RunMetricSchema>;

export const RunValidationFailureSchema = Type.Object({
  path: Type.Optional(Type.String({ minLength: 1 })),
  category: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type RunValidationFailure = Static<typeof RunValidationFailureSchema>;

export const QualityPassKindSchema = Type.Union([
  Type.Literal("plan"),
  Type.Literal("candidate"),
  Type.Literal("critic"),
  Type.Literal("revision"),
  Type.Literal("verification"),
]);
export type QualityPassKind = Static<typeof QualityPassKindSchema>;

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ModelCallOutcomeSchema = Type.Union([
  Type.Literal("accepted"),
  Type.Literal("rejected"),
  Type.Literal("repair-succeeded"),
  Type.Literal("escalated"),
]);
export type ModelCallOutcome = Static<typeof ModelCallOutcomeSchema>;

export const ModelCallReportSchema = Type.Object({
  callId: Type.String({ minLength: 1 }),
  stage: Type.String({ minLength: 1 }),
  chapter: Type.Optional(Type.Integer({ minimum: 1 })),
  pass: QualityPassKindSchema,
  jobType: Type.Optional(ModelJobTypeSchema),
  sceneId: Type.Optional(Type.String({ minLength: 1 })),
  attempt: Type.Optional(Type.Integer({ minimum: 1 })),
  contractHash: Type.Optional(HashSchema),
  capsuleHash: Type.Optional(HashSchema),
  includedRecordCount: Type.Optional(Type.Integer({ minimum: 0 })),
  validationCategoryCounts: Type.Optional(Type.Record(Type.String({ minLength: 1 }), Type.Integer({ minimum: 0 }))),
  patchOperationCount: Type.Optional(Type.Integer({ minimum: 0 })),
  escalationCode: Type.Optional(Type.String({ pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$" })),
  outcome: Type.Optional(ModelCallOutcomeSchema),
  acceptedProseWords: Type.Optional(Type.Integer({ minimum: 0 })),
  provider: Type.Optional(Type.String({ minLength: 1 })),
  model: Type.Optional(Type.String({ minLength: 1 })),
  inputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
  cachedInputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
  outputTokens: Type.Optional(Type.Integer({ minimum: 0 })),
  reasoningTokens: Type.Optional(Type.Integer({ minimum: 0 })),
  estimated: Type.Boolean(),
  costUsd: Type.Optional(Type.Number({ minimum: 0 })),
  elapsedMs: Type.Number({ minimum: 0 }),
  finishReason: Type.Optional(Type.String({ minLength: 1 })),
  promptHash: HashSchema,
  contextHash: HashSchema,
  outputHash: HashSchema,
}, { additionalProperties: false });
export type ModelCallReport = Static<typeof ModelCallReportSchema>;

export const RunTokenTotalsSchema = Type.Object({
  inputTokens: Type.Integer({ minimum: 0 }),
  cachedInputTokens: Type.Integer({ minimum: 0 }),
  outputTokens: Type.Integer({ minimum: 0 }),
  reasoningTokens: Type.Integer({ minimum: 0 }),
  totalTokens: Type.Integer({ minimum: 0 }),
  costUsd: Type.Number({ minimum: 0 }),
  estimatedCalls: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false });
export type RunTokenTotals = Static<typeof RunTokenTotalsSchema>;

export const WorkflowTelemetrySchema = Type.Object({
  jobs: Type.Integer({ minimum: 0 }),
  firstPassAccepted: Type.Integer({ minimum: 0 }),
  repairsAttempted: Type.Integer({ minimum: 0 }),
  repairsSucceeded: Type.Integer({ minimum: 0 }),
  acceptedProseWords: Type.Integer({ minimum: 0 }),
  acceptedWordsPerGeneratedToken: Type.Number({ minimum: 0 }),
}, { additionalProperties: false });
export type WorkflowTelemetry = Static<typeof WorkflowTelemetrySchema>;

export function summarizeWorkflowTelemetry(calls: readonly ModelCallReport[]): WorkflowTelemetry {
  const jobs = calls.filter((call) => call.jobType !== undefined);
  const acceptedProseWords = jobs
    .filter((call) => call.outcome === "accepted" || call.outcome === "repair-succeeded")
    .reduce((sum, call) => sum + (call.acceptedProseWords ?? 0), 0);
  const generatedTokens = jobs.reduce((sum, call) => sum + (call.outputTokens ?? 0), 0);
  return {
    jobs: jobs.filter((call) => (call.attempt ?? 1) === 1).length,
    firstPassAccepted: jobs.filter((call) => call.outcome === "accepted" && (call.attempt ?? 1) === 1).length,
    repairsAttempted: jobs.filter((call) => call.jobType === "patch-spans" || (call.attempt ?? 1) > 1).length,
    repairsSucceeded: jobs.filter((call) => call.outcome === "repair-succeeded").length,
    acceptedProseWords,
    acceptedWordsPerGeneratedToken: generatedTokens > 0
      ? Number((acceptedProseWords / generatedTokens).toFixed(6))
      : 0,
  };
}

export const RunBudgetEventSchema = Type.Object({
  type: Type.Union([Type.Literal("stop"), Type.Literal("downgrade")]),
  reason: Type.String({ minLength: 1 }),
  atCallId: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type RunBudgetEvent = Static<typeof RunBudgetEventSchema>;

export const RunReportV1Schema = Type.Object({
  schemaVersion: Type.Literal("1.0.0"),
  runId: Type.String({ minLength: 1 }),
  runtimeProfile: RuntimeProfileIdSchema,
  adapterId: Type.Optional(Type.String({ minLength: 1 })),
  model: Type.Optional(Type.String({ minLength: 1 })),
  promptChars: Type.Integer({ minimum: 0 }),
  contextChars: Type.Integer({ minimum: 0 }),
  estimatedInputTokens: Type.Integer({ minimum: 0 }),
  changedFileCount: Type.Integer({ minimum: 0 }),
  changedBytes: Type.Integer({ minimum: 0 }),
  repairAttempts: Type.Integer({ minimum: 0 }),
  validationFailures: Type.Array(RunValidationFailureSchema),
  metrics: Type.Array(RunMetricSchema),
  projectHashBefore: Type.String({ minLength: 1 }),
  projectHashAfter: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type RunReportV1 = Static<typeof RunReportV1Schema>;

export const RunReportV2Schema = Type.Object({
  schemaVersion: Type.Literal("2.0.0"),
  runId: Type.String({ minLength: 1 }),
  runtimeProfile: RuntimeProfileIdSchema,
  qualityTier: QualityTierIdSchema,
  modelCalls: Type.Array(ModelCallReportSchema),
  totals: RunTokenTotalsSchema,
  budgetEvents: Type.Array(RunBudgetEventSchema),
  projectHashBefore: Type.String({ minLength: 1 }),
  projectHashAfter: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type RunReportV2 = Static<typeof RunReportV2Schema>;

export const RunReportV3Schema = Type.Object({
  schemaVersion: Type.Literal("3.0.0"),
  runId: Type.String({ minLength: 1 }),
  runtimeProfile: RuntimeProfileIdSchema,
  qualityTier: QualityTierIdSchema,
  modelExecutionProfile: ModelExecutionProfileIdSchema,
  modelCalls: Type.Array(ModelCallReportSchema),
  totals: RunTokenTotalsSchema,
  workflow: WorkflowTelemetrySchema,
  budgetEvents: Type.Array(RunBudgetEventSchema),
  projectHashBefore: Type.String({ minLength: 1 }),
  projectHashAfter: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type RunReportV3 = Static<typeof RunReportV3Schema>;

export const RunReportSchema = Type.Union([RunReportV1Schema, RunReportV2Schema, RunReportV3Schema]);
export type RunReport = Static<typeof RunReportSchema>;

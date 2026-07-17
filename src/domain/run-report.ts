import { Type, type Static } from "@sinclair/typebox";
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

export const RunReportSchema = Type.Object({
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
export type RunReport = Static<typeof RunReportSchema>;

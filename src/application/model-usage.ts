import { createHash } from "node:crypto";
import type { ModelCallReport, QualityPassKind } from "../domain/run-report.js";

export interface ModelUsageFallback {
  callId: string;
  stage: string;
  chapter?: number;
  pass: QualityPassKind;
  prompt: string;
  context: string;
  output: string;
  elapsedMs: number;
  provider?: string;
  model?: string;
  finishReason?: string;
}

type UnknownRecord = Record<string, unknown>;

const SAFE_FINISH_REASONS = new Set([
  "stop",
  "length",
  "max_tokens",
  "tool_calls",
  "tool_use",
  "content_filter",
  "end_turn",
  "error",
  "cancelled",
  "timeout",
  "unknown",
]);

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function nonnegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function tokenInteger(value: unknown): number | undefined {
  const number = nonnegativeNumber(value);
  return number === undefined ? undefined : Math.round(number);
}

function nonblank(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const normalized = tokenInteger(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
}

function firstDecimal(...values: unknown[]): number | undefined {
  for (const value of values) {
    const normalized = nonnegativeNumber(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = nonblank(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
}

function safeFinishReason(...values: unknown[]): string | undefined {
  const raw = firstString(...values);
  if (!raw) return undefined;
  const normalized = raw.toLocaleLowerCase("en-US").replace(/[\s-]+/g, "_");
  return SAFE_FINISH_REASONS.has(normalized) ? normalized : "other";
}

export function normalizedContentHash(content: string): string {
  return createHash("sha256").update(content.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}

export function normalizeModelUsage(rawValue: unknown, fallback: ModelUsageFallback): ModelCallReport {
  const raw = record(rawValue);
  const usage = record(raw.usage);
  const inputDetails = record(
    raw.input_tokens_details
    ?? usage.input_tokens_details
    ?? raw.inputTokensDetails
    ?? usage.inputTokensDetails
    ?? raw.prompt_tokens_details
    ?? usage.prompt_tokens_details
    ?? raw.promptTokensDetails
    ?? usage.promptTokensDetails,
  );
  const outputDetails = record(
    raw.output_tokens_details
    ?? usage.output_tokens_details
    ?? raw.outputTokensDetails
    ?? usage.outputTokensDetails
    ?? raw.completion_tokens_details
    ?? usage.completion_tokens_details
    ?? raw.completionTokensDetails
    ?? usage.completionTokensDetails,
  );

  const actualInputTokens = firstNumber(
    raw.inputTokens,
    usage.inputTokens,
    raw.input_tokens,
    usage.input_tokens,
    raw.promptTokens,
    usage.promptTokens,
    raw.prompt_tokens,
    usage.prompt_tokens,
  );
  const actualOutputTokens = firstNumber(
    raw.outputTokens,
    usage.outputTokens,
    raw.output_tokens,
    usage.output_tokens,
    raw.completionTokens,
    usage.completionTokens,
    raw.completion_tokens,
    usage.completion_tokens,
  );
  const cachedInputTokens = firstNumber(
    inputDetails.cachedTokens,
    inputDetails.cached_tokens,
    raw.cachedInputTokens,
    usage.cachedInputTokens,
    raw.cached_input_tokens,
    usage.cached_input_tokens,
  );
  const reasoningTokens = firstNumber(
    outputDetails.reasoningTokens,
    outputDetails.reasoning_tokens,
    raw.reasoningTokens,
    usage.reasoningTokens,
    raw.reasoning_tokens,
    usage.reasoning_tokens,
  );
  const costUsd = firstDecimal(raw.costUsd, usage.costUsd, raw.cost_usd, usage.cost_usd, raw.cost, usage.cost);
  const estimatedInputTokens = Math.ceil((fallback.prompt.length + fallback.context.length) / 4);
  const estimatedOutputTokens = Math.ceil(fallback.output.length / 4);
  const estimated = actualInputTokens === undefined || actualOutputTokens === undefined;
  const provider = firstString(raw.provider, usage.provider, fallback.provider);
  const model = firstString(raw.model, usage.model, fallback.model);
  const finishReason = safeFinishReason(raw.finishReason, usage.finishReason, raw.finish_reason, usage.finish_reason, fallback.finishReason);

  return {
    callId: fallback.callId.trim(),
    stage: fallback.stage.trim(),
    ...(fallback.chapter !== undefined ? { chapter: fallback.chapter } : {}),
    pass: fallback.pass,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    inputTokens: actualInputTokens ?? estimatedInputTokens,
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    outputTokens: actualOutputTokens ?? estimatedOutputTokens,
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    estimated,
    ...(costUsd !== undefined ? { costUsd } : {}),
    elapsedMs: Math.max(0, fallback.elapsedMs),
    ...(finishReason ? { finishReason } : {}),
    promptHash: normalizedContentHash(fallback.prompt),
    contextHash: normalizedContentHash(fallback.context),
    outputHash: normalizedContentHash(fallback.output),
  };
}

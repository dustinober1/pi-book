import { randomUUID } from "node:crypto";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { transactBudgetLedger } from "../infrastructure/budget-ledger-store.js";
import { appendModelCallReport, storeRunReport } from "../infrastructure/run-report-store.js";
import { recordSettledBudgetCall } from "./budget-ledger.js";
import { projectStateHash } from "./events.js";
import { normalizeModelUsage } from "./model-usage.js";
import { createRunReportHeader } from "./run-telemetry.js";

interface EconomyPendingTurn {
  root: string;
  runId: string;
  callId: string;
  chapter: number;
  runtimeProfile: RuntimeProfileId;
  startedMs: number;
  prompt: string;
  provider?: string;
  model?: string;
}

export interface ForegroundEconomyTelemetryOptions {
  now?: () => number;
  runId?: () => string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function assistantText(messageValue: unknown): string {
  const message = record(messageValue);
  if (message.role !== "assistant") return "";
  const content = Array.isArray(message.content) ? message.content : [];
  return content
    .map(record)
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => String(item.text))
    .join("");
}

function usagePayload(messageValue: unknown, contextTokens: number | null | undefined): {
  payload: Record<string, unknown>;
  usedContextEstimate: boolean;
} {
  const message = record(messageValue);
  const usage = record(message.usage);
  const input = finite(usage.input);
  const cacheRead = finite(usage.cacheRead);
  const cacheWrite = finite(usage.cacheWrite);
  const output = finite(usage.output);
  const reasoning = finite(usage.reasoning);
  const cost = record(usage.cost);
  const knownInput = input === undefined && cacheRead === undefined && cacheWrite === undefined
    ? undefined
    : (input ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
  const contextEstimate = knownInput === undefined && contextTokens !== null && contextTokens !== undefined ? contextTokens : undefined;
  return {
    payload: {
      ...(knownInput !== undefined ? { inputTokens: knownInput } : contextEstimate !== undefined ? { inputTokens: contextEstimate } : {}),
      ...(cacheRead !== undefined ? { cachedInputTokens: cacheRead } : {}),
      ...(output !== undefined ? { outputTokens: output } : {}),
      ...(reasoning !== undefined ? { reasoningTokens: reasoning } : {}),
      ...(finite(cost.total) !== undefined ? { costUsd: finite(cost.total) } : {}),
      ...(typeof message.provider === "string" ? { provider: message.provider } : {}),
      ...(typeof message.model === "string" ? { model: message.model } : {}),
      ...(typeof message.stopReason === "string" ? { finishReason: message.stopReason } : {}),
    },
    usedContextEstimate: contextEstimate !== undefined,
  };
}

export class ForegroundEconomyTelemetry {
  readonly #now: () => number;
  readonly #runId: () => string;
  #pending: EconomyPendingTurn | null = null;

  constructor(options: ForegroundEconomyTelemetryOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#runId = options.runId ?? (() => `ECO-${this.#now()}-${randomUUID()}`);
  }

  get active(): boolean {
    return this.#pending !== null;
  }

  begin(input: {
    root: string;
    chapter: number;
    runtimeProfile: RuntimeProfileId;
    telemetryEnabled?: boolean;
  }): string | null {
    if (input.telemetryEnabled === false) {
      this.#pending = null;
      return null;
    }
    if (!Number.isInteger(input.chapter) || input.chapter < 1) throw new Error("Economy telemetry chapter must be positive.");
    const runId = this.#runId();
    const callId = `${runId}-CALL-001`;
    const stored = storeRunReport(input.root, createRunReportHeader({
      runId,
      runtimeProfile: input.runtimeProfile,
      qualityTier: "economy",
      projectHashBefore: projectStateHash(input.root),
    }));
    if (!stored.ok) throw new Error(stored.message);
    this.#pending = {
      root: input.root,
      runId,
      callId,
      chapter: input.chapter,
      runtimeProfile: input.runtimeProfile,
      startedMs: this.#now(),
      prompt: "",
    };
    return runId;
  }

  capturePrompt(prompt: string): void {
    if (this.#pending) this.#pending.prompt = prompt;
  }

  captureModel(modelValue: unknown): void {
    if (!this.#pending) return;
    const model = record(modelValue);
    const provider = typeof model.provider === "string" ? model.provider.trim() : "";
    const id = typeof model.id === "string" ? model.id.trim() : typeof model.model === "string" ? model.model.trim() : "";
    if (provider) this.#pending.provider = provider;
    if (id) this.#pending.model = id;
  }

  cancel(): void {
    this.#pending = null;
  }

  complete(message: unknown, contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null }): void {
    const pending = this.#pending;
    this.#pending = null;
    if (!pending) return;
    const output = assistantText(message);
    if (!output) return;
    const messageRecord = record(message);
    const raw = usagePayload(message, contextUsage?.tokens);
    const normalized = normalizeModelUsage(raw.payload, {
      callId: pending.callId,
      stage: "drafting",
      chapter: pending.chapter,
      pass: "candidate",
      prompt: pending.prompt,
      context: JSON.stringify(contextUsage ?? {}),
      output,
      elapsedMs: Math.max(0, this.#now() - pending.startedMs),
      ...(pending.provider ? { provider: pending.provider } : {}),
      ...(pending.model ? { model: pending.model } : {}),
      ...(typeof messageRecord.stopReason === "string" ? { finishReason: messageRecord.stopReason } : {}),
    });
    const usage = raw.usedContextEstimate ? { ...normalized, estimated: true } : normalized;
    const appended = appendModelCallReport(pending.root, pending.runId, usage);
    if (!appended.ok) return;
    transactBudgetLedger(pending.root, (ledger) => ({
      ledger: recordSettledBudgetCall(ledger, {
        runId: pending.runId,
        callId: pending.callId,
        chapter: pending.chapter,
        tier: "economy",
        tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        estimated: usage.estimated,
        settledAt: new Date(this.#now()).toISOString(),
      }),
      value: undefined,
    }));
  }
}

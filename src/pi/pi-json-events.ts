import { normalizeModelUsage } from "../application/model-usage.js";
import type {
  QualityModelCapacity,
  QualityWorkerRequest,
  QualityWorkerResult,
} from "../domain/quality-worker.js";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function finiteNonnegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function textFromAssistant(message: UnknownRecord): string {
  const content = Array.isArray(message.content) ? message.content : [];
  return content
    .map((item) => record(item))
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => String(item.text))
    .join("");
}

function assistantFromEvent(event: UnknownRecord): UnknownRecord | null {
  if (event.type === "message_end" || event.type === "turn_end") {
    const message = record(event.message);
    return message.role === "assistant" ? message : null;
  }
  if (event.type === "agent_end" && Array.isArray(event.messages)) {
    const assistants = event.messages.map(record).filter((message) => message.role === "assistant");
    return assistants.at(-1) ?? null;
  }
  return null;
}

function piUsage(message: UnknownRecord): UnknownRecord {
  const usage = record(message.usage);
  const input = finiteNonnegative(usage.input);
  const cacheRead = finiteNonnegative(usage.cacheRead);
  const cacheWrite = finiteNonnegative(usage.cacheWrite);
  const output = finiteNonnegative(usage.output);
  const reasoning = finiteNonnegative(usage.reasoning);
  const cost = record(usage.cost);
  const totalInput = input === undefined && cacheRead === undefined && cacheWrite === undefined
    ? undefined
    : (input ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
  return {
    ...(totalInput !== undefined ? { inputTokens: totalInput } : {}),
    ...(cacheRead !== undefined ? { cachedInputTokens: cacheRead } : {}),
    ...(output !== undefined ? { outputTokens: output } : {}),
    ...(reasoning !== undefined ? { reasoningTokens } : {}),
    ...(finiteNonnegative(cost.total) !== undefined ? { costUsd: finiteNonnegative(cost.total) } : {}),
    ...(typeof message.provider === "string" ? { provider: message.provider } : {}),
    ...(typeof message.model === "string" ? { model: message.model } : {}),
    ...(typeof message.stopReason === "string" ? { finishReason: message.stopReason } : {}),
  };
}

export function parsePiJsonEvents(
  jsonl: string,
  request: QualityWorkerRequest,
  elapsedMs: number,
): QualityWorkerResult {
  let finalAssistant: UnknownRecord | null = null;
  const lines = jsonl.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    let event: UnknownRecord;
    try {
      event = record(JSON.parse(line));
    } catch {
      throw new Error(`Malformed Pi JSON event at line ${index + 1}.`);
    }
    const assistant = assistantFromEvent(event);
    if (assistant) finalAssistant = assistant;
  }

  if (!finalAssistant) throw new Error("Pi did not emit a final assistant message.");
  const stopReason = typeof finalAssistant.stopReason === "string" ? finalAssistant.stopReason : "unknown";
  if (stopReason === "error" || stopReason === "aborted") {
    throw new Error(`Pi worker stopped with ${stopReason}.`);
  }
  const text = textFromAssistant(finalAssistant);
  if (!text.trim()) throw new Error("Pi did not emit final assistant text.");

  return {
    text,
    usage: normalizeModelUsage(piUsage(finalAssistant), {
      callId: request.callId,
      stage: request.stage,
      ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
      pass: request.pass,
      prompt: request.prompt,
      context: request.context ?? "",
      output: text,
      elapsedMs,
      ...(request.provider ? { provider: request.provider } : {}),
      ...(request.model ? { model: request.model } : {}),
      finishReason: stopReason,
    }),
  };
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function tokenCount(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)([KM])?$/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const multiplier = match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

export function parsePiModelList(
  output: string,
  provider: string | undefined,
  model: string,
): QualityModelCapacity | null {
  const lines = stripAnsi(output).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines.findIndex((line) => /^provider\s{2,}model\s{2,}context\s{2,}max-out\b/i.test(line));
  if (header < 0) return null;
  for (const line of lines.slice(header + 1)) {
    const match = line.match(/^\s*(?:\*\s+)?(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (!match) continue;
    const [, rowProvider, rowModel, context, maxOut] = match;
    if (!rowProvider || !rowModel || rowModel !== model || (provider !== undefined && rowProvider !== provider)) continue;
    const contextWindowTokens = tokenCount(context ?? "");
    const maxOutputTokens = tokenCount(maxOut ?? "");
    if (contextWindowTokens === null || maxOutputTokens === null) return null;
    return { provider: rowProvider, model: rowModel, contextWindowTokens, maxOutputTokens };
  }
  return null;
}

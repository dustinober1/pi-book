import test from "node:test";
import assert from "node:assert/strict";
import { parsePiJsonEvents, parsePiModelList } from "../src/pi/pi-json-events.js";

const request = {
  callId: "CALL-001",
  stage: "drafting",
  chapter: 7,
  pass: "candidate" as const,
  prompt: "PLAN-PROMPT-SENTINEL",
  context: "MANUSCRIPT-CONTEXT-SENTINEL",
  timeoutMs: 1_000,
};

function assistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "private reasoning" },
      { type: "text", text: "Final " },
      { type: "text", text: "chapter" },
    ],
    provider: "openai",
    model: "quality-model",
    usage: {
      input: 900,
      output: 450,
      cacheRead: 300,
      cacheWrite: 20,
      reasoning: 80,
      totalTokens: 1_670,
      cost: { input: 0.004, output: 0.008, cacheRead: 0.001, cacheWrite: 0.0002, total: 0.0132 },
    },
    stopReason: "stop",
    timestamp: 1,
    ...overrides,
  };
}

test("Pi JSON parsing returns only final text and privacy-safe actual usage", () => {
  const jsonl = [
    JSON.stringify({ type: "session", version: 3, id: "session", timestamp: "now", cwd: "/tmp" }),
    JSON.stringify({ type: "message_end", message: assistantMessage() }),
    JSON.stringify({ type: "agent_end", messages: [] }),
  ].join("\n");

  const result = parsePiJsonEvents(jsonl, request, 125);
  assert.equal(result.text, "Final chapter");
  assert.equal(result.usage.inputTokens, 1_220);
  assert.equal(result.usage.cachedInputTokens, 300);
  assert.equal(result.usage.outputTokens, 450);
  assert.equal(result.usage.reasoningTokens, 80);
  assert.equal(result.usage.costUsd, 0.0132);
  assert.equal(result.usage.provider, "openai");
  assert.equal(result.usage.model, "quality-model");
  assert.equal(result.usage.finishReason, "stop");
  assert.equal(result.usage.estimated, false);
  assert.equal(result.usage.elapsedMs, 125);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("PLAN-PROMPT-SENTINEL"), false);
  assert.equal(serialized.includes("MANUSCRIPT-CONTEXT-SENTINEL"), false);
  assert.equal(serialized.includes("private reasoning"), false);
});

test("the last completed assistant message wins", () => {
  const jsonl = [
    JSON.stringify({ type: "message_end", message: assistantMessage({ content: [{ type: "text", text: "older" }] }) }),
    JSON.stringify({ type: "turn_end", message: assistantMessage({ content: [{ type: "text", text: "newest" }] }), toolResults: [] }),
  ].join("\n");
  assert.equal(parsePiJsonEvents(jsonl, request, 1).text, "newest");
});

test("malformed streams, missing messages, and failed stops are rejected generically", () => {
  assert.throws(() => parsePiJsonEvents("{not-json}", request, 1), /Malformed Pi JSON event at line 1/);
  assert.throws(() => parsePiJsonEvents(JSON.stringify({ type: "agent_end", messages: [] }), request, 1), /final assistant message/i);
  const failed = JSON.stringify({ type: "message_end", message: assistantMessage({ stopReason: "error", errorMessage: "RAW-SECRET-SENTINEL" }) });
  assert.throws(() => parsePiJsonEvents(failed, request, 1), (error: unknown) => {
    assert.match(String(error), /stopped with error/i);
    assert.doesNotMatch(String(error), /RAW-SECRET-SENTINEL/);
    return true;
  });
});

test("model-list parsing requires an exact provider and model match", () => {
  const output = [
    "provider  model                  context  max-out  thinking  images",
    "openai    quality-model          128K     32K      yes       no",
    "openai    quality-model-preview  1.0M     64K      yes       no",
    "anthropic quality-model          200K     64K      yes       no",
  ].join("\n");
  assert.deepEqual(parsePiModelList(output, "openai", "quality-model"), {
    provider: "openai",
    model: "quality-model",
    contextWindowTokens: 128_000,
    maxOutputTokens: 32_000,
  });
  assert.equal(parsePiModelList(output, "google", "quality-model"), null);
  assert.equal(parsePiModelList("No models matching \"missing\"", "openai", "missing"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModelUsage, normalizedContentHash } from "../src/application/model-usage.js";

test("actual provider usage is preferred and content is represented only by hashes", () => {
  const prompt = "RAW-PROMPT-SENTINEL-11e5";
  const context = "RAW-CONTEXT-SENTINEL-a932";
  const output = "RAW-OUTPUT-SENTINEL-f48c";
  const result = normalizeModelUsage({
    input_tokens: 1_200,
    input_tokens_details: { cached_tokens: 300 },
    output_tokens: 450,
    output_tokens_details: { reasoning_tokens: 80 },
    cost_usd: 0.0125,
    provider: "openai",
    model: "quality-model",
    finish_reason: "stop",
  }, {
    callId: "CALL-001",
    stage: "drafting",
    chapter: 7,
    pass: "candidate",
    prompt,
    context,
    output,
    elapsedMs: 123.5,
  });

  assert.equal(result.inputTokens, 1_200);
  assert.equal(result.cachedInputTokens, 300);
  assert.equal(result.outputTokens, 450);
  assert.equal(result.reasoningTokens, 80);
  assert.equal(result.costUsd, 0.0125);
  assert.equal(result.provider, "openai");
  assert.equal(result.model, "quality-model");
  assert.equal(result.finishReason, "stop");
  assert.equal(result.estimated, false);
  assert.equal(result.promptHash, normalizedContentHash(prompt));
  assert.equal(result.contextHash, normalizedContentHash(context));
  assert.equal(result.outputHash, normalizedContentHash(output));
  const serialized = JSON.stringify(result);
  for (const sentinel of [prompt, context, output]) assert.equal(serialized.includes(sentinel), false);
});

test("missing provider usage falls back to bounded estimates without inventing cache or reasoning", () => {
  const prompt = "P".repeat(1_001);
  const context = "C".repeat(2_000);
  const output = "O".repeat(401);
  const result = normalizeModelUsage({}, {
    callId: "CALL-002",
    stage: "review",
    pass: "critic",
    prompt,
    context,
    output,
    elapsedMs: 10,
    provider: "fallback-provider",
    model: "fallback-model",
  });

  assert.equal(result.inputTokens, Math.ceil((prompt.length + context.length) / 4));
  assert.equal(result.outputTokens, Math.ceil(output.length / 4));
  assert.equal(result.cachedInputTokens, undefined);
  assert.equal(result.reasoningTokens, undefined);
  assert.equal(result.costUsd, undefined);
  assert.equal(result.provider, "fallback-provider");
  assert.equal(result.model, "fallback-model");
  assert.equal(result.estimated, true);
});

test("content hashing normalizes line endings but not substantive text", () => {
  assert.equal(normalizedContentHash("a\r\nb\r\n"), normalizedContentHash("a\nb\n"));
  assert.notEqual(normalizedContentHash("a\nb\n"), normalizedContentHash("a\nc\n"));
  assert.match(normalizedContentHash("content"), /^[a-f0-9]{64}$/);
});

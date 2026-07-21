import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PiPrintWorker } from "../src/pi/pi-print-worker.js";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fake-pi-worker.mjs");

function request(prompt = "INSTRUCTION-SENTINEL", context = "CONTEXT-SENTINEL") {
  return {
    callId: "CALL-001",
    stage: "drafting",
    chapter: 3,
    pass: "candidate" as const,
    prompt,
    context,
    provider: "fake",
    model: "quality-model",
    thinking: "high" as const,
    timeoutMs: 2_000,
  };
}

test("Pi worker pipes content through stdin, disables ambient capabilities, and records actual usage", async () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-pi-worker-"));
  const capture = join(root, "capture.jsonl");
  try {
    const worker = new PiPrintWorker({
      executable: process.execPath,
      prefixArgs: [fixture],
      env: { FAKE_PI_CAPTURE: capture },
      cwd: root,
    });
    const capacity = await worker.resolveModelCapacity({ provider: "fake", model: "quality-model" });
    assert.deepEqual(capacity, {
      provider: "fake",
      model: "quality-model",
      contextWindowTokens: 128_000,
      maxOutputTokens: 32_000,
    });
    assert.deepEqual(await worker.resolveModelCapacity({ provider: "fake", model: "quality-model" }), capacity);

    const result = await worker.run(request());
    assert.equal(result.text, "worker result");
    assert.equal(result.usage.inputTokens, 820);
    assert.equal(result.usage.cachedInputTokens, 100);
    assert.equal(result.usage.outputTokens, 200);
    assert.equal(result.usage.reasoningTokens, 50);
    assert.equal(result.usage.costUsd, 0.00312);
    assert.equal(result.usage.estimated, false);

    const records = readFileSync(capture, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { kind: string; args: string[]; stdin?: string });
    assert.equal(records.filter((item) => item.kind === "models").length, 1);
    const run = records.find((item) => item.kind === "run");
    assert.ok(run);
    for (const required of [
      "-p", "--mode", "json", "--no-session", "--no-tools", "--no-context-files",
      "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-approve",
      "--provider", "fake", "--model", "quality-model", "--thinking", "high",
    ]) assert.ok(run.args.includes(required), required);
    assert.equal(run.args.some((arg) => arg.includes("INSTRUCTION-SENTINEL") || arg.includes("CONTEXT-SENTINEL")), false);
    assert.match(run.stdin ?? "", /INSTRUCTION-SENTINEL/);
    assert.match(run.stdin ?? "", /CONTEXT-SENTINEL/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("timeouts, aborts, nonzero exits, and incomplete streams fail without leaking worker output", async () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-pi-worker-errors-"));
  try {
    const worker = new PiPrintWorker({ executable: process.execPath, prefixArgs: [fixture], cwd: root });
    await assert.rejects(worker.run({ ...request("WAIT_FOREVER", ""), timeoutMs: 40 }), /timed out/i);

    const controller = new AbortController();
    const aborted = worker.run({ ...request("WAIT_FOREVER", ""), timeoutMs: 2_000 }, controller.signal);
    setTimeout(() => controller.abort(), 40);
    await assert.rejects(aborted, /aborted/i);

    await assert.rejects(worker.run(request("NONZERO_EXIT", "")), (error: unknown) => {
      assert.match(String(error), /exited with code 7/i);
      assert.doesNotMatch(String(error), /private fake failure/i);
      return true;
    });
    await assert.rejects(worker.run(request("MISSING_FINAL", "")), /final assistant message/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing Pi capability fails before any model output is accepted", async () => {
  const worker = new PiPrintWorker({ executable: join(tmpdir(), "definitely-missing-pi-command") });
  await assert.rejects(worker.run(request()), /Pi worker is unavailable/i);
});

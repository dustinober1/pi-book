import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { createRunReport, resolveTelemetryEnabled } from "../src/application/run-telemetry.js";
import { RunReportSchema } from "../src/domain/run-report.js";
import { storeRunReport } from "../src/infrastructure/run-report-store.js";

test("run reports use the locked schema and stable character token estimate", () => {
  const report = createRunReport({
    runId: "RUN-001",
    runtimeProfile: "tiny-local",
    adapterId: "pi",
    model: "local-model",
    promptChars: 1_001,
    contextChars: 2_000,
    changedFileCount: 2,
    changedBytes: 480,
    repairAttempts: 1,
    validationFailures: [{ path: "books/book-01/chapter-queue.yaml", category: "schema", message: "missing field" }],
    metrics: [{ label: "context", elapsedMs: 4.5, rssBytes: 1024 }],
    projectHashBefore: "before-hash",
    projectHashAfter: "after-hash",
  });

  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.estimatedInputTokens, Math.ceil((1_001 + 2_000) / 4));
  assert.equal(Value.Check(RunReportSchema, report), true);
});

test("run report construction drops raw prompt prose output notes and credentials", () => {
  const promptSentinel = "RAW-PROMPT-SENTINEL-93d82";
  const proseSentinel = "RAW-MANUSCRIPT-SENTINEL-6cf11";
  const outputSentinel = "RAW-MODEL-OUTPUT-SENTINEL-f074c";
  const credentialSentinel = "sk-local-CREDENTIAL-SENTINEL-a83c";
  const report = createRunReport({
    runId: "RUN-PRIVACY",
    runtimeProfile: "local",
    promptChars: promptSentinel.length,
    contextChars: proseSentinel.length,
    changedFileCount: 0,
    changedBytes: 0,
    repairAttempts: 0,
    validationFailures: [],
    metrics: [],
    projectHashBefore: "privacy-hash",
    rawPrompt: promptSentinel,
    rawManuscript: proseSentinel,
    rawOutput: outputSentinel,
    apiKey: credentialSentinel,
  } as never);
  const serialized = JSON.stringify(report);
  for (const sentinel of [promptSentinel, proseSentinel, outputSentinel, credentialSentinel]) {
    assert.equal(serialized.includes(sentinel), false);
  }
});

test("telemetry preference follows explicit project and compatibility precedence", () => {
  assert.equal(resolveTelemetryEnabled({}), true);
  assert.equal(resolveTelemetryEnabled({ project: false }), false);
  assert.equal(resolveTelemetryEnabled({ explicit: true, project: false }), true);
  assert.equal(resolveTelemetryEnabled({ explicit: false, project: true }), false);
});

test("run reports are written atomically under the ignored local state directory", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-"));
  try {
    const report = createRunReport({
      runId: "RUN-ATOMIC",
      runtimeProfile: "full",
      promptChars: 20,
      contextChars: 40,
      changedFileCount: 1,
      changedBytes: 12,
      repairAttempts: 0,
      validationFailures: [],
      metrics: [],
      projectHashBefore: "before",
    });
    const result = storeRunReport(root, report);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.path, join(root, ".pi-book", "runs", "RUN-ATOMIC", "run-report.json"));
    assert.deepEqual(JSON.parse(readFileSync(result.path, "utf8")), report);
    assert.deepEqual(readdirSync(join(root, ".pi-book", "runs", "RUN-ATOMIC")), ["run-report.json"]);
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    assert.match(ignore, /^\.pi-book\/runs\/$/m);
    assert.match(ignore, /^\.pi-book\/cache\/$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run report failures are sanitized and do not throw into the authoring run", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-run-report-failure-"));
  try {
    mkdirSync(join(root, ".pi-book"), { recursive: true });
    writeFileSync(join(root, ".pi-book", "runs"), "not a directory", "utf8");
    const report = createRunReport({
      runId: "RUN-FAILURE",
      runtimeProfile: "local",
      promptChars: 0,
      contextChars: 0,
      changedFileCount: 0,
      changedBytes: 0,
      repairAttempts: 0,
      validationFailures: [],
      metrics: [],
      projectHashBefore: "before",
    });
    assert.deepEqual(storeRunReport(root, report), {
      ok: false,
      message: "Unable to write the local run report.",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

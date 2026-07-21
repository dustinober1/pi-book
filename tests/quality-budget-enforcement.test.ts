import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQualityDraft, QualityBudgetDowngradeError, QualityBudgetStopError } from "../src/application/quality-orchestrator.js";
import type { ModelCallReport } from "../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readBudgetLedger } from "../src/infrastructure/budget-ledger-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { readProject } from "../src/project/store.js";
import { createDraftableQualityProject } from "./quality-project-fixture.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("missing metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

class BudgetWorker implements QualityWorker {
  calls = 0;
  constructor(readonly failFirst = false) {}
  async resolveModelCapacity() { return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls += 1;
    if (this.failFirst) throw new Error("worker interrupted");
    const meta = metadata(request.prompt);
    const common = { schema_version: "1.0.0", run_id: meta.run_id, chapter: meta.chapter, source_hashes: meta.source_hashes, creation_order: meta.creation_order };
    const outputType = String(meta.output_type);
    const text = outputType === "scene-plan"
      ? JSON.stringify({ ...common, artifact_type: "scene-plan", objective: "Choose.", beats: ["Enter", "Choose"], protected_constraints: [], ending_hook: "Pressure.", evidence_refs: [] })
      : JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: meta.candidate_id, text: "# Chapter 1\n\nDraft.\n", proposed_delta: { canon: [], relationships: [], threads: [] } });
    const usage: ModelCallReport = {
      callId: request.callId, stage: request.stage, chapter: request.chapter, pass: request.pass,
      inputTokens: 120, outputTokens: 80, estimated: false, elapsedMs: 1,
      promptHash: hash(request.prompt), contextHash: hash(request.context ?? ""), outputHash: hash(text),
    };
    return { text, usage };
  }
}

function configure(root: string, onExhaustion: "stop" | "downgrade") {
  const project = readProject(root);
  project.quality!.tier = "premium";
  project.quality!.budget.maximum_total_tokens = 10_000;
  project.quality!.budget.maximum_tokens_per_chapter = 10_000;
  project.quality!.budget.maximum_calls_per_chapter = 2;
  project.quality!.budget.on_exhaustion = onExhaustion;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return project.quality!;
}

test("stop policy blocks the next call before inference and keeps failure cache", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const quality = configure(project.root, "stop");
    const worker = new BudgetWorker();
    await assert.rejects(runQualityDraft({
      root: project.root, chapter: 1, runtimeProfile: "full", qualityConfig: quality, worker,
      runId: "QDR-STOP", cacheRetention: "delete-on-success",
    }), (error: unknown) => {
      assert.ok(error instanceof QualityBudgetStopError);
      assert.equal(error.reason, "chapter-call-limit");
      return true;
    });
    assert.equal(worker.calls, 2);
    assert.equal(existsSync(join(project.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
    assert.equal(existsSync(join(project.root, ".pi-book", "cache", "generation", "QDR-STOP")), true);
    const ledger = readBudgetLedger(project.root);
    assert.equal(ledger.reservations.length, 0);
    assert.equal(ledger.settledCalls.length, 2);
    assert.equal(ledger.events.at(-1)?.type, "stop");
    const report = JSON.parse(readFileSync(join(project.root, ".pi-book", "runs", "QDR-STOP", "run-report.json"), "utf8")) as { budgetEvents: Array<{ type: string }> };
    assert.equal(report.budgetEvents.at(-1)?.type, "stop");
  } finally { rmSync(project.parent, { recursive: true, force: true }); }
});

test("downgrade policy names the next lower tier without canonical mutation", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const quality = configure(project.root, "downgrade");
    const worker = new BudgetWorker();
    await assert.rejects(runQualityDraft({
      root: project.root, chapter: 1, runtimeProfile: "full", qualityConfig: quality, worker, runId: "QDR-DOWN",
    }), (error: unknown) => {
      assert.ok(error instanceof QualityBudgetDowngradeError);
      assert.equal(error.fromTier, "premium");
      assert.equal(error.toTier, "balanced");
      assert.equal(error.reason, "chapter-call-limit");
      return true;
    });
    assert.equal(worker.calls, 2);
    assert.equal(existsSync(join(project.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
    assert.equal(readBudgetLedger(project.root).events.at(-1)?.toTier, "balanced");
  } finally { rmSync(project.parent, { recursive: true, force: true }); }
});

test("worker interruption releases its live reservation", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const quality = configure(project.root, "stop");
    await assert.rejects(runQualityDraft({
      root: project.root, chapter: 1, runtimeProfile: "full", qualityConfig: quality, worker: new BudgetWorker(true), runId: "QDR-INTERRUPT",
    }), /worker interrupted/);
    const ledger = readBudgetLedger(project.root);
    assert.equal(ledger.reservations.length, 0);
    assert.equal(ledger.settledCalls.length, 0);
  } finally { rmSync(project.parent, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import type { ChapterPacket } from "../src/domain/schemas.js";
import type { ModelCallReport } from "../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import {
  assertPaidQualityEvalConfig,
  assertQualityFixtureTreeClean,
  loadQualityEvalFixtures,
  runQualityEvaluation,
  type QualityEvalFixture,
} from "../src/evaluation/quality-eval.js";
import { buildQualityEvalReport, renderHumanAnswerCsv, renderHumanReviewKit } from "../src/evaluation/quality-eval-report.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function packet(chapter: number): ChapterPacket {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready", pov: "Mara", purpose: "Force a costly decision.",
    scene_engine: "infiltration", pressure_movement: "The deadline contracts.", character_movement: "Mara chooses evidence over safety.",
    relationship_movement: "Trust becomes conditional.", story_thread_refs: ["ST-001"], continuity_refs: ["CAN-001"],
    character_refs: ["Mara"], required_research: ["RES-001"], profile_fields: { risk: "high" },
    ending_hook: "The record changes.", milestone_gate: null, target_words: 1800,
  };
}

function fixture(id: string, profile: "thriller" | "romantasy" | "historical-fiction", chapter: number): QualityEvalFixture {
  return {
    schema_version: "1.0.0", id, profile, chapter, project_hash: hash(`${id}-project`), packet: packet(chapter),
    context: `FROZEN CONTEXT ${id}\nCAN-001 remains true.\nRES-001 is the only factual support.`,
    protected_constraints: ["Preserve CAN-001.", "Do not change the ending hook."],
  };
}

function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((value) => value.startsWith("{"));
  if (!line) throw new Error("missing quality-eval metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

class FakeEvalWorker implements QualityWorker {
  readonly calls: QualityWorkerRequest[] = [];
  async resolveModelCapacity() { return { provider: "fake", model: "eval-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls.push(request);
    const meta = metadata(request.prompt);
    const outputType = String(meta.output_type);
    const text = outputType === "quality-eval-sample"
      ? `# Sample ${String(meta.sample_id)}\n\nMara enters the archive and pays a concrete cost when the record changes.`
      : outputType === "quality-eval-diagnostic"
        ? JSON.stringify({
            schema_version: "1.0.0", sample_id: meta.sample_id,
            scores: { canon_integrity: 5, consent_integrity: 5, reveal_order: 5, causality: 4, factual_grounding: 4, voice_fidelity: 4 },
            severe_failures: { canon: false, consent: false, reveal_order: false, causal: false, factual: false, voice: false },
            notes: ["Diagnostic only; not human reader evidence."],
          })
        : (() => { throw new Error(`unexpected output type ${outputType}`); })();
    const tier = String(meta.tier ?? "");
    const generationCost = tier === "premium" ? 0.08 : tier === "editorial" ? 0.1 : 0.02;
    const usage: ModelCallReport = {
      callId: request.callId, stage: request.stage, pass: request.pass,
      ...(request.provider ? { provider: request.provider } : {}), ...(request.model ? { model: request.model } : {}),
      inputTokens: outputType === "quality-eval-sample" ? 800 : 400,
      outputTokens: outputType === "quality-eval-sample" ? 300 : 120,
      estimated: false, costUsd: outputType === "quality-eval-sample" ? generationCost : 0.01,
      elapsedMs: 1, finishReason: "stop", promptHash: hash(request.prompt), contextHash: hash(request.context ?? ""), outputHash: hash(text),
    };
    return { text, usage };
  }
}

test("quality fixtures load in deterministic filename order and reject invalid packets", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-quality-eval-fixtures-"));
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "b.yaml"), stringifyYaml(fixture("QEF-ROM-001", "romantasy", 2)), "utf8");
    writeFileSync(join(root, "a.yaml"), stringifyYaml(fixture("QEF-THR-001", "thriller", 1)), "utf8");
    assert.deepEqual(loadQualityEvalFixtures(root).map((item) => item.id), ["QEF-ROM-001", "QEF-THR-001"]);
    writeFileSync(join(root, "invalid.yaml"), stringifyYaml({ ...fixture("QEF-BAD-001", "thriller", 3), packet: { chapter: 3 } }), "utf8");
    assert.throws(() => loadQualityEvalFixtures(root), /packet|schema/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("matched tier samples use opaque seeded IDs and identical frozen context", async () => {
  const worker = new FakeEvalWorker();
  const fixtures = [fixture("QEF-THR-001", "thriller", 1)];
  const input = { fixtures, provider: "fake", model: "eval-model", tiers: ["economy", "premium", "editorial"] as const, seed: "seed-42" };
  const first = await runQualityEvaluation({ ...input, worker });
  const second = await runQualityEvaluation({ ...input, worker: new FakeEvalWorker() });
  assert.deepEqual(first.samples.map((item) => item.sampleId), second.samples.map((item) => item.sampleId));
  assert.equal(new Set(first.samples.map((item) => item.sampleId)).size, 3);
  for (const sample of first.samples) {
    assert.match(sample.sampleId, /^SMP-[A-F0-9]{12}$/);
    assert.doesNotMatch(sample.sampleId, /economy|premium|editorial/i);
  }
  const generationCalls = worker.calls.filter((call) => metadata(call.prompt).output_type === "quality-eval-sample");
  assert.equal(generationCalls.length, 3);
  assert.equal(new Set(generationCalls.map((call) => call.context)).size, 1);
  assert.equal(generationCalls.every((call) => call.provider === "fake" && call.model === "eval-model"), true);
  assert.deepEqual(new Set(Object.values(first.sealedLabels).map((item) => item.tier)), new Set(["economy", "premium", "editorial"]));
});

test("human review kit is blinded and reports cost and pairwise outcomes without declaring weak evidence", async () => {
  const bundle = await runQualityEvaluation({
    fixtures: [fixture("QEF-THR-001", "thriller", 1), fixture("QEF-ROM-001", "romantasy", 2)], worker: new FakeEvalWorker(),
    provider: "fake-provider-secret", model: "secret-model-name", tiers: ["economy", "premium"], seed: "review-seed",
  });
  const kit = renderHumanReviewKit(bundle);
  const csv = renderHumanAnswerCsv(bundle);
  for (const secret of ["economy", "premium", "fake-provider-secret", "secret-model-name", "QEF-THR-001", "QEF-ROM-001"]) {
    assert.equal(kit.includes(secret), false, "kit should not contain " + secret);
    assert.equal(csv.includes(secret), false, "csv should not contain " + secret);
  }
  assert.match(kit, /SMP-[A-F0-9]{12}/);
  assert.match(csv, /comparison_id,sample_a,sample_b,winner,severe_failure_sample_ids,notes/);
  const responses = bundle.comparisons.map((group) => ({
    comparison_id: group.comparisonId,
    winner_sample_id: group.sampleIds.find((sampleId) => bundle.sealedLabels[sampleId]?.tier === "premium")!,
    severe_failure_sample_ids: [], notes: "",
  }));
  const report = buildQualityEvalReport(bundle, responses, 3);
  assert.equal(report.tiers.economy!.sampleCount, 2);
  assert.equal(report.tiers.premium!.sampleCount, 2);
  assert.equal(report.tiers.economy!.medianCostUsd, 0.03);
  assert.equal(report.pairwise[0]?.comparisons, 2);
  assert.equal(report.pairwise[0]?.humanMinimumMet, false);
  assert.equal(report.conclusions.some((value) => /superior/i.test(value)), false);
  assert.equal(report.costPerAdditionalWinOverEconomy.premium, 0.06);
});

test("paid quality evaluation requires explicit opt-in and a clean fixture tree", () => {
  assert.throws(() => assertPaidQualityEvalConfig({}), /NOVEL_FORGE_RUN_PAID_EVAL=1/);
  assert.throws(() => assertPaidQualityEvalConfig({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }), /provider/i);
  assert.throws(() => assertPaidQualityEvalConfig({
    NOVEL_FORGE_RUN_PAID_EVAL: "1", NOVEL_FORGE_QUALITY_EVAL_PROVIDER: "fake", NOVEL_FORGE_QUALITY_EVAL_MODEL: "model",
    NOVEL_FORGE_QUALITY_EVAL_TIERS: "economy,premium",
  }), /seed/i);
  assert.deepEqual(assertPaidQualityEvalConfig({
    NOVEL_FORGE_RUN_PAID_EVAL: "1", NOVEL_FORGE_QUALITY_EVAL_PROVIDER: "fake", NOVEL_FORGE_QUALITY_EVAL_MODEL: "model",
    NOVEL_FORGE_QUALITY_EVAL_TIERS: "economy,premium", NOVEL_FORGE_QUALITY_EVAL_SEED: "seed-1",
  }), { provider: "fake", model: "model", tiers: ["economy", "premium"], seed: "seed-1" });
  assert.doesNotThrow(() => assertQualityFixtureTreeClean(""));
  assert.throws(() => assertQualityFixtureTreeClean(" M evals/quality/fixtures/thriller-key-scene.yaml\n"), /dirty fixture tree/i);
});

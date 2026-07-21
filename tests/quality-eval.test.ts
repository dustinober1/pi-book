import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createQualityEvaluation,
  opaqueSampleId,
  seededOrder,
  type QualityEvalGenerator,
} from "../src/evaluation/quality-eval.js";

const fixture = {
  schema_version: "1.0.0" as const,
  id: "thriller-key-scene",
  profile: "thriller" as const,
  chapter: 7,
  project_hash: "a".repeat(64),
  packet_hash: "b".repeat(64),
  context_hash: "c".repeat(64),
  rubric: ["continuity", "causality", "voice", "factual"],
};

class FakeGenerator implements QualityEvalGenerator {
  async generate(input: { tier: string; sampleId: string }) {
    const multiplier = input.tier === "economy" ? 1 : input.tier === "balanced" ? 2 : 3;
    return {
      text: `Sample ${input.sampleId} text`,
      inputTokens: 100 * multiplier,
      outputTokens: 50 * multiplier,
      costUsd: 0.001 * multiplier,
      severeFailures: input.tier === "economy" ? ["causality"] : [],
      diagnosticScores: { continuity: multiplier, causality: multiplier, voice: multiplier, factual: multiplier },
    };
  }
}

test("sample IDs and review order are deterministic but opaque", () => {
  const first = opaqueSampleId("seed-42", fixture.id, "economy", 0);
  const second = opaqueSampleId("seed-42", fixture.id, "premium", 0);
  assert.match(first, /^S-[A-F0-9]{12}$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("economy"), false);
  assert.deepEqual(seededOrder(["A", "B", "C", "D"], "seed-42"), seededOrder(["A", "B", "C", "D"], "seed-42"));
});

test("evaluation produces sealed matched samples and cost aggregates", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-eval-"));
  try {
    const result = await createQualityEvaluation({
      fixture,
      tiers: ["economy", "balanced", "premium"],
      seed: "seed-42",
      provider: "fake",
      model: "same-model",
      generator: new FakeGenerator(),
      outputRoot: parent,
    });
    assert.equal(result.report.samples.length, 3);
    assert.equal(new Set(result.report.samples.map((sample) => sample.model)).size, 1);
    assert.equal(result.report.totals.economy.totalTokens, 150);
    assert.equal(result.report.totals.premium.totalTokens, 450);
    assert.equal(result.report.totals.premium.severeFailureRate, 0);
    assert.equal(result.report.totals.economy.severeFailureRate, 1);
    assert.equal(result.reviewKit.samples.length, 3);
    assert.equal(result.reviewKit.samples.some((sample) => /economy|balanced|premium|same-model/i.test(sample.markdown)), false);
    assert.deepEqual(result.reviewKit.samples.map((sample) => sample.sampleId), result.reviewKit.answerSheet.map((row) => row.sample_id));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("human results calculate pairwise wins and cost per additional win", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-eval-human-"));
  try {
    const result = await createQualityEvaluation({ fixture, tiers: ["economy", "premium"], seed: "seed-9", provider: "fake", model: "same-model", generator: new FakeGenerator(), outputRoot: parent });
    const [first, second] = result.reviewKit.samples;
    assert.ok(first && second);
    const imported = result.importHumanReview([
      { sample_id: first.sampleId, reviewer_id: "R1", score: 2 },
      { sample_id: second.sampleId, reviewer_id: "R1", score: 5 },
    ], 1);
    assert.equal(imported.pairwise.length, 1);
    assert.equal(imported.pairwise[0]?.comparisons, 1);
    assert.ok(Number.isFinite(imported.pairwise[0]?.costPerAdditionalWinUsd ?? NaN));
    assert.equal(imported.minimumHumanReviewsMet, true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

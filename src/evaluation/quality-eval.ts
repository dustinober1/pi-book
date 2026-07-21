import { createHash } from "node:crypto";
import type { QualityTierId } from "../domain/quality-profile.js";
import {
  aggregateQualitySamples,
  writeQualityEvaluationArtifacts,
  type QualityEvaluationReport,
  type QualityEvalPaths,
  type QualityEvalSampleReport,
  type QualityReviewKit,
} from "./quality-eval-report.js";

export interface QualityEvalFixture {
  schema_version: "1.0.0";
  id: string;
  profile: "thriller" | "romantasy" | "historical-fiction";
  chapter: number;
  project_hash: string;
  packet_hash: string;
  context_hash: string;
  rubric: string[];
}

export interface QualityEvalGeneration {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  severeFailures: string[];
  diagnosticScores: Record<string, number>;
  privateDiagnostics?: string;
}

export interface QualityEvalGenerator {
  generate(input: {
    fixture: QualityEvalFixture;
    tier: QualityTierId;
    sampleId: string;
    provider: string;
    model: string;
  }): Promise<QualityEvalGeneration>;
}

export interface HumanReviewRow {
  sample_id: string;
  reviewer_id: string;
  score: number;
  severe_failure?: boolean;
  note?: string;
}

export interface PairwiseQualityResult {
  baselineTier: QualityTierId;
  comparisonTier: QualityTierId;
  comparisons: number;
  baselineWins: number;
  comparisonWins: number;
  ties: number;
  comparisonWinRate: number;
  costPerAdditionalWinUsd: number | null;
}

export interface HumanReviewImportResult {
  minimumHumanReviewsMet: boolean;
  pairwise: PairwiseQualityResult[];
}

export interface QualityEvaluationResult {
  report: QualityEvaluationReport;
  reviewKit: QualityReviewKit;
  paths: QualityEvalPaths;
  importHumanReview(rows: readonly HumanReviewRow[], minimumHumanReviews: number): HumanReviewImportResult;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function opaqueSampleId(seed: string, fixtureId: string, tier: QualityTierId, index: number): string {
  return `S-${hash(`${seed}\0${fixtureId}\0${tier}\0${index}`).slice(0, 12).toUpperCase()}`;
}

function seededNumber(seed: string, position: number): number {
  return Number.parseInt(hash(`${seed}\0${position}`).slice(0, 12), 16) / 0xffffffffffff;
}

export function seededOrder<T>(values: readonly T[], seed: string): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededNumber(seed, index) * (index + 1));
    [output[index], output[swap]] = [output[swap]!, output[index]!];
  }
  return output;
}

export function requirePaidEvaluationConfiguration(
  env: Readonly<Record<string, string | undefined>>,
  input: { provider: string; model: string; tiers: readonly QualityTierId[]; seed: string },
): void {
  if (env.NOVEL_FORGE_RUN_PAID_EVAL !== "1") throw new Error("Paid quality evaluation requires NOVEL_FORGE_RUN_PAID_EVAL=1.");
  if (!input.provider.trim()) throw new Error("Paid quality evaluation requires an explicit provider.");
  if (!input.model.trim()) throw new Error("Paid quality evaluation requires an explicit model.");
  if (!input.tiers.length) throw new Error("Paid quality evaluation requires at least one tier.");
  if (!input.seed.trim()) throw new Error("Paid quality evaluation requires an explicit seed.");
}

function pairwiseHumanResults(
  report: QualityEvaluationReport,
  rows: readonly HumanReviewRow[],
  minimumHumanReviews: number,
): HumanReviewImportResult {
  const sampleById = new Map(report.samples.map((sample) => [sample.sampleId, sample]));
  const scores = new Map<string, number[]>();
  for (const row of rows) {
    if (!sampleById.has(row.sample_id)) throw new Error(`Unknown quality evaluation sample ${row.sample_id}.`);
    if (!Number.isFinite(row.score)) throw new Error(`Human review score for ${row.sample_id} must be finite.`);
    scores.set(row.sample_id, [...(scores.get(row.sample_id) ?? []), row.score]);
  }
  const tierScores = new Map<QualityTierId, number[]>();
  for (const sample of report.samples) {
    const values = scores.get(sample.sampleId) ?? [];
    if (!values.length) continue;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    tierScores.set(sample.tier, [...(tierScores.get(sample.tier) ?? []), average]);
  }
  const tiers = [...tierScores.keys()];
  const baseline = tiers.includes("economy") ? "economy" : tiers[0];
  const pairwise: PairwiseQualityResult[] = [];
  if (baseline) {
    const baselineValues = tierScores.get(baseline) ?? [];
    for (const tier of tiers.filter((value) => value !== baseline)) {
      const comparisonValues = tierScores.get(tier) ?? [];
      const comparisons = Math.min(baselineValues.length, comparisonValues.length);
      let baselineWins = 0;
      let comparisonWins = 0;
      let ties = 0;
      for (let index = 0; index < comparisons; index += 1) {
        const left = baselineValues[index]!;
        const right = comparisonValues[index]!;
        if (left > right) baselineWins += 1;
        else if (right > left) comparisonWins += 1;
        else ties += 1;
      }
      const baselineCost = report.totals[baseline]?.totalCostUsd ?? 0;
      const comparisonCost = report.totals[tier]?.totalCostUsd ?? 0;
      const additionalWins = Math.max(0, comparisonWins - baselineWins);
      pairwise.push({
        baselineTier: baseline,
        comparisonTier: tier,
        comparisons,
        baselineWins,
        comparisonWins,
        ties,
        comparisonWinRate: comparisons ? comparisonWins / comparisons : 0,
        costPerAdditionalWinUsd: additionalWins ? Math.max(0, comparisonCost - baselineCost) / additionalWins : null,
      });
    }
  }
  const uniqueReviewers = new Set(rows.map((row) => row.reviewer_id).filter(Boolean)).size;
  return { minimumHumanReviewsMet: uniqueReviewers >= minimumHumanReviews, pairwise };
}

export async function createQualityEvaluation(input: {
  fixture: QualityEvalFixture;
  tiers: readonly QualityTierId[];
  seed: string;
  provider: string;
  model: string;
  generator: QualityEvalGenerator;
  outputRoot: string;
}): Promise<QualityEvaluationResult> {
  if (!input.tiers.length) throw new Error("Quality evaluation requires at least one tier.");
  if (!input.seed.trim()) throw new Error("Quality evaluation requires a seed.");
  if (!input.provider.trim() || !input.model.trim()) throw new Error("Quality evaluation requires one explicit provider and model for matched samples.");

  const generated: Array<{ report: QualityEvalSampleReport; text: string }> = [];
  for (const [index, tier] of input.tiers.entries()) {
    const sampleId = opaqueSampleId(input.seed, input.fixture.id, tier, index);
    const value = await input.generator.generate({ fixture: input.fixture, tier, sampleId, provider: input.provider, model: input.model });
    generated.push({
      text: value.text,
      report: {
        sampleId,
        tier,
        provider: input.provider,
        model: input.model,
        fixtureId: input.fixture.id,
        projectHash: input.fixture.project_hash,
        packetHash: input.fixture.packet_hash,
        contextHash: input.fixture.context_hash,
        outputHash: hash(value.text),
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,
        costUsd: value.costUsd,
        severeFailures: [...value.severeFailures],
        diagnosticScores: { ...value.diagnosticScores },
      },
    });
  }

  const report: QualityEvaluationReport = {
    schema_version: "1.0.0",
    fixture_id: input.fixture.id,
    seed_hash: hash(input.seed),
    samples: generated.map((item) => item.report),
    totals: aggregateQualitySamples(generated.map((item) => item.report)),
    diagnostic_only: true,
    human_validation_claimed: false,
  };
  const ordered = seededOrder(generated, input.seed);
  const reviewKit: QualityReviewKit = {
    samples: ordered.map((item) => ({ sampleId: item.report.sampleId, markdown: item.text })),
    answerSheet: ordered.map((item) => ({ sample_id: item.report.sampleId, reviewer_id: "", score: "", severe_failure: "", note: "" })),
  };
  const labelSeal = generated.map((item) => ({ sample_id: item.report.sampleId, tier: item.report.tier }));
  const paths = writeQualityEvaluationArtifacts({ outputRoot: input.outputRoot, report, labelSeal, reviewKit });
  return {
    report,
    reviewKit,
    paths,
    importHumanReview(rows, minimumHumanReviews) {
      return pairwiseHumanResults(report, rows, minimumHumanReviews);
    },
  };
}

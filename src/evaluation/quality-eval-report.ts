import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QualityTierId } from "../domain/quality-profile.js";
import type {
  QualityEvalComparison,
  QualityEvaluationBundle,
  QualityEvalSample,
} from "./quality-eval.js";

export interface HumanQualityReviewResponse {
  comparison_id: string;
  winner_sample_id: string | "tie";
  severe_failure_sample_ids: string[];
  notes: string;
}

export interface QualityEvalTierMetrics {
  sampleCount: number;
  severeFailureRate: number;
  medianTokens: number;
  medianCostUsd: number;
}

export interface QualityEvalPairwiseMetrics {
  tierA: QualityTierId;
  tierB: QualityTierId;
  comparisons: number;
  winsA: number;
  winsB: number;
  ties: number;
  winRateA: number;
  winRateB: number;
  humanMinimumMet: boolean;
}

export interface QualityEvalReport {
  schemaVersion: "1.0.0";
  seedHash: string;
  tiers: Record<string, QualityEvalTierMetrics>;
  pairwise: QualityEvalPairwiseMetrics[];
  costPerAdditionalWinOverEconomy: Record<string, number | null>;
  automatedDiagnosticsAreHumanEvidence: false;
  conclusions: string[];
}

function totalTokens(sample: QualityEvalSample): number {
  return (sample.generationUsage.inputTokens ?? 0)
    + (sample.generationUsage.outputTokens ?? 0)
    + (sample.diagnosticUsage.inputTokens ?? 0)
    + (sample.diagnosticUsage.outputTokens ?? 0);
}

function totalCost(sample: QualityEvalSample): number {
  return (sample.generationUsage.costUsd ?? 0) + (sample.diagnosticUsage.costUsd ?? 0);
}

function severe(sample: QualityEvalSample): boolean {
  return Object.values(sample.diagnostic.severe_failures).some(Boolean);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function rounded(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function tierFor(bundle: QualityEvaluationBundle, sampleId: string): QualityTierId {
  const label = bundle.sealedLabels[sampleId];
  if (!label) throw new Error(`Missing sealed label for ${sampleId}.`);
  return label.tier;
}

function pairKey(left: QualityTierId, right: QualityTierId): string {
  return [left, right].sort().join("\u0000");
}

function comparisonById(bundle: QualityEvaluationBundle): Map<string, QualityEvalComparison> {
  return new Map(bundle.comparisons.map((comparison) => [comparison.comparisonId, comparison]));
}

export function buildQualityEvalReport(
  bundle: QualityEvaluationBundle,
  responses: readonly HumanQualityReviewResponse[],
  minimumHumanComparisons: number,
): QualityEvalReport {
  if (!Number.isInteger(minimumHumanComparisons) || minimumHumanComparisons < 1) {
    throw new Error("Human comparison minimum must be a positive integer.");
  }
  const samplesByTier = new Map<QualityTierId, QualityEvalSample[]>();
  for (const sample of bundle.samples) {
    const tier = tierFor(bundle, sample.sampleId);
    samplesByTier.set(tier, [...(samplesByTier.get(tier) ?? []), sample]);
  }

  const tiers: Record<string, QualityEvalTierMetrics> = {};
  for (const [tier, samples] of samplesByTier) {
    tiers[tier] = {
      sampleCount: samples.length,
      severeFailureRate: rounded(samples.filter(severe).length / samples.length),
      medianTokens: median(samples.map(totalTokens)),
      medianCostUsd: rounded(median(samples.map(totalCost))),
    };
  }

  const comparisonMap = comparisonById(bundle);
  const aggregates = new Map<string, {
    tierA: QualityTierId;
    tierB: QualityTierId;
    comparisons: number;
    winsA: number;
    winsB: number;
    ties: number;
  }>();
  const seenResponses = new Set<string>();
  for (const response of responses) {
    if (seenResponses.has(response.comparison_id)) throw new Error(`Duplicate human response for ${response.comparison_id}.`);
    seenResponses.add(response.comparison_id);
    const comparison = comparisonMap.get(response.comparison_id);
    if (!comparison) throw new Error(`Unknown quality comparison ${response.comparison_id}.`);
    if (response.winner_sample_id !== "tie" && !comparison.sampleIds.includes(response.winner_sample_id)) {
      throw new Error(`Winner ${response.winner_sample_id} is not in comparison ${response.comparison_id}.`);
    }
    for (const sampleId of response.severe_failure_sample_ids) {
      if (!comparison.sampleIds.includes(sampleId)) throw new Error(`Severe failure ${sampleId} is not in comparison ${response.comparison_id}.`);
    }
    const leftTier = tierFor(bundle, comparison.sampleIds[0]);
    const rightTier = tierFor(bundle, comparison.sampleIds[1]);
    const ordered = [leftTier, rightTier].sort() as [QualityTierId, QualityTierId];
    const key = pairKey(ordered[0], ordered[1]);
    const current = aggregates.get(key) ?? {
      tierA: ordered[0], tierB: ordered[1], comparisons: 0, winsA: 0, winsB: 0, ties: 0,
    };
    current.comparisons += 1;
    if (response.winner_sample_id === "tie") current.ties += 1;
    else if (tierFor(bundle, response.winner_sample_id) === current.tierA) current.winsA += 1;
    else current.winsB += 1;
    aggregates.set(key, current);
  }

  const pairwise: QualityEvalPairwiseMetrics[] = [...aggregates.values()]
    .map((item) => ({
      ...item,
      winRateA: item.comparisons ? rounded(item.winsA / item.comparisons) : 0,
      winRateB: item.comparisons ? rounded(item.winsB / item.comparisons) : 0,
      humanMinimumMet: item.comparisons >= minimumHumanComparisons,
    }))
    .sort((left, right) => pairKey(left.tierA, left.tierB).localeCompare(pairKey(right.tierA, right.tierB)));

  const totalCostByTier = new Map<QualityTierId, number>();
  for (const [tier, samples] of samplesByTier) totalCostByTier.set(tier, samples.reduce((sum, sample) => sum + totalCost(sample), 0));
  const costPerAdditionalWinOverEconomy: Record<string, number | null> = {};
  for (const tier of samplesByTier.keys()) {
    if (tier === "economy") continue;
    const pair = pairwise.find((item) => (item.tierA === "economy" && item.tierB === tier) || (item.tierB === "economy" && item.tierA === tier));
    if (!pair) {
      costPerAdditionalWinOverEconomy[tier] = null;
      continue;
    }
    const tierWins = pair.tierA === tier ? pair.winsA : pair.winsB;
    const economyWins = pair.tierA === "economy" ? pair.winsA : pair.winsB;
    const additionalWins = tierWins - economyWins;
    const incrementalCost = (totalCostByTier.get(tier) ?? 0) - (totalCostByTier.get("economy") ?? 0);
    costPerAdditionalWinOverEconomy[tier] = additionalWins > 0 ? rounded(incrementalCost / additionalWins) : null;
  }

  const conclusions: string[] = [];
  if (responses.length === 0) conclusions.push("No human pairwise responses have been imported.");
  for (const pair of pairwise) {
    if (!pair.humanMinimumMet) {
      conclusions.push(`${pair.tierA} versus ${pair.tierB}: insufficient human comparisons (${pair.comparisons}/${minimumHumanComparisons}).`);
      continue;
    }
    conclusions.push(`${pair.tierA} versus ${pair.tierB}: human minimum met; win rates ${pair.winRateA} and ${pair.winRateB}.`);
  }

  return {
    schemaVersion: "1.0.0",
    seedHash: bundle.seedHash,
    tiers,
    pairwise,
    costPerAdditionalWinOverEconomy,
    automatedDiagnosticsAreHumanEvidence: false,
    conclusions,
  };
}

function sampleById(bundle: QualityEvaluationBundle, sampleId: string): QualityEvalSample {
  const sample = bundle.samples.find((value) => value.sampleId === sampleId);
  if (!sample) throw new Error(`Missing quality sample ${sampleId}.`);
  return sample;
}

export function renderHumanReviewKit(bundle: QualityEvaluationBundle): string {
  const lines = [
    "# Novel Forge Blinded Quality Review Kit",
    "",
    "Review the samples without attempting to infer quality tier, model, or provider.",
    "Automated diagnostics are intentionally omitted. Record only your independent judgment.",
    "",
  ];
  for (const comparison of bundle.comparisons) {
    lines.push(`## ${comparison.comparisonId}`, "");
    comparison.sampleIds.forEach((sampleId, index) => {
      lines.push(`### Sample ${index === 0 ? "A" : "B"} — ${sampleId}`, "", sampleById(bundle, sampleId).text.trim(), "");
    });
  }
  return `${lines.join("\n").trim()}\n`;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function renderHumanAnswerCsv(bundle: QualityEvaluationBundle): string {
  const rows = ["comparison_id,sample_a,sample_b,winner,severe_failure_sample_ids,notes"];
  for (const comparison of bundle.comparisons) {
    rows.push([
      comparison.comparisonId,
      comparison.sampleIds[0],
      comparison.sampleIds[1],
      "",
      "",
      "",
    ].map(csvCell).join(","));
  }
  return `${rows.join("\n")}\n`;
}

export function writeQualityEvalArtifacts(directory: string, bundle: QualityEvaluationBundle): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "human-review-kit.md"), renderHumanReviewKit(bundle), "utf8");
  writeFileSync(join(directory, "human-answer-sheet.csv"), renderHumanAnswerCsv(bundle), "utf8");
  writeFileSync(join(directory, "sealed-labels.json"), `${JSON.stringify(bundle.sealedLabels, null, 2)}\n`, "utf8");
  writeFileSync(join(directory, "automated-diagnostic-report.json"), `${JSON.stringify(buildQualityEvalReport(bundle, [], 3), null, 2)}\n`, "utf8");
}

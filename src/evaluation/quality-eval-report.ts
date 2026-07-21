import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QualityTierId } from "../domain/quality-profile.js";

export interface QualityEvalSampleReport {
  sampleId: string;
  tier: QualityTierId;
  provider: string;
  model: string;
  fixtureId: string;
  projectHash: string;
  packetHash: string;
  contextHash: string;
  outputHash: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  severeFailures: string[];
  diagnosticScores: Record<string, number>;
}

export interface QualityTierAggregate {
  samples: number;
  totalTokens: number;
  medianTokens: number;
  totalCostUsd: number;
  medianCostUsd: number;
  severeFailureRate: number;
}

export interface QualityEvaluationReport {
  schema_version: "1.0.0";
  fixture_id: string;
  seed_hash: string;
  samples: QualityEvalSampleReport[];
  totals: Partial<Record<QualityTierId, QualityTierAggregate>>;
  diagnostic_only: true;
  human_validation_claimed: false;
}

export interface QualityReviewKit {
  samples: Array<{ sampleId: string; markdown: string }>;
  answerSheet: Array<{ sample_id: string; reviewer_id: string; score: string; severe_failure: string; note: string }>;
}

export interface QualityEvalPaths {
  report: string;
  labelSeal: string;
  reviewMarkdown: string;
  answerCsv: string;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function aggregateQualitySamples(samples: readonly QualityEvalSampleReport[]): Partial<Record<QualityTierId, QualityTierAggregate>> {
  const tiers = [...new Set(samples.map((sample) => sample.tier))];
  return Object.fromEntries(tiers.map((tier) => {
    const selected = samples.filter((sample) => sample.tier === tier);
    const tokens = selected.map((sample) => sample.inputTokens + sample.outputTokens);
    const costs = selected.map((sample) => sample.costUsd);
    return [tier, {
      samples: selected.length,
      totalTokens: tokens.reduce((sum, value) => sum + value, 0),
      medianTokens: median(tokens),
      totalCostUsd: costs.reduce((sum, value) => sum + value, 0),
      medianCostUsd: median(costs),
      severeFailureRate: selected.length ? selected.filter((sample) => sample.severeFailures.length > 0).length / selected.length : 0,
    }];
  })) as Partial<Record<QualityTierId, QualityTierAggregate>>;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function writeQualityEvaluationArtifacts(input: {
  outputRoot: string;
  report: QualityEvaluationReport;
  labelSeal: Array<{ sample_id: string; tier: QualityTierId }>;
  reviewKit: QualityReviewKit;
}): QualityEvalPaths {
  mkdirSync(input.outputRoot, { recursive: true });
  const paths: QualityEvalPaths = {
    report: join(input.outputRoot, "quality-eval-report.json"),
    labelSeal: join(input.outputRoot, "quality-eval-label-seal.json"),
    reviewMarkdown: join(input.outputRoot, "quality-review-kit.md"),
    answerCsv: join(input.outputRoot, "quality-review-answers.csv"),
  };
  writeFileSync(paths.report, `${JSON.stringify(input.report, null, 2)}\n`, "utf8");
  writeFileSync(paths.labelSeal, `${JSON.stringify({ schema_version: "1.0.0", labels: input.labelSeal }, null, 2)}\n`, "utf8");
  writeFileSync(paths.reviewMarkdown, input.reviewKit.samples.map((sample, index) => [
    `# Sample ${index + 1}`,
    "",
    `Opaque ID: ${sample.sampleId}`,
    "",
    sample.markdown,
    "",
    "---",
    "",
  ].join("\n")).join("\n"), "utf8");
  const header = ["sample_id", "reviewer_id", "score", "severe_failure", "note"];
  const rows = input.reviewKit.answerSheet.map((row) => header.map((key) => csvCell(String(row[key as keyof typeof row]))).join(","));
  writeFileSync(paths.answerCsv, [header.join(","), ...rows].join("\n") + "\n", "utf8");
  return paths;
}

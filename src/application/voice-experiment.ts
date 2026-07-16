import { createHash } from "node:crypto";
import type { TasteProfile, VoiceExperimentFile } from "../domain/v1-3-schemas.js";
import { defaultVoiceGuardrails } from "../domain/v1-3-schemas.js";
import { countWords } from "../infrastructure/files.js";
import { voiceSafetyFindings } from "./influence-palette.js";

export type VoiceExperimentAssetMap = Record<string, string>;

export interface VoiceExperimentFinding {
  code: "missing-asset" | "hash-mismatch" | "source-word-count" | "variant-word-count" | "variant-reference" | "baseline-word-count" | "baseline-reference";
  path: string;
  variantId?: "A" | "B" | "C";
  message: string;
}

export interface VoiceScoreSummary {
  variantId: "A" | "B" | "C";
  evaluatorCount: number;
  average: number;
  densityAverage: number;
}

export function stableContentHash(content: string): string {
  return createHash("sha256").update(content.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function contentSafetyFindings(content: string, taste: TasteProfile): ReturnType<typeof voiceSafetyFindings> {
  return voiceSafetyFindings({ taste, voiceProfile: content, guardrails: defaultVoiceGuardrails() });
}

function requireAsset(path: string, assets: VoiceExperimentAssetMap, findings: VoiceExperimentFinding[]): string | null {
  const content = assets[path];
  if (content !== undefined) return content;
  findings.push({ code: "missing-asset", path, message: `Voice experiment asset is missing: ${path}.` });
  return null;
}

function verifyHash(path: string, content: string, expected: string, findings: VoiceExperimentFinding[], variantId?: "A" | "B" | "C"): void {
  if (stableContentHash(content) !== expected) findings.push({ code: "hash-mismatch", path, ...(variantId ? { variantId } : {}), message: `Voice experiment hash does not match ${path}.` });
}

function inCalibrationRange(content: string): boolean {
  const count = countWords(content);
  return count >= 600 && count <= 900;
}

export function voiceExperimentFindings(experiment: VoiceExperimentFile, assets: VoiceExperimentAssetMap, taste: TasteProfile): VoiceExperimentFinding[] {
  const findings: VoiceExperimentFinding[] = [];
  const source = requireAsset(experiment.source_scene_path, assets, findings);
  if (source !== null) {
    verifyHash(experiment.source_scene_path, source, experiment.source_scene_hash, findings);
    if (!inCalibrationRange(source)) findings.push({ code: "source-word-count", path: experiment.source_scene_path, message: `${experiment.source_scene_path} must contain 600–900 words.` });
  }

  for (const variant of experiment.variants) {
    const content = requireAsset(variant.path, assets, findings);
    if (content === null) continue;
    verifyHash(variant.path, content, variant.content_hash, findings, variant.id);
    if (!inCalibrationRange(content)) findings.push({ code: "variant-word-count", path: variant.path, variantId: variant.id, message: `Variant ${variant.id} must contain 600–900 words.` });
    if (contentSafetyFindings(content, taste).length) findings.push({ code: "variant-reference", path: variant.path, variantId: variant.id, message: `Variant ${variant.id} contains imitation language or a raw influence reference.` });
  }

  if (experiment.baseline_path !== null && experiment.baseline_hash !== null) {
    const baseline = requireAsset(experiment.baseline_path, assets, findings);
    if (baseline !== null) {
      verifyHash(experiment.baseline_path, baseline, experiment.baseline_hash, findings);
      if (!inCalibrationRange(baseline)) findings.push({ code: "baseline-word-count", path: experiment.baseline_path, message: `${experiment.baseline_path} must contain 600–900 words.` });
      if (contentSafetyFindings(baseline, taste).length) findings.push({ code: "baseline-reference", path: experiment.baseline_path, message: "The accepted voice baseline contains imitation language or a raw influence reference." });
    }
  }

  return findings;
}

export function summarizeVoiceScores(experiment: VoiceExperimentFile): VoiceScoreSummary[] {
  const dimensions = ["feels_like_book", "desire_to_continue", "character_intimacy", "prose_naturalness", "distinctiveness"] as const;
  const summaries: VoiceScoreSummary[] = [];
  for (const variantId of ["A", "B", "C"] as const) {
    const scores = experiment.scores.filter((score) => score.variant_id === variantId);
    if (!scores.length) continue;
    const total = scores.reduce((sum, score) => sum + dimensions.reduce((dimensionSum, dimension) => dimensionSum + score[dimension], 0), 0);
    const density = scores.reduce((sum, score) => sum + score.density, 0);
    summaries.push({
      variantId,
      evaluatorCount: scores.length,
      average: rounded(total / (scores.length * dimensions.length)),
      densityAverage: rounded(density / scores.length),
    });
  }
  return summaries.sort((left, right) => right.average - left.average || left.variantId.localeCompare(right.variantId));
}

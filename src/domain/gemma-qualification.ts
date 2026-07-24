import type { ModelFingerprint } from "./model-fingerprint.js";
import type { ModelJobType } from "./model-job.js";

export interface GemmaQualificationCase {
  id: string;
  job_type: ModelJobType;
  prompt: string;
  context: string;
  expected: {
    valid_structured_output: boolean;
    required_record_ids: string[];
    forbidden_record_ids: string[];
    must_stop: boolean;
  };
}

export interface GemmaQualificationReport {
  schema_version: "1.0.0";
  fingerprint: ModelFingerprint;
  case_count: number;
  first_pass_structured_rate: number;
  corrected_structured_rate: number;
  required_record_rate: number;
  forbidden_record_uses: number;
  correct_stop_rate: number;
  severe_failure_count: number;
  report_hash: string;
}

export const GEMMA_QUALIFICATION_THRESHOLDS = Object.freeze({
  first_pass_structured_rate: 0.95,
  corrected_structured_rate: 0.99,
  required_record_rate: 1,
  forbidden_record_uses: 0,
  correct_stop_rate: 0.95,
  severe_failure_count: 0,
});

export interface GemmaQualificationPromotion {
  qualified: boolean;
  failures: string[];
}

export function evaluateGemmaQualificationPromotion(
  report: GemmaQualificationReport,
): GemmaQualificationPromotion {
  const failures: string[] = [];
  const isRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
  if (!isRate(report.first_pass_structured_rate)
    || report.first_pass_structured_rate < GEMMA_QUALIFICATION_THRESHOLDS.first_pass_structured_rate) {
    failures.push("First-pass structured validity is below 0.95.");
  }
  if (!isRate(report.corrected_structured_rate)
    || report.corrected_structured_rate < GEMMA_QUALIFICATION_THRESHOLDS.corrected_structured_rate) {
    failures.push("Corrected structured validity is below 0.99.");
  }
  if (!isRate(report.required_record_rate)
    || report.required_record_rate !== GEMMA_QUALIFICATION_THRESHOLDS.required_record_rate) {
    failures.push("Required-record use must be 1.00.");
  }
  if (!Number.isInteger(report.forbidden_record_uses)
    || report.forbidden_record_uses !== GEMMA_QUALIFICATION_THRESHOLDS.forbidden_record_uses) {
    failures.push("Forbidden-record use must be 0.");
  }
  if (!isRate(report.correct_stop_rate)
    || report.correct_stop_rate < GEMMA_QUALIFICATION_THRESHOLDS.correct_stop_rate) {
    failures.push("Correct stop/escalation rate is below 0.95.");
  }
  if (!Number.isInteger(report.severe_failure_count)
    || report.severe_failure_count !== GEMMA_QUALIFICATION_THRESHOLDS.severe_failure_count) {
    failures.push("Severe failure count must be 0.");
  }
  return { qualified: failures.length === 0, failures };
}

export function assertGemmaQualificationPromotion(report: GemmaQualificationReport): void {
  const promotion = evaluateGemmaQualificationPromotion(report);
  if (!promotion.qualified) {
    throw new Error(`Gemma qualification failed promotion gates:\n- ${promotion.failures.join("\n- ")}`);
  }
}

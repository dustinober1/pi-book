import { createHash } from "node:crypto";
import { MODEL_EXECUTION_PROFILES } from "./model-execution-profile.js";
import type { ModelFingerprint } from "./model-fingerprint.js";
import { assertGemmaFingerprintMatchesProfile } from "./model-fingerprint.js";
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
  provenance: {
    evaluator_revision: "2.0.0";
    fixture_suite_hash: string;
    rubric_hash: string;
    rubric_version: string;
    seed_hash: string;
  };
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeGemmaQualificationReportHash(
  report: Omit<GemmaQualificationReport, "report_hash">,
): string {
  return createHash("sha256").update(stableJson(report)).digest("hex");
}

function assertRate(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Gemma qualification ${label} must be a finite rate from 0 to 1.`);
  }
}

function assertExactKeys(value: object, allowedKeys: readonly string[], label: string): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Gemma qualification ${label} has unknown fields: ${unknown.join(", ")}.`);
}

export function assertGemmaQualificationReportIntegrity(report: GemmaQualificationReport): void {
  assertExactKeys(report, [
    "schema_version",
    "fingerprint",
    "provenance",
    "case_count",
    "first_pass_structured_rate",
    "corrected_structured_rate",
    "required_record_rate",
    "forbidden_record_uses",
    "correct_stop_rate",
    "severe_failure_count",
    "report_hash",
  ], "report");
  if (report.schema_version !== "1.0.0") throw new Error("Gemma qualification report schema version must be 1.0.0.");
  if (!Number.isInteger(report.case_count) || report.case_count < 1) {
    throw new Error("Gemma qualification report case count must be a positive integer.");
  }
  if (report.fingerprint.schema_version !== "1.0.0" || !report.fingerprint.provider.trim()) {
    throw new Error("Gemma qualification report fingerprint metadata is invalid.");
  }
  assertExactKeys(report.fingerprint, [
    "schema_version",
    "profile_id",
    "provider",
    "model",
    "backend",
    "backend_version",
    "quantization",
    "context_window_tokens",
    "maximum_output_tokens",
    "chat_template_hash",
    "model_file_hash",
  ], "report fingerprint");
  assertGemmaFingerprintMatchesProfile(
    report.fingerprint,
    MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"],
  );
  const provenance = report.provenance;
  if (!provenance || provenance.evaluator_revision !== "2.0.0") {
    throw new Error("Gemma qualification evaluator revision must be 2.0.0.");
  }
  assertExactKeys(provenance, [
    "evaluator_revision",
    "fixture_suite_hash",
    "rubric_hash",
    "rubric_version",
    "seed_hash",
  ], "report provenance");
  const hash = /^[a-f0-9]{64}$/;
  for (const [label, value] of [
    ["fixture suite hash", provenance.fixture_suite_hash],
    ["rubric hash", provenance.rubric_hash],
    ["seed hash", provenance.seed_hash],
  ] as const) {
    if (!hash.test(value)) throw new Error(`Gemma qualification ${label} is invalid.`);
  }
  if (!provenance.rubric_version.trim()) throw new Error("Gemma qualification rubric version must be nonblank.");
  assertRate(report.first_pass_structured_rate, "first-pass structured rate");
  assertRate(report.corrected_structured_rate, "corrected structured rate");
  assertRate(report.required_record_rate, "required-record rate");
  assertRate(report.correct_stop_rate, "correct stop rate");
  if (!Number.isInteger(report.forbidden_record_uses) || report.forbidden_record_uses < 0) {
    throw new Error("Gemma qualification forbidden-record uses must be a nonnegative integer.");
  }
  if (!Number.isInteger(report.severe_failure_count) || report.severe_failure_count < 0) {
    throw new Error("Gemma qualification severe failure count must be a nonnegative integer.");
  }
  if (!hash.test(report.report_hash)
    || report.report_hash !== computeGemmaQualificationReportHash((({ report_hash: _, ...unsigned }) => unsigned)(report))) {
    throw new Error("Gemma qualification report hash integrity check failed.");
  }
}

export function evaluateGemmaQualificationPromotion(
  report: GemmaQualificationReport,
): GemmaQualificationPromotion {
  assertGemmaQualificationReportIntegrity(report);
  const failures: string[] = [];
  if (report.first_pass_structured_rate < GEMMA_QUALIFICATION_THRESHOLDS.first_pass_structured_rate) {
    failures.push("First-pass structured validity is below 0.95.");
  }
  if (report.corrected_structured_rate < GEMMA_QUALIFICATION_THRESHOLDS.corrected_structured_rate) {
    failures.push("Corrected structured validity is below 0.99.");
  }
  if (report.required_record_rate !== GEMMA_QUALIFICATION_THRESHOLDS.required_record_rate) {
    failures.push("Required-record use must be 1.00.");
  }
  if (report.forbidden_record_uses !== GEMMA_QUALIFICATION_THRESHOLDS.forbidden_record_uses) {
    failures.push("Forbidden-record use must be 0.");
  }
  if (report.correct_stop_rate < GEMMA_QUALIFICATION_THRESHOLDS.correct_stop_rate) {
    failures.push("Correct stop/escalation rate is below 0.95.");
  }
  if (report.severe_failure_count !== GEMMA_QUALIFICATION_THRESHOLDS.severe_failure_count) {
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

export type LintClass = "mechanical" | "consistency" | "repetition" | "style-pattern";

export type LintConfidence = "high" | "medium" | "review";

export interface LintFinding {
  ruleId: string;
  ruleVersion: string;
  class: LintClass;
  confidence: LintConfidence;
  location: { path: string; line?: number };
  excerpt: string;
  message: string;
  evidence: Record<string, string | number | boolean>;
  reviewAction: string;
}

export interface ManuscriptDocument {
  path: string;
  order: number;
  text: string;
  scanText: string;
  lines: readonly string[];
  tokens: readonly string[];
  sentences: readonly { text: string; line: number }[];
  paragraphs: readonly { text: string; line: number; tokens: readonly string[] }[];
  wordCount: number;
}

export interface ProseLintInput {
  documents: readonly ManuscriptDocument[];
  baselineMetrics?: Readonly<Record<string, number>>;
  rules: readonly LintRule[];
}

export interface LintRule {
  id: string;
  version: string;
  run(input: ProseLintInput): LintFinding[];
}

export interface ProseLintResult {
  findings: LintFinding[];
  failures: Array<{ ruleId: string; message: string }>;
  counts: Record<LintClass, number>;
  wordCount: number;
}

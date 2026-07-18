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
  projectContext?: ProjectLintContext;
  rules: readonly LintRule[];
}

export interface ProjectLintContext {
  projectRoot: string;
  bookId: string;
  chapterFiles: readonly { path: string; number: number | null }[];
  canonEntries: readonly { id: string; subject: string; fact: string; locked: boolean }[];
  canonNames: readonly string[];
  canonIds: readonly string[];
  threadIds: readonly string[];
  sourceIds: readonly string[];
  packetReferences: readonly { chapter: number; kind: "canon" | "thread" | "source"; id: string }[];
  plotThreadReferences: readonly { chapter: number; id: string }[];
}

export interface ReportOptions {
  title?: string;
  rulePrefixes?: readonly string[];
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

import type { ReaderExperimentFile, ReaderExperimentIndex, ReaderResponseV2 } from "../../domain/v1-2-schemas.js";

export type ReaderKitScopeV2 = "first-page" | "first-chapter" | "selected-chapters" | "act" | "excerpt" | "manuscript";

export interface ReaderKitProposal {
  scope: ReaderKitScopeV2;
  targetReader: string;
  minimumImmediateCount: number;
  minimumDelayedCount: number;
  delayedAfterHours: number;
  variant?: string;
  blind?: boolean;
  questionnaireVersion?: string;
  chapterNumbers?: number[];
  actId?: string;
  excerptPath?: string;
  privacyInstructions?: string;
}

export interface ReaderKitPreview {
  proposal: ReaderKitProposal;
  sourcePaths: string[];
  sample: string;
  wordCount: number;
  sampleHash: string;
  warnings: string[];
}

export type ReaderCanonicalColumn =
  | "schema_version" | "experiment_id" | "questionnaire_version" | "phase" | "reader_id" | "source" | "segment" | "recorded_at"
  | "continued_reading" | "would_buy" | "confusions" | "trust_breaks" | "lines_that_worked" | "remembered_hook" | "remembered_moments"
  | "friend_description" | "disagreement_question" | "lingering_question" | "recommendation_target" | "recommendation_reason" | "told_someone";

export interface ReaderColumnMapping { sourceToCanonical: Record<string, ReaderCanonicalColumn | null> }
export type ReaderImportRowStatus = "new" | "duplicate" | "conflict" | "invalid" | "non-evidence" | "unmatched-delayed";

export interface ReaderImportPreviewRow {
  rowNumber: number;
  status: ReaderImportRowStatus;
  key: string;
  response: ReaderResponseV2 | null;
  errors: string[];
  original: Record<string, string>;
}

export interface ReaderImportPreview {
  experimentId: string;
  sourceHash: string;
  headers: string[];
  mapping: ReaderColumnMapping;
  rows: ReaderImportPreviewRow[];
  counts: Record<ReaderImportRowStatus, number>;
}

export type ReaderConflictDecision = "keep-existing" | "use-imported" | "exclude";
export interface ReaderMergeProposal {
  decisions: Record<string, ReaderConflictDecision>;
}

export interface ReaderMigrationResult { migratedIds: string[]; legacyHash: string; changed: string[]; gitSha: string | null }
export type { ReaderExperimentFile, ReaderExperimentIndex, ReaderResponseV2 };

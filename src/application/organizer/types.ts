import type { ProfileId, ProjectType } from "../../domain/schemas.js";
import type { RuntimeProfileId } from "../../domain/runtime-profile.js";

export type OrganizerCategory =
  | "chapter"
  | "draft"
  | "outline"
  | "character-note"
  | "series-note"
  | "research"
  | "editorial"
  | "note"
  | "document"
  | "asset"
  | "duplicate"
  | "excluded";

export type OrganizerConfidence = "structural" | "provisional" | "excluded";

export interface OrganizerCandidate {
  id: string;
  originalPath: string;
  category: OrganizerCategory;
  confidence: OrganizerConfidence;
  reason: string;
  destination: string | null;
  duplicateOf: string | null;
  byteSize: number;
  sha256: string;
  selected: boolean;
  archive: boolean;
  chapterNumber: number | null;
  excerpt: string | null;
}

export interface OrganizationPreview {
  previewId: string;
  previewHash: string;
  rootName: string;
  candidates: OrganizerCandidate[];
  warnings: string[];
  totals: {
    scanned: number;
    selected: number;
    excluded: number;
    archive: number;
    bytes: number;
  };
}

export interface OrganizationProjectOptions {
  projectName: string;
  projectType: ProjectType;
  profile: ProfileId;
  targetWords?: number;
  runtimeProfile?: RuntimeProfileId;
}

export interface OrganizationApplyOptions {
  project: OrganizationProjectOptions;
  selectedCandidateIds?: string[];
  confirmApply: boolean;
  confirmArchive: boolean;
  confirmProvisional: boolean;
  now?: Date;
  simulateFailureAfter?: number;
}

export interface OrganizationApplyResult {
  root: string;
  organized: number;
  archived: number;
  chapters: number;
  words: number;
  archiveRoot: string;
  manifestPath: string;
  reportPath: string;
  changed: string[];
  gitMessage: string;
}

export type AdoptionSectionKind = "front-matter" | "chapter" | "interlude" | "appendix" | "back-matter";

export interface AdoptionWarning {
  code: string;
  message: string;
  severity: "warning" | "blocker";
}

export interface AdoptionSection {
  id: string;
  sourceOrder: number;
  kind: AdoptionSectionKind;
  number: number | null;
  title: string;
  markdown: string;
  wordCount: number;
  sourceRefs: string[];
  included: boolean;
}

export interface AdoptionAsset {
  id: string;
  originalName: string;
  mediaType: string;
  bytes: Uint8Array;
  hash: string;
  width: number | null;
  height: number | null;
  caption: string;
  altText: string;
  placementAfterSectionId: string | null;
}

export interface AdoptionPreview {
  previewId: string;
  source: { originalName: string; extension: string; byteSize: number; sourceHash: string };
  engine: { name: "pandoc" | "node-docx" | "node-epub" | "plain-text"; version: string };
  sections: AdoptionSection[];
  assets: AdoptionAsset[];
  metadataCandidates: Record<string, string>;
  warnings: AdoptionWarning[];
  sourceWordCount: number;
  proposedWordCount: number;
}

export type AdoptionMappingOperation =
  | { type: "rename"; sectionId: string; title: string }
  | { type: "renumber"; sectionId: string; number: number | null }
  | { type: "reorder"; sectionIds: string[] }
  | { type: "classify"; sectionId: string; kind: AdoptionSectionKind }
  | { type: "exclude"; sectionId: string; excluded: boolean }
  | { type: "split"; sectionId: string; blockIndex: number; title: string }
  | { type: "combine"; firstSectionId: string; secondSectionId: string; title: string };

export interface AdoptionMappingProposal {
  operations: AdoptionMappingOperation[];
  assetEdits?: Array<{ assetId: string; caption?: string; altText?: string; placementAfterSectionId?: string | null }>;
  metadata?: Record<string, { action: "accept" | "edit" | "ignore"; value?: string }>;
}

export interface MappedAdoption {
  sections: AdoptionSection[];
  assets: AdoptionAsset[];
  metadata: Record<string, string>;
  metadataDecisions: Record<string, "accepted" | "edited" | "ignored">;
  warnings: AdoptionWarning[];
}

export interface AdoptionFinding {
  severity: "blocker" | "warning";
  message: string;
}

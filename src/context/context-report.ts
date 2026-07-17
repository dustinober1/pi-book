import type { RuntimeProfileId } from "../domain/runtime-profile.js";

export type ContextSectionStatus = "included" | "compacted" | "omitted" | "blocked";

export interface ContextSectionReport {
  id: string;
  title: string;
  required: boolean;
  priority: number;
  status: ContextSectionStatus;
  sourceChars: number;
  renderedChars: number;
  estimatedTokens: number;
  recordIds: string[];
  reason?: string;
}

export interface ContextBuildReport {
  schemaVersion: "1.0.0";
  profileId: RuntimeProfileId;
  maxChars: number;
  renderedChars: number;
  estimatedTokens: number;
  sections: ContextSectionReport[];
  warnings: string[];
}

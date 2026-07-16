import type { TSchema } from "@sinclair/typebox";
import { PlotGridPhase4Schema } from "./v1-3-architecture-schemas.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  VoiceAuditsPhase5Schema,
} from "./v1-3-audit-schemas.js";
import { SourceRegisterV13Schema } from "./v1-3-research-schemas.js";
import {
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
} from "./v1-3-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/(^|\/)taste-profile\.yaml$/, TasteProfileSchema],
  [/(^|\/)voice-guardrails\.yaml$/, VoiceGuardrailsSchema],
  [/(^|\/)voice-experiments\/index\.yaml$/, VoiceExperimentIndexSchema],
  [/(^|\/)voice-experiments\/VE-[0-9]{3}\/experiment\.yaml$/, VoiceExperimentFileSchema],
  [/(^|\/)research-ledger\.yaml$/, ResearchLedgerSchema],
  [/(^|\/)book-strategy\.yaml$/, BookStrategyPhase5Schema],
  [/(^|\/)plot-grid\.yaml$/, PlotGridPhase4Schema],
  [/(^|\/)revision-tickets\.yaml$/, RevisionTicketsPhase5Schema],
  [/(^|\/)voice-audits\.yaml$/, VoiceAuditsPhase5Schema],
  [/(^|\/)source-register\.yaml$/, SourceRegisterV13Schema],
];

export function v13SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

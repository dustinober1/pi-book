import type { TSchema } from "@sinclair/typebox";
import { BookStrategyPhase3Schema, SourceRegisterV13Schema } from "./v1-3-research-schemas.js";
import {
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceAuditsSchema,
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
  [/(^|\/)book-strategy\.yaml$/, BookStrategyPhase3Schema],
  [/(^|\/)voice-audits\.yaml$/, VoiceAuditsSchema],
  [/(^|\/)source-register\.yaml$/, SourceRegisterV13Schema],
];

export function v13SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

import type { TSchema } from "@sinclair/typebox";
import {
  BookStrategySchema,
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceAuditsSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
} from "./v1-3-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/(^|\/)series\/taste-profile\.yaml$/, TasteProfileSchema],
  [/(^|\/)series\/voice-guardrails\.yaml$/, VoiceGuardrailsSchema],
  [/(^|\/)series\/voice-experiments\/index\.yaml$/, VoiceExperimentIndexSchema],
  [/(^|\/)series\/voice-experiments\/VE-[0-9]{3}\/experiment\.yaml$/, VoiceExperimentFileSchema],
  [/(^|\/)books\/book-[0-9]{2}\/research-ledger\.yaml$/, ResearchLedgerSchema],
  [/(^|\/)books\/book-[0-9]{2}\/book-strategy\.yaml$/, BookStrategySchema],
  [/(^|\/)books\/book-[0-9]{2}\/voice-audits\.yaml$/, VoiceAuditsSchema],
];

export function v13SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

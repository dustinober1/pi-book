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
  [/(^|\/)taste-profile\.yaml$/, TasteProfileSchema],
  [/(^|\/)voice-guardrails\.yaml$/, VoiceGuardrailsSchema],
  [/(^|\/)voice-experiments\/index\.yaml$/, VoiceExperimentIndexSchema],
  [/(^|\/)voice-experiments\/VE-[0-9]{3}\/experiment\.yaml$/, VoiceExperimentFileSchema],
  [/(^|\/)research-ledger\.yaml$/, ResearchLedgerSchema],
  [/(^|\/)book-strategy\.yaml$/, BookStrategySchema],
  [/(^|\/)voice-audits\.yaml$/, VoiceAuditsSchema],
];

export function v13SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

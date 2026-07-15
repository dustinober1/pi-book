import { VOICE_PRECEDENCE_VALUES } from "../domain/v1-3-schemas.js";

export type VoiceEvidenceLayer = typeof VOICE_PRECEDENCE_VALUES[number];
export const VOICE_PRECEDENCE: readonly VoiceEvidenceLayer[] = VOICE_PRECEDENCE_VALUES;

export interface VoiceRuleSet {
  must: string[];
  prefer: string[];
  avoid: string[];
  monitor: string[];
}

export interface VoiceCompilationInput {
  explicitWriterDecisions: VoiceRuleSet;
  writerSamples: VoiceRuleSet;
  acceptedBaseline: VoiceRuleSet;
  approvedVoiceProfile: VoiceRuleSet;
  influenceReferences: VoiceRuleSet;
  genreDefaults: VoiceRuleSet;
}

export interface SuppressedVoiceRule {
  rule: string;
  category: keyof VoiceRuleSet;
  layer: VoiceEvidenceLayer;
  winnerLayer: VoiceEvidenceLayer;
}

export interface VoiceCompilationResult {
  guardrails: VoiceRuleSet;
  suppressed: SuppressedVoiceRule[];
}

function normalizedRule(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function compileVoiceGuardrails(input: VoiceCompilationInput): VoiceCompilationResult {
  const layers: Record<VoiceEvidenceLayer, VoiceRuleSet> = {
    "explicit-writer-decisions": input.explicitWriterDecisions,
    "writer-samples": input.writerSamples,
    "accepted-voice-baseline": input.acceptedBaseline,
    "approved-voice-profile": input.approvedVoiceProfile,
    "influence-references": input.influenceReferences,
    "genre-defaults": input.genreDefaults,
  };
  const guardrails: VoiceRuleSet = { must: [], prefer: [], avoid: [], monitor: [] };
  const claimed = new Map<string, { layer: VoiceEvidenceLayer; category: keyof VoiceRuleSet }>();
  const suppressed: SuppressedVoiceRule[] = [];

  for (const layer of VOICE_PRECEDENCE) {
    for (const category of ["must", "prefer", "avoid", "monitor"] as const) {
      for (const raw of layers[layer][category]) {
        const rule = raw.trim();
        if (!rule) continue;
        const normalized = normalizedRule(rule);
        const winner = claimed.get(normalized);
        if (winner) {
          suppressed.push({ rule, category, layer, winnerLayer: winner.layer });
          continue;
        }
        claimed.set(normalized, { layer, category });
        guardrails[category].push(rule);
      }
    }
  }

  return { guardrails, suppressed };
}

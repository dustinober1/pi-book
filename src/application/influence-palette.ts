import { VOICE_PRECEDENCE_VALUES, type TasteProfile, type VoiceGuardrails } from "../domain/v1-3-schemas.js";

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

export interface VoiceSafetyFinding {
  code: "direct-imitation" | "raw-reference";
  path: string;
  message: string;
}

export interface VoiceSafetyInput {
  taste: TasteProfile;
  voiceProfile: string;
  guardrails: VoiceGuardrails;
}

const IMITATION_PATTERNS = [
  /\bwrite like\b/i,
  /\bimitate\b/i,
  /\bin the style of\b/i,
  /\bsound like\b/i,
  /\bchannel (?:the voice of )?\b/i,
];

function normalizedRule(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function guardrailStrings(value: VoiceGuardrails): string[] {
  return [
    ...value.must,
    ...value.prefer,
    ...value.avoid,
    ...value.monitor,
    ...value.pov_signatures.flatMap((item) => [...item.must, ...item.prefer, ...item.avoid]),
  ];
}

function referenceTokens(taste: TasteProfile): string[] {
  return [...taste.influences.map((item) => item.reference), ...taste.negative_references.map((item) => item.reference)]
    .flatMap((reference) => [reference, ...reference.split(/[—–:\-]/).map((item) => item.trim())])
    .filter((item, index, values) => item.length >= 4 && values.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
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

export function voiceSafetyFindings(input: VoiceSafetyInput): VoiceSafetyFinding[] {
  const targets = [
    { path: "series/voice-profile.md", text: input.voiceProfile },
    ...guardrailStrings(input.guardrails).map((text) => ({ path: "series/voice-guardrails.yaml", text })),
  ];
  const references = referenceTokens(input.taste);
  const findings: VoiceSafetyFinding[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    if (IMITATION_PATTERNS.some((pattern) => pattern.test(target.text))) {
      const key = `direct-imitation:${target.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push({ code: "direct-imitation", path: target.path, message: `${target.path} contains direct imitation language.` });
      }
    }
    for (const reference of references) {
      if (!target.text.toLowerCase().includes(reference.toLowerCase())) continue;
      const key = `raw-reference:${target.path}:${reference.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ code: "raw-reference", path: target.path, message: `${target.path} exposes raw influence reference ${reference}.` });
    }
  }

  return findings;
}

export function renderContextGuardrails(guardrails: VoiceGuardrails, pov?: string): string {
  const lines = [
    ...guardrails.must.map((rule) => `MUST: ${rule}`),
    ...guardrails.prefer.map((rule) => `PREFER: ${rule}`),
    ...guardrails.avoid.map((rule) => `AVOID: ${rule}`),
    ...guardrails.monitor.map((rule) => `MONITOR: ${rule}`),
  ];
  const signature = pov ? guardrails.pov_signatures.find((item) => item.pov === pov) : undefined;
  if (signature) {
    lines.push(
      ...signature.must.map((rule) => `POV MUST: ${rule}`),
      ...signature.prefer.map((rule) => `POV PREFER: ${rule}`),
      ...signature.avoid.map((rule) => `POV AVOID: ${rule}`),
    );
  }
  return lines.join("\n");
}

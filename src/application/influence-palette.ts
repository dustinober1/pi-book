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
  voiceProfile?: string | null;
  guardrails: VoiceGuardrails;
}

interface ReferenceMatcher {
  reference: string;
  pattern: RegExp;
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(value: string, caseInsensitive: boolean): RegExp {
  const phrase = value.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, caseInsensitive ? "iu" : "u");
}

function referenceMatchers(taste: TasteProfile): ReferenceMatcher[] {
  const references = [...taste.influences.map((item) => item.reference), ...taste.negative_references.map((item) => item.reference)];
  const matchers: ReferenceMatcher[] = [];
  const seen = new Set<string>();

  function add(reference: string, caseInsensitive: boolean): void {
    const value = reference.trim();
    if (value.length < 4) return;
    const key = `${caseInsensitive ? "i" : "s"}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    matchers.push({ reference: value, pattern: phrasePattern(value, caseInsensitive) });
  }

  for (const rawReference of references) {
    const reference = rawReference.trim();
    if (!reference) continue;
    add(reference, true);

    const parts = reference.split(/\s*(?:—|–|:)\s*|\s+-\s+/).map((item) => item.trim()).filter(Boolean);
    parts.forEach((part, index) => {
      const wordCount = part.split(/\s+/).length;
      if (index === 0) {
        add(part, wordCount > 1);
        return;
      }
      // Short work titles are matched case-sensitively so ordinary prose such as
      // "walked down the road" does not collide with a reference to "The Road".
      add(part, wordCount > 3);
    });
  }

  return matchers;
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
    { path: "series/voice-profile.md", text: input.voiceProfile ?? "" },
    ...guardrailStrings(input.guardrails).map((text) => ({ path: "series/voice-guardrails.yaml", text })),
  ];
  const references = referenceMatchers(input.taste);
  const findings: VoiceSafetyFinding[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const text = typeof target.text === "string" ? target.text : "";
    if (IMITATION_PATTERNS.some((pattern) => pattern.test(text))) {
      const key = `direct-imitation:${target.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push({ code: "direct-imitation", path: target.path, message: `${target.path} contains direct imitation language.` });
      }
    }
    for (const matcher of references) {
      if (!matcher.pattern.test(text)) continue;
      const key = `raw-reference:${target.path}:${matcher.reference.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ code: "raw-reference", path: target.path, message: `${target.path} exposes raw influence reference ${matcher.reference}.` });
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

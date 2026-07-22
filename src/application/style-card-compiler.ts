import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { StyleCardSchema, type StyleCard, type StyleCardExample, type StyleCardSource } from "../domain/style-card.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";

const VOICE_PROFILE_PATH = "series/voice-profile.md";
const VOICE_GUARDRAILS_PATH = "series/voice-guardrails.yaml";
const MAX_ACTIVE_RULES = 15;
const MAX_EXAMPLES = 2;
const MAX_EXAMPLE_CHARS = 240;
const MAX_RECENT_PATTERNS = 8;

export interface CompileProjectStyleCardOptions {
  acceptedExamplePaths?: string[];
  recentPatternsToAvoid?: string[];
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeText(value: string): string {
  return value.trim().replace(/^[-*]\s+/, "").replace(/\s+/g, " ");
}

function unique(values: readonly string[], maximum = Number.POSITIVE_INFINITY): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = normalizeText(raw);
    if (!value) continue;
    const key = value.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= maximum) break;
  }
  return result;
}

function safeRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe style-card source path: ${path}`);
  }
  return normalized;
}

function requiredText(root: string, path: string): string {
  const text = readText(join(root, safeRelativePath(path)));
  if (text === null) throw new Error(`Style-card source is missing: ${path}`);
  return text;
}

function markdownSections(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current = "";
  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading?.[1]) {
      current = normalizeText(heading[1]).toLocaleLowerCase("en-US");
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (!current || /^#\s/.test(rawLine)) continue;
    const line = normalizeText(rawLine);
    if (line) sections.get(current)!.push(line);
  }
  return sections;
}

function section(sections: Map<string, string[]>, names: readonly string[], maximum: number): string[] {
  for (const name of names) {
    const values = sections.get(name.toLocaleLowerCase("en-US"));
    if (values?.length) return unique(values, maximum);
  }
  return [];
}

function first(sections: Map<string, string[]>, names: readonly string[]): string | null {
  return section(sections, names, 1)[0] ?? null;
}

function prefixed(prefix: string, values: readonly string[]): string[] {
  return values.map((value) => `${prefix}: ${normalizeText(value)}`);
}

function example(root: string, path: string): { example: StyleCardExample; source: StyleCardSource } {
  const sourcePath = safeRelativePath(path);
  const text = requiredText(root, sourcePath);
  const sourceHash = hashText(text);
  const excerpt = normalizeText(text).slice(0, MAX_EXAMPLE_CHARS).trim();
  if (!excerpt) throw new Error(`Accepted style example is empty: ${sourcePath}`);
  return {
    example: { source_path: sourcePath, source_hash: sourceHash, excerpt },
    source: { path: sourcePath, hash: sourceHash },
  };
}

function stableCardId(value: Omit<StyleCard, "style_id">): string {
  return `STYLE-${hashText(JSON.stringify(value)).slice(0, 16).toUpperCase()}`;
}

export function compileProjectStyleCard(
  root: string,
  pov: string,
  options: CompileProjectStyleCardOptions = {},
): StyleCard {
  const normalizedPov = normalizeText(pov);
  if (!normalizedPov) throw new Error("Style cards require a POV identifier.");

  const profileText = requiredText(root, VOICE_PROFILE_PATH);
  const guardrailText = requiredText(root, VOICE_GUARDRAILS_PATH);
  const guardrails = parseYaml<VoiceGuardrails>(guardrailText, VoiceGuardrailsSchema, VOICE_GUARDRAILS_PATH);
  const sections = markdownSections(profileText);
  const signature = guardrails.pov_signatures.find((item) => item.pov === normalizedPov);

  const sentenceDensity = section(sections, ["sentence and paragraph behavior", "sentence density"], 3);
  const dialogueRules = section(sections, ["dialogue behavior", "dialogue rules"], 4);
  const interiorityLimits = section(sections, ["emotional restraint and intensity", "interiority limits"], 3);
  const descriptionLimits = section(sections, ["description limits", "description behavior"], 3);
  const voiceMarkers = section(sections, ["character voice markers", "positive voice evidence"], 4);
  const profileProhibitions = section(sections, ["prohibited habits", "not-this-author evidence"], 6);
  const prohibitedHabits = unique([
    ...profileProhibitions,
    ...(signature?.avoid ?? []),
    ...guardrails.avoid,
  ], 6);

  const activeRules = unique([
    ...prefixed("POV MUST", signature?.must ?? []),
    ...prefixed("MUST", guardrails.must),
    ...prefixed("POV PREFER", signature?.prefer ?? []),
    ...prefixed("PREFER", guardrails.prefer),
    ...prefixed("VOICE", voiceMarkers),
    ...prefixed("SENTENCE", sentenceDensity),
    ...prefixed("DIALOGUE", dialogueRules),
    ...prefixed("INTERIORITY", interiorityLimits),
    ...prefixed("DESCRIPTION", descriptionLimits),
    ...prefixed("POV AVOID", signature?.avoid ?? []),
    ...prefixed("AVOID", guardrails.avoid),
    ...prefixed("MONITOR", guardrails.monitor),
  ], MAX_ACTIVE_RULES);
  if (!activeRules.length) throw new Error(`Style card for ${normalizedPov} has no approved rules.`);

  const accepted = unique(options.acceptedExamplePaths ?? [], MAX_EXAMPLES).map((path) => example(root, path));
  const sourceHashes: StyleCardSource[] = [
    { path: VOICE_PROFILE_PATH, hash: hashText(profileText) },
    { path: VOICE_GUARDRAILS_PATH, hash: hashText(guardrailText) },
    ...accepted.map((item) => item.source),
  ];
  const withoutId: Omit<StyleCard, "style_id"> = {
    schema_version: "1.0.0",
    pov: normalizedPov,
    source_hashes: sourceHashes,
    pov_distance: first(sections, ["pov distance", "point of view distance"]),
    tense: first(sections, ["narrative tense", "tense"]),
    sentence_density: sentenceDensity,
    dialogue_rules: dialogueRules,
    interiority_limits: interiorityLimits,
    description_limits: descriptionLimits,
    voice_markers: voiceMarkers,
    prohibited_habits: prohibitedHabits,
    accepted_examples: accepted.map((item) => item.example),
    recent_patterns_to_avoid: unique(options.recentPatternsToAvoid ?? [], MAX_RECENT_PATTERNS),
    active_rules: activeRules,
  };
  const card: StyleCard = { ...withoutId, style_id: stableCardId(withoutId) };
  if (!Value.Check(StyleCardSchema, card)) throw new Error(`Compiled style card for ${normalizedPov} is invalid.`);
  return card;
}

export function styleCardIsStale(root: string, card: StyleCard): boolean {
  return card.source_hashes.some((source) => {
    const current = readText(join(root, safeRelativePath(source.path)));
    return current === null || hashText(current) !== source.hash;
  });
}

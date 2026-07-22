import type { RunOptions } from "../application/run.js";
import { parseModelExecutionProfileId, type ModelExecutionProfileId } from "../domain/model-execution-profile.js";
import {
  parseBudgetExhaustionPolicy,
  parseQualityTierId,
  type QualityRunOverride,
} from "../domain/quality-profile.js";
import {
  SCENE_CRITIC_JOB_TYPES,
  isSceneCriticJobType,
  type SceneCriticJobType,
} from "../domain/scene-critic-artifact.js";
import { parseRuntimeProfileId } from "../domain/runtime-profile.js";

export const allowedUntilTargets = ["voice-approval", "book-plan-approval", "first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-review", "next-milestone"] as const;
export function tokens(args: string): string[] { return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^["']|["']$/g, "")) ?? []; }
export function flagValue(items: string[], flag: string): string | undefined { const index = items.indexOf(flag); return index >= 0 ? items[index + 1] : undefined; }

export const qualityValueFlags = [
  "--quality-tier",
  "--max-total-tokens",
  "--max-tokens-per-chapter",
  "--max-calls-per-chapter",
  "--on-budget-exhaustion",
] as const;

function requiredFlagValue(items: string[], flag: string): string | undefined {
  if (!items.includes(flag)) return undefined;
  const value = flagValue(items, flag);
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function positiveFlag(items: string[], flag: string, label: string): number | undefined {
  const raw = requiredFlagValue(items, flag);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

export function parseQualityOverride(items: string[]): QualityRunOverride | undefined {
  const rawTier = requiredFlagValue(items, "--quality-tier");
  const rawExhaustion = requiredFlagValue(items, "--on-budget-exhaustion");
  const maximumTotalTokens = positiveFlag(items, "--max-total-tokens", "Maximum total tokens");
  const maximumTokensPerChapter = positiveFlag(items, "--max-tokens-per-chapter", "Maximum tokens per chapter");
  const maximumCallsPerChapter = positiveFlag(items, "--max-calls-per-chapter", "Maximum calls per chapter");
  const override: QualityRunOverride = {
    ...(rawTier !== undefined ? { tier: parseQualityTierId(rawTier) } : {}),
    ...(maximumTotalTokens !== undefined ? { maximumTotalTokens } : {}),
    ...(maximumTokensPerChapter !== undefined ? { maximumTokensPerChapter } : {}),
    ...(maximumCallsPerChapter !== undefined ? { maximumCallsPerChapter } : {}),
    ...(rawExhaustion !== undefined ? { onExhaustion: parseBudgetExhaustionPolicy(rawExhaustion) } : {}),
  };
  return Object.keys(override).length ? override : undefined;
}

export interface DraftOptions {
  chapter?: number;
  quality?: QualityRunOverride;
  modelExecutionProfile?: ModelExecutionProfileId;
}

export function parseDraftOptions(args: string): DraftOptions {
  const items = tokens(args);
  const flags = new Set<string>([...qualityValueFlags, "--model-profile"]);
  const positional: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (flags.has(item)) { index += 1; continue; }
    if (!item.startsWith("--")) positional.push(item);
  }
  if (positional.length > 1) throw new Error("/novel-draft accepts at most one chapter number.");
  let chapter: number | undefined;
  if (positional[0] !== undefined) {
    chapter = Number.parseInt(positional[0], 10);
    if (!/^\d+$/.test(positional[0]) || !Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter must be a positive integer.");
  }
  const quality = parseQualityOverride(items);
  const rawModelProfile = requiredFlagValue(items, "--model-profile");
  const modelExecutionProfile = rawModelProfile === undefined ? undefined : parseModelExecutionProfileId(rawModelProfile);
  return {
    ...(chapter !== undefined ? { chapter } : {}),
    ...(quality ? { quality } : {}),
    ...(modelExecutionProfile ? { modelExecutionProfile } : {}),
  };
}

const CRITIC_ALIASES: Readonly<Record<string, SceneCriticJobType>> = Object.freeze({
  continuity: "critic-continuity",
  causality: "critic-causality",
  "character-intent": "critic-character-intent",
  character: "critic-character-intent",
  style: "critic-style",
  factuality: "critic-factuality",
});

export interface ChapterStepOptions {
  chapter?: number;
  runId?: string;
  criticJobTypes: SceneCriticJobType[];
}

function parseCritics(raw: string | undefined): SceneCriticJobType[] {
  if (raw === undefined || raw.trim().toLocaleLowerCase("en-US") === "all") return [...SCENE_CRITIC_JOB_TYPES];
  const selected = new Set<SceneCriticJobType>();
  for (const token of raw.split(",").map((item) => item.trim().toLocaleLowerCase("en-US")).filter(Boolean)) {
    const resolved = CRITIC_ALIASES[token] ?? (isSceneCriticJobType(token) ? token : undefined);
    if (!resolved) throw new Error(`Unknown scene critic: ${token}. Use continuity, causality, character-intent, style, factuality, or all.`);
    selected.add(resolved);
  }
  if (!selected.size) throw new Error("--critics requires at least one critic.");
  return SCENE_CRITIC_JOB_TYPES.filter((jobType) => selected.has(jobType));
}

export function parseChapterStepOptions(args: string): ChapterStepOptions {
  const items = tokens(args);
  const flags = new Set(["--run", "--critics"]);
  const positional: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (flags.has(item)) { index += 1; continue; }
    if (!item.startsWith("--")) positional.push(item);
  }
  if (positional.length > 1) throw new Error("/novel-chapter-step accepts at most one chapter number.");
  let chapter: number | undefined;
  if (positional[0] !== undefined) {
    chapter = Number.parseInt(positional[0], 10);
    if (!/^\d+$/.test(positional[0]) || !Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter must be a positive integer.");
  }
  const runId = requiredFlagValue(items, "--run");
  return {
    ...(chapter !== undefined ? { chapter } : {}),
    ...(runId !== undefined ? { runId } : {}),
    criticJobTypes: parseCritics(requiredFlagValue(items, "--critics")),
  };
}

export interface ParsedRunOptions extends RunOptions {
  quality?: QualityRunOverride;
  modelExecutionProfile?: ModelExecutionProfileId;
}

export function parseRunOptions(args: string): ParsedRunOptions {
  const items = tokens(args);
  const approve = flagValue(items, "--approve");
  const until = flagValue(items, "--until");
  const rawMax = flagValue(items, "--max-chapters");
  const hasRuntimeProfile = items.includes("--runtime-profile");
  const rawRuntimeProfile = flagValue(items, "--runtime-profile");
  const runtimeProfile = hasRuntimeProfile ? parseRuntimeProfileId(rawRuntimeProfile) : undefined;
  const hasModelProfile = items.includes("--model-profile");
  const rawModelProfile = requiredFlagValue(items, "--model-profile");
  const modelExecutionProfile = hasModelProfile ? parseModelExecutionProfileId(rawModelProfile) : undefined;
  const quality = parseQualityOverride(items);
  const resume = items.includes("--resume");
  const pause = items.includes("--pause");
  const cancel = items.includes("--cancel");
  if ([resume, pause, cancel].filter(Boolean).length > 1) throw new Error("Use only one of --resume, --pause, or --cancel; these controls are mutually exclusive.");
  if ((resume || pause || cancel) && (approve || until || rawMax || hasRuntimeProfile || hasModelProfile || quality || items.includes("--no-prose") || items.includes("--review-only"))) {
    throw new Error("Run-control flags cannot be combined with approval, target, chapter, runtime-profile, model-profile, quality, budget, no-prose, or review-only options.");
  }
  if (until && !allowedUntilTargets.includes(until as never)) throw new Error(`Unknown --until target: ${until}. Allowed: ${allowedUntilTargets.join(", ")}.`);
  let maxChapters: number | undefined;
  if (rawMax !== undefined) { maxChapters = Number.parseInt(rawMax, 10); if (!Number.isInteger(maxChapters) || maxChapters < 1 || maxChapters > 10) throw new Error("--max-chapters must be an integer from 1 to 10."); }
  return {
    ...(approve ? { approve } : {}),
    ...(until ? { until } : {}),
    ...(maxChapters ? { maxChapters } : {}),
    ...(runtimeProfile ? { runtimeProfile } : {}),
    ...(modelExecutionProfile ? { modelExecutionProfile } : {}),
    ...(quality ? { quality } : {}),
    resume,
    pause,
    cancel,
    noProse: items.includes("--no-prose"),
    reviewOnly: items.includes("--review-only"),
    stopOnWarning: items.includes("--stop-on-warning"),
  };
}

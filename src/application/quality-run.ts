import type { QualityProjectState, QualityRunOverride, QualityTierId } from "../domain/quality-profile.js";
import { qualityStateWithOverride, resolveQualityConfig } from "../domain/quality-profile.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { readProject } from "../project/store.js";
import {
  beginPersistentRun,
  cancelPersistentRun,
  decideNextRun,
  directDraftDecision,
  pausePersistentRun,
  resumePersistentRun,
  type RunDecision,
  type RunOptions,
} from "./run.js";

export interface QualityRunDecision extends RunDecision {
  qualityTier: QualityTierId;
}

export interface BeginQualityPersistentRunOptions {
  target: string;
  maxChapters: number;
  runtimeProfile?: RuntimeProfileId;
  quality?: QualityRunOverride;
  now?: string;
}

function decisionWithQuality(decision: RunDecision, quality: QualityProjectState): QualityRunDecision {
  const tier = resolveQualityConfig(quality).tier;
  return {
    ...decision,
    qualityTier: tier,
    message: `${decision.message} Quality tier: ${tier}.`,
  };
}

function projectQuality(root: string, override?: QualityRunOverride): QualityProjectState {
  const project = readProject(root);
  return qualityStateWithOverride(project.quality, override);
}

function activeRunQuality(root: string): QualityProjectState {
  const project = readProject(root);
  return structuredClone(project.automation.active_run?.quality_snapshot ?? project.quality ?? qualityStateWithOverride(undefined, undefined));
}

export function decideQualityNextRun(root: string, options: RunOptions & { quality?: QualityRunOverride } = {}): QualityRunDecision {
  const quality = projectQuality(root, options.quality);
  return decisionWithQuality(decideNextRun(root, options), quality);
}

export function beginQualityPersistentRun(root: string, options: BeginQualityPersistentRunOptions): QualityRunDecision {
  const quality = projectQuality(root, options.quality);
  const decision = beginPersistentRun(root, {
    target: options.target,
    maxChapters: options.maxChapters,
    qualitySnapshot: quality,
    ...(options.runtimeProfile ? { runtimeProfile: options.runtimeProfile } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  return decisionWithQuality(decision, quality);
}

export function directQualityDraftDecision(root: string, chapter?: number, qualityOverride?: QualityRunOverride): QualityRunDecision {
  const quality = projectQuality(root, qualityOverride);
  return decisionWithQuality(directDraftDecision(root, chapter), quality);
}

export function resumeQualityPersistentRun(root: string): QualityRunDecision {
  const quality = activeRunQuality(root);
  return decisionWithQuality(resumePersistentRun(root), quality);
}

export function pauseQualityPersistentRun(root: string): QualityRunDecision {
  const quality = activeRunQuality(root);
  return decisionWithQuality(pausePersistentRun(root), quality);
}

export function cancelQualityPersistentRun(root: string): QualityRunDecision {
  const quality = activeRunQuality(root);
  return decisionWithQuality(cancelPersistentRun(root), quality);
}

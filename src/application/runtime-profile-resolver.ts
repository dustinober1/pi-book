import {
  RUNTIME_PROFILES,
  parseRuntimeProfileId,
  type RuntimeProfile,
} from "../domain/runtime-profile.js";

export interface RuntimeProfileResolutionInput {
  explicit?: string;
  project?: string;
  local?: string;
}

export interface RuntimeLimitInput {
  profile: RuntimeProfile;
  projectMaxChapters: number;
  requestedMaxChapters?: number;
  availableArtifacts?: number;
  availableRevisionTickets?: number;
}

export interface RuntimeLimits {
  maxChapters: number;
  maxArtifacts: number | null;
  maxRevisionTickets: number | null;
  graphDepth: 1 | 2;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function boundedAvailable(available: number | undefined, maximum: number | null, label: string): number | null {
  if (available !== undefined) positiveInteger(available, label);
  if (maximum === null) return available ?? null;
  return available === undefined ? maximum : Math.min(available, maximum);
}

export function resolveRuntimeProfile(input: RuntimeProfileResolutionInput): RuntimeProfile {
  const selected = input.explicit ?? input.project ?? input.local ?? "full";
  return RUNTIME_PROFILES[parseRuntimeProfileId(selected)];
}

export function applyRuntimeLimits(input: RuntimeLimitInput): RuntimeLimits {
  const projectMaximum = positiveInteger(input.projectMaxChapters, "Project chapter limit");
  const requestedMaximum = input.requestedMaxChapters === undefined
    ? projectMaximum
    : positiveInteger(input.requestedMaxChapters, "Requested chapter limit");
  const maxChapters = input.profile.maxChaptersPerRun === null
    ? requestedMaximum
    : Math.min(requestedMaximum, input.profile.maxChaptersPerRun);

  return {
    maxChapters,
    maxArtifacts: boundedAvailable(input.availableArtifacts, input.profile.maxArtifactsPerStage, "Available artifact count"),
    maxRevisionTickets: boundedAvailable(input.availableRevisionTickets, input.profile.maxRevisionTickets, "Available revision ticket count"),
    graphDepth: input.profile.graphDepth,
  };
}

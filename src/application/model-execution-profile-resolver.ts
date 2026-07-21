import {
  MODEL_EXECUTION_PROFILES,
  parseModelExecutionProfileId,
  type ModelExecutionProfile,
  type ModelExecutionProfileId,
} from "../domain/model-execution-profile.js";

export interface ResolveModelExecutionProfileInput {
  runOverride?: ModelExecutionProfileId | string;
  projectProfile?: ModelExecutionProfileId | string;
  customProfile?: ModelExecutionProfile;
}

export function resolveModelExecutionProfile(input: ResolveModelExecutionProfileInput): ModelExecutionProfile {
  const id = parseModelExecutionProfileId(input.runOverride ?? input.projectProfile ?? "host-default");
  if (id === "custom") {
    if (!input.customProfile || input.customProfile.id !== "custom") throw new Error("Custom model execution profile requires a validated custom profile.");
    return input.customProfile;
  }
  return MODEL_EXECUTION_PROFILES[id];
}

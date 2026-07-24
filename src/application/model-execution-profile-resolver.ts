import {
  canonicalModelExecutionProfileId,
  MODEL_EXECUTION_PROFILES,
  parseModelExecutionProfileId,
  type ModelExecutionProfile,
  type ModelExecutionProfileId,
} from "../domain/model-execution-profile.js";

export interface ResolveModelExecutionProfileInput {
  explicit?: ModelExecutionProfileId;
  project?: ModelExecutionProfileId;
  custom?: ModelExecutionProfile;
}

export function resolveModelExecutionProfile(input: ResolveModelExecutionProfileInput): ModelExecutionProfile {
  const id = parseModelExecutionProfileId(input.explicit ?? input.project ?? "host-default");
  if (id === "custom") {
    if (!input.custom || input.custom.id !== "custom") {
      throw new Error("The custom model execution profile requires a validated custom profile definition.");
    }
    return input.custom;
  }
  const canonicalId = canonicalModelExecutionProfileId(id);
  if (canonicalId === "custom") throw new Error("The custom model execution profile requires a validated custom profile definition.");
  return MODEL_EXECUTION_PROFILES[canonicalId];
}

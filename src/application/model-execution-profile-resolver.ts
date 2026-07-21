import {
  MODEL_EXECUTION_PROFILES,
  parseModelExecutionProfileId,
  type ModelExecutionProfile,
  type ModelExecutionProfileId,
} from "../domain/model-execution-profile.js";

export interface ResolveModelExecutionProfileInput {
  explicit?: ModelExecutionProfileId | undefined;
  project?: ModelExecutionProfileId | undefined;
  custom?: ModelExecutionProfile | undefined;
}

export function resolveModelExecutionProfile(input: ResolveModelExecutionProfileInput): ModelExecutionProfile {
  const id = parseModelExecutionProfileId(input.explicit ?? input.project ?? "host-default");
  if (id === "custom") {
    if (!input.custom || input.custom.id !== "custom") {
      throw new Error("The custom model execution profile requires a validated custom profile definition.");
    }
    return input.custom;
  }
  return MODEL_EXECUTION_PROFILES[id];
}

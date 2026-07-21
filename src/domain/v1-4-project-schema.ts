import { Type } from "@sinclair/typebox";
import { ModelExecutionProfileIdSchema, type ModelExecutionProfileId } from "./model-execution-profile.js";
import { QualityProjectStateSchema, type QualityProjectState } from "./quality-profile.js";
import { ProjectSchema, type ProjectState } from "./schemas.js";
import { RuntimeProfileIdSchema, type RuntimeProfileId } from "./runtime-profile.js";
import { AutomationRunStateSchema, type AutomationRunState } from "./v1-4-schemas.js";

export const RuntimeProjectConfigSchema = Type.Object({
  profile: Type.Optional(RuntimeProfileIdSchema),
  model_execution_profile: Type.Optional(ModelExecutionProfileIdSchema),
  telemetry: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

const AutomationRunWithQualitySchema = Type.Object({
  ...AutomationRunStateSchema.properties,
  quality_snapshot: Type.Optional(QualityProjectStateSchema),
}, { additionalProperties: false });

type AutomationRunWithQuality = AutomationRunState & {
  quality_snapshot?: QualityProjectState;
};

export const ProjectV14Schema = Type.Object({
  ...ProjectSchema.properties,
  automation: Type.Object({
    ...ProjectSchema.properties.automation.properties,
    active_run: Type.Optional(Type.Union([AutomationRunWithQualitySchema, Type.Null()])),
  }, { additionalProperties: false }),
  runtime: Type.Optional(RuntimeProjectConfigSchema),
  quality: Type.Optional(QualityProjectStateSchema),
}, { additionalProperties: false });

export type ProjectStateV14 = Omit<ProjectState, "automation"> & {
  runtime?: {
    profile?: RuntimeProfileId;
    model_execution_profile?: ModelExecutionProfileId;
    telemetry?: boolean;
  };
  quality?: QualityProjectState;
  automation: ProjectState["automation"] & {
    active_run?: AutomationRunWithQuality | null;
  };
};

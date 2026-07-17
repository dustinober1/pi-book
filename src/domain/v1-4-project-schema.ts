import { Type } from "@sinclair/typebox";
import { ProjectSchema, type ProjectState } from "./schemas.js";
import { RuntimeProfileIdSchema, type RuntimeProfileId } from "./runtime-profile.js";
import { AutomationRunStateSchema, type AutomationRunState } from "./v1-4-schemas.js";

export const RuntimeProjectConfigSchema = Type.Object({
  profile: Type.Optional(RuntimeProfileIdSchema),
  telemetry: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

export const ProjectV14Schema = Type.Object({
  ...ProjectSchema.properties,
  automation: Type.Object({
    ...ProjectSchema.properties.automation.properties,
    active_run: Type.Optional(Type.Union([AutomationRunStateSchema, Type.Null()])),
  }, { additionalProperties: false }),
  runtime: Type.Optional(RuntimeProjectConfigSchema),
}, { additionalProperties: false });

export type ProjectStateV14 = Omit<ProjectState, "automation"> & {
  runtime?: {
    profile?: RuntimeProfileId;
    telemetry?: boolean;
  };
  automation: ProjectState["automation"] & {
    active_run?: AutomationRunState | null;
  };
};

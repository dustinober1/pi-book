import { Type } from "@sinclair/typebox";
import { ProjectSchema, type ProjectState } from "./schemas.js";
import type { RuntimeProfileId } from "./runtime-profile.js";
import type { AutomationRunState } from "./v1-4-schemas.js";

export const RuntimeProjectConfigSchema = Type.Object({
  profile: Type.Optional(Type.Union([
    Type.Literal("tiny-local"),
    Type.Literal("local"),
    Type.Literal("full"),
  ])),
  telemetry: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

export const ProjectV14Schema = Type.Object({
  ...ProjectSchema.properties,
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

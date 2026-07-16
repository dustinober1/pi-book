import { ProjectSchema, type ProjectState } from "./schemas.js";
import type { AutomationRunState } from "./v1-4-schemas.js";

export const ProjectV14Schema = ProjectSchema;

export type ProjectStateV14 = Omit<ProjectState, "automation"> & {
  automation: ProjectState["automation"] & {
    active_run?: AutomationRunState | null;
  };
};

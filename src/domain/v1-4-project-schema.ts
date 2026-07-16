import { Type, type Static } from "@sinclair/typebox";
import { ProjectSchema } from "./schemas.js";
import { AutomationRunStateSchema } from "./v1-4-schemas.js";

export const ProjectV14Schema = Type.Intersect([
  ProjectSchema,
  Type.Object({
    automation: Type.Object({
      active_run: Type.Optional(Type.Union([AutomationRunStateSchema, Type.Null()])),
    }),
  }),
]);

export type ProjectStateV14 = Static<typeof ProjectV14Schema>;

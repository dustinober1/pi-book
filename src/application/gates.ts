import type { GateState, ProjectState } from "../domain/schemas.js";
import { nextStageAfterGate } from "../domain/workflow.js";

export function approveGate(project: ProjectState, gate: string): ProjectState {
  if (!(gate in project.gates)) throw new Error(`Unknown gate: ${gate}`);
  project.gates[gate] = "approved";
  project.current_stage = nextStageAfterGate(gate);
  project.next_gate = null;
  return project;
}

export function setGate(project: ProjectState, gate: string, state: GateState): ProjectState {
  if (!(gate in project.gates)) throw new Error(`Unknown gate: ${gate}`);
  project.gates[gate] = state;
  project.next_gate = state === "pending" || state === "rejected" ? gate : project.next_gate;
  return project;
}

import { createHash } from "node:crypto";
import { join } from "node:path";
import type { GateState, ProjectState } from "../domain/schemas.js";
import { nextStageAfterGate } from "../domain/workflow.js";
import { readText } from "../infrastructure/files.js";
import { assertGateApprovalAllowed } from "./authorization.js";
import { gateEvidencePaths } from "./gate-metadata.js";
import { assertVoiceAuditCompleteForGate } from "./voice-drift.js";

export function gateEvidenceHash(root: string, project: ProjectState, gate: string): string {
  const hash = createHash("sha256");
  for (const path of gateEvidencePaths(project, gate)) hash.update(path).update("\0").update(readText(join(root, path)) ?? "").update("\0");
  return hash.digest("hex");
}

export function approveGate(root: string, project: ProjectState, gate: string, note = ""): ProjectState {
  assertGateApprovalAllowed(project, gate);
  assertVoiceAuditCompleteForGate(root, gate);
  project.gates[gate] = "approved";
  project.approvals.push({ gate, approved_at: new Date().toISOString(), approved_by: "writer", evidence_hash: gateEvidenceHash(root, project, gate), note });
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

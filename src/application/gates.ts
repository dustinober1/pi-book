import { createHash } from "node:crypto";
import { join } from "node:path";
import type { GateState, ProjectState } from "../domain/schemas.js";
import { nextStageAfterGate } from "../domain/workflow.js";
import { readText } from "../infrastructure/files.js";
import { assertGateApprovalAllowed } from "./authorization.js";

function evidencePaths(project: ProjectState, gate: string): string[] {
  const book = `books/${project.active_book}`;
  if (gate === "voice-approval") return ["series/voice-profile.md"];
  if (gate === "book-plan-approval") return [`${book}/book-bible.md`, `${book}/genre.yaml`, `${book}/plot-grid.yaml`];
  if (gate === "first-chapter-approval") return [`${book}/manuscript/chapters/01-opening.md`, `${book}/review-report.md`];
  if (["act-1-review", "midpoint-review", "pre-final-act-review"].includes(gate)) return [`${book}/review-report.md`, `${book}/revision-tickets.yaml`];
  if (gate === "manuscript-approval") return [`${book}/review-report.md`, `${book}/revision-tickets.yaml`];
  if (gate === "package-approval") return [`${book}/package.md`];
  return ["PROJECT.yaml"];
}

export function gateEvidenceHash(root: string, project: ProjectState, gate: string): string {
  const hash = createHash("sha256");
  for (const path of evidencePaths(project, gate)) hash.update(path).update("\0").update(readText(join(root, path)) ?? "").update("\0");
  return hash.digest("hex");
}

export function approveGate(root: string, project: ProjectState, gate: string, note = ""): ProjectState {
  assertGateApprovalAllowed(project, gate);
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

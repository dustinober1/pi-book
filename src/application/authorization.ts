import type { ProjectState, Stage } from "../domain/schemas.js";
import { gateOwnerStage } from "../domain/workflow.js";

export type NovelOperation = "plan-voice" | "plan-series" | "plan-book" | "build-queue" | "draft" | "review-act" | "review-manuscript" | "review-series" | "reader-test" | "research-update" | "revise" | "canon-lock" | "package";
const allowedStages: Record<NovelOperation, Stage[]> = {
  "plan-voice": ["voice-intake"], "plan-series": ["series-planning"], "plan-book": ["book-planning"],
  "build-queue": ["chapter-queue"], draft: ["drafting"], "review-act": ["act-review"],
  "review-manuscript": ["manuscript-review"], "review-series": ["manuscript-review", "canon-lock", "packaging", "complete"],
  "reader-test": ["drafting", "act-review", "revision", "manuscript-review", "packaging"],
  "research-update": ["voice-intake", "series-planning", "book-planning", "chapter-queue", "drafting", "act-review", "revision", "manuscript-review", "canon-lock", "packaging"],
  revise: ["revision"], "canon-lock": ["canon-lock"], package: ["packaging"],
};

export function assertOperationAllowed(project: ProjectState, operation: NovelOperation): void {
  const required = allowedStages[operation];
  if (!required.includes(project.current_stage)) {
    const requirement = required.length === 1 ? `the ${required[0]} stage` : `one of these stages: ${required.join(", ")}`;
    throw new Error(`${operation} requires ${requirement}; current stage is ${project.current_stage}.`);
  }
  if (project.next_gate && project.gates[project.next_gate] === "pending" && !["review-act", "review-manuscript", "reader-test", "research-update", "revise"].includes(operation)) {
    throw new Error(`Human approval required before ${operation}: ${project.next_gate}.`);
  }
}

export function assertGateApprovalAllowed(project: ProjectState, gate: string): void {
  if (!(gate in project.gates)) throw new Error(`Unknown gate: ${gate}`);
  if (project.next_gate !== gate) throw new Error(`Gate ${gate} is not the active gate. Active gate: ${project.next_gate ?? "none"}.`);
  if (project.gates[gate] !== "pending") throw new Error(`Gate ${gate} must be pending before approval; current state is ${project.gates[gate]}.`);
  const owner = gateOwnerStage(gate);
  if (project.current_stage !== owner) throw new Error(`Gate ${gate} belongs to ${owner}, not current stage ${project.current_stage}.`);
}

export function assertReviewAllowed(project: ProjectState, scope: string): void {
  if (scope === "act") return assertOperationAllowed(project, "review-act");
  if (scope === "manuscript") return assertOperationAllowed(project, "review-manuscript");
  if (scope === "series") return assertOperationAllowed(project, "review-series");
  if (scope === "chapter") {
    if (!["drafting", "act-review", "revision"].includes(project.current_stage)) throw new Error(`chapter review is not allowed during ${project.current_stage}.`);
    return;
  }
  throw new Error(`Unknown review scope: ${scope}.`);
}

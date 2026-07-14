import type { Stage } from "../domain/schemas.js";
import { readBook, readProject } from "../project/store.js";
import { gateDetail, gateEvidencePaths } from "./gate-metadata.js";
import { getProjectStatus } from "./status.js";

export type GuideActionId =
  | "continue" | "approve" | "request-changes" | "view-evidence" | "repair"
  | "status" | "readers" | "add-book" | "advanced";

export interface GuideAction {
  id: GuideActionId;
  label: string;
  description: string;
  kind: "primary" | "secondary" | "danger";
}

export interface GuideScreen {
  title: string;
  summary: string;
  primary: GuideAction;
  actions: GuideAction[];
  evidencePaths: string[];
}

const stageTitles: Record<Stage, string> = {
  "voice-intake": "Voice Intake",
  "series-planning": "Series Planning",
  "book-planning": "Book Planning",
  "chapter-queue": "Chapter Preparation",
  drafting: "Drafting",
  "act-review": "Act Review",
  revision: "Revision",
  "manuscript-review": "Manuscript Review",
  "canon-lock": "Canon Lock",
  packaging: "Packaging",
  complete: "Complete",
};

function action(id: GuideActionId, label: string, description: string, kind: GuideAction["kind"] = "secondary"): GuideAction {
  return { id, label, description, kind };
}

function readerStage(stage: Stage): boolean {
  return ["drafting", "act-review", "revision", "manuscript-review", "packaging"].includes(stage);
}

export function buildGuideScreen(root: string): GuideScreen {
  const project = readProject(root);
  const book = readBook(root);
  const status = getProjectStatus(root);
  const gate = project.next_gate;
  const gateState = gate ? project.gates[gate] : undefined;

  if (gate && gateState === "pending") {
    const detail = gateDetail(gate);
    const approve = action("approve", `Approve ${detail.title.toLowerCase()}`, `Record writer approval for ${detail.title}.`, "primary");
    return {
      title: `${detail.title} Ready for Decision`,
      summary: status.headline,
      primary: approve,
      evidencePaths: gateEvidencePaths(project, gate),
      actions: [
        approve,
        action("request-changes", "Request changes", `Reject the current ${detail.title.toLowerCase()} evidence and record a repair note.`, "danger"),
        action("view-evidence", "View evidence files", "Show the exact files covered by this gate."),
        action("status", "View full status", "Show blockers, warnings, and progress."),
        action("advanced", "Advanced options", "Recovery, adoption, metadata, and integrity tools."),
      ],
    };
  }

  if (gate && gateState === "rejected") {
    const detail = gateDetail(gate);
    const repair = action("repair", detail.repairLabel, `Rebuild the evidence required for ${detail.title}.`, "primary");
    return {
      title: `${detail.title} Needs Repair`,
      summary: status.headline,
      primary: repair,
      evidencePaths: gateEvidencePaths(project, gate),
      actions: [
        repair,
        action("view-evidence", "View evidence files", "Show the files that must be repaired."),
        action("status", "View full status", "Show blockers, warnings, and progress."),
        action("advanced", "Advanced options", "Recovery, adoption, metadata, and integrity tools."),
      ],
    };
  }

  const primary = project.current_stage === "complete"
    ? action("add-book", "Add the next book", "Create the next series-capable book with inherited context.", "primary")
    : action("continue", "Continue recommended work", status.nextAction, "primary");
  const actions: GuideAction[] = [primary];
  if (readerStage(project.current_stage)) actions.push(action("readers", "Reader evidence", "Prepare a reader kit or import human responses."));
  actions.push(action("status", "View full status", "Show blockers, warnings, and progress."));
  actions.push(action("advanced", "Advanced options", "Recovery, adoption, metadata, and integrity tools."));

  return {
    title: `${book.title || project.project_name} — ${stageTitles[project.current_stage]}`,
    summary: status.headline,
    primary,
    actions,
    evidencePaths: [],
  };
}
import { join } from "node:path";
import type { Stage } from "../domain/schemas.js";
import type { ProjectStateV14 } from "../domain/v1-4-project-schema.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { readBook, readProject } from "../project/store.js";
import { hasExecutableContext } from "./context-inspection.js";
import { gateDetail, gateEvidencePaths } from "./gate-metadata.js";
import { listPendingPlanChangeRequests } from "./plan-change.js";
import { getProjectStatus } from "./status.js";

export type GuideActionId =
  | "continue" | "approve" | "request-changes" | "view-evidence" | "repair"
  | "status" | "budget" | "context" | "readers" | "research" | "premise" | "plan-change" | "resume-run" | "pause-run" | "cancel-run"
  | "adopt" | "add-book" | "advanced";

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

function sharedUtilityActions(): GuideAction[] {
  return [
    action("budget", "View quality budget", "Show the configured quality tier, spending ceilings, and locally recorded usage."),
    action("status", "View full status", "Show blockers, warnings, and progress."),
    action("advanced", "Advanced options", "Recovery, browser workflows, metadata, and integrity tools."),
  ];
}

export function buildGuideScreen(root: string): GuideScreen {
  const project = readProject(root) as ProjectStateV14;
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
        ...sharedUtilityActions(),
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
        ...sharedUtilityActions(),
      ],
    };
  }

  const primary = project.current_stage === "complete"
    ? action("add-book", "Add the next book", "Review inherited canon and unresolved threads before creating the next book.", "primary")
    : action("continue", "Continue recommended work", status.nextAction, "primary");
  const actions: GuideAction[] = [primary];
  const manuscriptEmpty = listChapterFiles(join(root, "books", book.book_id)).length === 0;
  if (manuscriptEmpty && ["voice-intake", "series-planning", "book-planning", "chapter-queue"].includes(project.current_stage)) {
    actions.push(action("adopt", "Adopt an existing manuscript", "Preview and map DOCX, EPUB, Markdown, text, or chapter files without changing the source."));
  }
  const pendingPlanChanges = listPendingPlanChangeRequests(root);
  if (pendingPlanChanges.length) {
    actions.push(action(
      "plan-change",
      pendingPlanChanges.length === 1 ? `Review plan change ${pendingPlanChanges[0]!.request_id}` : `Review ${pendingPlanChanges.length} plan changes`,
      "Inspect evidence-grounded future-plan deviations and approve or reject them through the writer gate.",
    ));
  }
  if (hasExecutableContext(root)) actions.push(action("context", "Inspect active context", "Show the exact record IDs, inclusion reasons, dependencies, omissions, and token budget for the next executable scene without exposing record payloads."));
  if (readerStage(project.current_stage)) actions.push(action("readers", "Reader evidence", "Prepare isolated reader kits or preview and merge human-response CSVs."));
  if (project.current_stage !== "complete") actions.push(action("research", "Review voice and research evidence", "Open the local preview-and-apply workspace for influences, anonymous voice calibration, public-market friction, research readiness, and approved learning rules."));
  if (project.current_stage === "book-planning") {
    const premise = readText(join(root, "books", book.book_id, "premise-lab.yaml")) ?? "";
    if (!/selected_variant_id:\s*PV-[0-9]{3}/.test(premise)) actions.push(action("premise", "Compare and select a premise", "Open the local structural premise laboratory and record the writer's explicit selection."));
  }

  const run = project.automation.active_run;
  if (run?.status === "active") {
    actions.push(action("pause-run", `Pause ${run.id}`, "Pause the persistent run before its next guarded event."));
    actions.push(action("cancel-run", `Cancel ${run.id}`, "Cancel the persistent run without changing completed creative work.", "danger"));
  } else if (run?.status === "paused") {
    actions.push(action("resume-run", `Resume ${run.id}`, `Resume from ${run.currentAction} after checking stage and creative-state hash.`));
    actions.push(action("cancel-run", `Cancel ${run.id}`, "Cancel the paused run without changing completed creative work.", "danger"));
  }

  actions.push(...sharedUtilityActions());

  return {
    title: `${book.title || project.project_name} — ${stageTitles[project.current_stage]}`,
    summary: status.headline,
    primary,
    actions,
    evidencePaths: [],
  };
}

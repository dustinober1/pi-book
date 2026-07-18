import { join } from "node:path";
import { abortRevert, beginRevertHead, commitWorkflowEvent, gitHeadInfo, gitState } from "../infrastructure/git.js";
import { PlotGridSchema, type PlotGridState, type ProjectState } from "../domain/schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { overdueMilestone } from "./act-boundaries.js";
import { collectProjectIntegrityFindings } from "./integrity.js";
import { buildGuideScreen } from "./guide.js";
import { refreshGuidance } from "./handoff.js";

export interface UndoInspection {
  allowed: boolean;
  reason: string;
  approvalCheckpoint: boolean;
  sha: string | null;
  subject: string | null;
}

export interface UndoResult {
  reverted: boolean;
  originalSha: string;
  originalSubject: string;
  commitMessage: string;
}

function chapterNumber(path: string): number | null {
  const match = path.match(/(?:^|\/)(?:0*)(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

export interface MilestoneRecovery {
  gate: string;
  chapterRange: { startChapter: number; endChapter: number };
  findings: string[];
}

export function reconcileMilestoneState(root: string): MilestoneRecovery | null {
  const project = readProject(root);
  const book = readBook(root);
  const plotText = readText(join(root, "books", book.book_id, "plot-grid.yaml"));
  if (!plotText) return null;
  const plot = parseYaml<PlotGridState>(plotText, PlotGridSchema, "plot-grid.yaml");
  const drafted = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((value): value is number => value !== null));
  const overdue = overdueMilestone(plot, drafted, project.gates);
  if (!overdue || !overdue.gate) return null;
  return {
    gate: overdue.gate,
    chapterRange: { startChapter: overdue.startChapter, endChapter: overdue.endChapter },
    findings: [`Drafted chapters extend beyond an unreviewed milestone: ${overdue.gate} covers Chapters ${overdue.startChapter}-${overdue.endChapter}.`],
  };
}

export function recoverOverdueActReview(root: string, gate: string): MilestoneRecovery {
  const recovery = reconcileMilestoneState(root);
  if (!recovery || recovery.gate !== gate) throw new Error(`No overdue milestone review found for ${gate}.`);
  const project = structuredClone(readProject(root)) as ProjectState;
  if (!(gate in project.gates)) throw new Error(`Unknown milestone gate: ${gate}.`);
  project.gates[gate] = "pending";
  project.next_gate = gate;
  project.current_stage = "act-review";
  applyGuidedProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], `Novel Forge: recover ${gate}`, { lastAction: `Recovered overdue ${gate}` });
  return recovery;
}

export function inspectUndo(root: string): UndoInspection {
  const state = gitState(root);
  if (!state.initialized) return { allowed: false, reason: "Git is not initialized.", approvalCheckpoint: false, sha: null, subject: null };
  if (state.dirty) return { allowed: false, reason: "Undo requires a clean project; uncommitted files are present.", approvalCheckpoint: false, sha: null, subject: null };
  const head = gitHeadInfo(root);
  if (!head) return { allowed: false, reason: "Git HEAD is unavailable.", approvalCheckpoint: false, sha: null, subject: null };
  const approvalCheckpoint = /^Novel Forge: approve\b/i.test(head.subject);
  if (!/^Novel Forge:/i.test(head.subject)) {
    return { allowed: false, reason: `HEAD is not a Novel Forge checkpoint: ${head.subject}`, approvalCheckpoint, sha: head.sha, subject: head.subject };
  }
  return { allowed: true, reason: approvalCheckpoint ? "Approval checkpoint requires explicit reversal permission." : "The last Novel Forge checkpoint can be reverted safely.", approvalCheckpoint, sha: head.sha, subject: head.subject };
}

export function undoLastNovelEvent(root: string, allowApprovalReversal = false): UndoResult {
  const inspection = inspectUndo(root);
  if (!inspection.allowed) throw new Error(inspection.reason);
  if (inspection.approvalCheckpoint && !allowApprovalReversal) throw new Error("Undoing a writer approval requires explicit approval-reversal permission.");
  const original = beginRevertHead(root);
  const commitMessage = `Revert "${original.subject}"`;
  try {
    refreshGuidance(root, { lastAction: `Undid ${original.subject}`, checkpoint: false });
    const committed = commitWorkflowEvent(root, ["STATUS.md", "HANDOFF.md"], commitMessage);
    if (!committed.committed) throw new Error(committed.message);
    return { reverted: true, originalSha: original.sha, originalSubject: original.subject, commitMessage };
  } catch (error) {
    abortRevert(root);
    throw error;
  }
}

export function explainFirstBlocker(root: string): string {
  const screen = buildGuideScreen(root);
  return [
    `# ${screen.title}`,
    "",
    screen.summary,
    "",
    `Recommended recovery: ${screen.primary.label}`,
    "",
    "Run `/novel` and choose the recommended action. Novel Forge will preserve the active gate and all protected state.",
  ].join("\n");
}

export function runIntegritySummary(root: string): string {
  const findings = collectProjectIntegrityFindings(root);
  if (!findings.length) return "Integrity check: no structured integrity findings.";
  return [
    `Integrity check: ${findings.length} finding${findings.length === 1 ? "" : "s"}.`,
    ...findings.map((finding) => `- ${finding.severity.toUpperCase()}: ${finding.message}`),
  ].join("\n");
}

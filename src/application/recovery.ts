import { abortRevert, beginRevertHead, commitWorkflowEvent, gitHeadInfo, gitState } from "../infrastructure/git.js";
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
    refreshGuidance(root, { lastAction: `Undid ${original.subject}` });
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
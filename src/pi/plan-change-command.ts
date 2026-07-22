import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  approvePlanChangeRequest,
  listPendingPlanChangeRequests,
  proposePlanChangeRequest,
  rejectPlanChangeRequest,
} from "../application/plan-change.js";
import { projectStateHash } from "../application/project-hash.js";
import { readBook, requireProjectRoot } from "../project/store.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function flagValue(args: string, flag: string): string | null {
  const items = args.trim().split(/\s+/).filter(Boolean);
  const index = items.indexOf(flag);
  return index >= 0 ? items[index + 1] ?? null : null;
}

function pendingText(root: string): string {
  const pending = listPendingPlanChangeRequests(root);
  if (!pending.length) return "No pending Novel Forge plan changes.";
  return pending.map((item) => [
    `${item.request_id} [${item.scope}]`,
    item.proposed_change,
    `Reason: ${item.reason}`,
    `Future chapters: ${item.affected_chapters.join(", ") || "none"}`,
    `Control files: ${item.control_files_to_update.join(", ")}`,
  ].join("\n")).join("\n\n");
}

export function registerPlanChangeCommand(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "novel_propose_plan_change",
    label: "Novel Forge Propose Plan Change",
    description: "Create a non-canonical, evidence-grounded request to change future Novel Forge controls. This never applies the proposal or changes the project hash.",
    promptSnippet: "Propose a future plan change grounded in accepted manuscript evidence, then stop for writer approval.",
    promptGuidelines: [
      "Use this tool only when accepted prose makes an existing future plan obsolete, impossible, or harmful.",
      "Cite exact accepted manuscript evidence and the current project hash.",
      "Propose only future control files. Never include accepted manuscript, chapter deltas, credentials, or run artifacts.",
      "After proposal creation, stop. Do not claim the change is approved or applied.",
    ],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String()),
      request_id: Type.String({ pattern: "^PC-[0-9]{3}$" }),
      scope: Type.Union([Type.Literal("local"), Type.Literal("act"), Type.Literal("book")]),
      proposed_change: Type.String({ minLength: 1 }),
      reason: Type.String({ minLength: 1 }),
      manuscript_evidence: Type.Array(Type.Object({
        chapter: Type.Integer({ minimum: 1 }),
        manuscript_path: Type.String({ minLength: 1 }),
        manuscript_hash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
        quote: Type.String({ minLength: 1, maxLength: 500 }),
      }, { additionalProperties: false }), { minItems: 1, maxItems: 20 }),
      affected_chapters: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
      affected_contract_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
      affected_arc_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
      affected_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
      affected_payoff_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
      proposed_files: Type.Array(Type.Object({
        path: Type.String({ minLength: 1 }),
        content: Type.String(),
      }, { additionalProperties: false }), { minItems: 1, maxItems: 50 }),
      source_project_hash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, context) {
      try {
        const root = requireProjectRoot(params.project_root || context.cwd);
        const book = readBook(root);
        const result = proposePlanChangeRequest(root, {
          request_id: params.request_id,
          book_id: book.book_id,
          scope: params.scope,
          proposed_change: params.proposed_change,
          reason: params.reason,
          manuscript_evidence: params.manuscript_evidence,
          affected_chapters: params.affected_chapters,
          affected_contract_ids: params.affected_contract_ids,
          affected_arc_ids: params.affected_arc_ids,
          affected_thread_ids: params.affected_thread_ids,
          affected_payoff_ids: params.affected_payoff_ids,
          proposed_files: params.proposed_files,
          source_project_hash: params.source_project_hash,
        });
        return {
          content: [{ type: "text", text: `Plan change ${result.request.request_id} proposed. Canonical project state is unchanged. Writer approval is required.` }],
          details: {
            request_id: result.request.request_id,
            status: result.request.status,
            path: result.path,
            project_hash: projectStateHash(root),
          },
        };
      } catch (error) {
        const message = errorText(error);
        return {
          content: [{ type: "text", text: `Novel Forge plan-change proposal blocked: ${message}` }],
          details: { error: message },
        };
      }
    },
  });

  pi.registerCommand("novel-plan-change", {
    description: "List, approve, or reject evidence-grounded future plan changes",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const approveId = flagValue(args, "--approve");
        const rejectId = flagValue(args, "--reject");
        if (approveId && rejectId) throw new Error("Choose either --approve or --reject, not both.");
        if (approveId) {
          const request = listPendingPlanChangeRequests(root).find((item) => item.request_id === approveId);
          if (!request) throw new Error(`Pending plan-change request ${approveId} was not found.`);
          const confirmed = await context.ui.confirm(
            `Approve plan change ${approveId}?`,
            `${request.proposed_change}\n\nReason: ${request.reason}\n\nFiles: ${request.control_files_to_update.join(", ")}`,
          );
          if (!confirmed) {
            context.ui.notify(`Plan change ${approveId} was not approved.`, "info");
            return;
          }
          const note = await context.ui.input("Writer approval note", "Explain why this future-plan change is approved.");
          if (!note?.trim()) throw new Error("Plan-change approval requires a writer note.");
          const result = approvePlanChangeRequest(root, approveId, {
            confirmed: true,
            approved_by: "writer",
            note: note.trim(),
            approved_at: new Date().toISOString(),
          });
          context.ui.notify(`Applied plan change ${approveId}. ${result.event.changed.length} canonical file(s) changed.`, "info");
          return;
        }
        if (rejectId) {
          const reason = await context.ui.input("Plan-change rejection reason", "Explain why the existing future plan remains authoritative.");
          if (!reason?.trim()) throw new Error("Plan-change rejection requires a reason.");
          rejectPlanChangeRequest(root, rejectId, reason.trim());
          context.ui.notify(`Rejected plan change ${rejectId}. Canonical project state is unchanged.`, "info");
          return;
        }
        context.ui.notify(pendingText(root), "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  });
}

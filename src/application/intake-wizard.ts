import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { WizardProposalEnvelope } from "../wizard/types.js";
import {
  DecisionLedgerSchema,
  PremiseLabSchema,
  type DecisionLedger,
  type PremiseLab,
  type WriterDecisionRecord,
} from "../domain/v1-4-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { applyNovelEvent } from "./events.js";
import { recordWriterDecision } from "./intake.js";
import { premiseComparison, premiseLabFindings, selectPremise } from "./premise-lab.js";
import { projectStateHash } from "./project-hash.js";

export interface PremiseWizardHandler {
  snapshot(): unknown;
  preview(action: string, payload: unknown): unknown;
  apply(proposal: WizardProposalEnvelope): Promise<unknown>;
}

type ComparisonPreview = { kind: "comparison"; lab: PremiseLab };
type SelectionPreview = { kind: "selection"; lab: PremiseLab; ledger: DecisionLedger; decision: WriterDecisionRecord };
type PreviewEntry = ComparisonPreview | SelectionPreview;

function object(value: unknown, label = "payload"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  const result = [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
  if (!result.length) throw new Error(`${label} requires at least one value.`);
  return result;
}

function canonical(root: string): { bookId: string; labPath: string; lab: PremiseLab; ledger: DecisionLedger } {
  const bookId = readBook(root).book_id;
  const labPath = `books/${bookId}/premise-lab.yaml`;
  const labText = readText(join(root, labPath));
  const ledgerText = readText(join(root, "series", "decision-ledger.yaml"));
  if (!labText) throw new Error(`Missing ${labPath}.`);
  if (!ledgerText) throw new Error("Missing series/decision-ledger.yaml.");
  return {
    bookId,
    labPath,
    lab: parseYaml<PremiseLab>(labText, PremiseLabSchema, labPath),
    ledger: parseYaml<DecisionLedger>(ledgerText, DecisionLedgerSchema, "series/decision-ledger.yaml"),
  };
}

export function premiseWizardSnapshot(root: string) {
  const project = readProject(root);
  const state = canonical(root);
  return {
    id: "premise" as const,
    eligible: project.current_stage === "book-planning",
    stage: project.current_stage,
    state_hash: projectStateHash(root),
    book_id: state.bookId,
    raw_idea: state.lab.raw_idea,
    seed_elements: state.lab.seed_elements,
    variants: state.lab.variants,
    selected_variant_id: state.lab.selected_variant_id,
    selection_decision_id: state.lab.selection_decision_id,
  };
}

export function createPremiseWizardHandler(root: string): PremiseWizardHandler {
  const previews = new Map<string, PreviewEntry>();

  function save(entry: PreviewEntry): string {
    const id = `premise-preview-${randomBytes(12).toString("hex")}`;
    previews.set(id, entry);
    return id;
  }

  function preview(action: string, payload: unknown): unknown {
    const input = object(payload);
    const state = canonical(root);
    if (action === "comparison") {
      const lab = structuredClone(object(input.lab, "lab")) as PremiseLab;
      if (lab.book_id !== state.bookId) throw new Error(`Premise lab book_id must be ${state.bookId}.`);
      lab.selected_variant_id = null;
      lab.selection_decision_id = null;
      const blockers = premiseLabFindings(lab).filter((item) => item.severity === "blocker");
      if (blockers.length) throw new Error(`Premise comparison validation blocked the preview:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
      const preview_id = save({ kind: "comparison", lab });
      return { preview_id, comparison: premiseComparison(lab), candidate: lab };
    }
    if (action === "selection") {
      const variantId = string(input.variant_id, "variant_id");
      const decidedAt = string(input.decided_at, "decided_at");
      const evidenceRefs = strings(input.evidence_refs, "evidence_refs");
      const replacedIds = new Set(state.ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
      const active = state.ledger.decisions.find((item) => item.scope === state.bookId && item.subject === "premise-selection" && !replacedIds.has(item.id));
      const ledger = recordWriterDecision(state.ledger, {
        scope: state.bookId as `book-${string}`,
        subject: "premise-selection",
        choice: variantId,
        decidedAt,
        evidenceRefs,
        ...(active ? { replaces: active.id } : {}),
      });
      const decision = ledger.decisions.at(-1)!;
      const lab = selectPremise(state.lab, ledger, variantId, decision.id);
      const preview_id = save({ kind: "selection", lab, ledger, decision });
      return { preview_id, decision, selected_variant_id: variantId };
    }
    throw new Error(`Unsupported premise preview action: ${action}.`);
  }

  async function apply(proposal: WizardProposalEnvelope): Promise<unknown> {
    if (proposal.workflow !== "premise") throw new Error("Premise wizard proposal has the wrong workflow.");
    const payload = object(proposal.payload);
    const previewId = string(payload.preview_id, "preview_id");
    const entry = previews.get(previewId);
    if (!entry) throw new Error("Unknown or expired premise preview; preview the change again.");
    const state = canonical(root);
    let files: Array<{ path: string; content: string }>;
    if (proposal.action === "save-comparison" && entry.kind === "comparison") {
      files = [{ path: state.labPath, content: stringifyYaml(entry.lab) }];
    } else if (proposal.action === "select-variant" && entry.kind === "selection") {
      files = [
        { path: state.labPath, content: stringifyYaml(entry.lab) },
        { path: "series/decision-ledger.yaml", content: stringifyYaml(entry.ledger) },
      ];
    } else {
      throw new Error(`Premise preview ${previewId} cannot be applied as ${proposal.action}.`);
    }
    const result = applyNovelEvent(root, {
      eventType: "premise-update",
      expectedStage: proposal.expected_stage as "book-planning",
      expectedProjectHash: proposal.expected_project_hash,
      files,
      scope: `premise-wizard:${proposal.action}`,
    });
    previews.delete(previewId);
    return result;
  }

  return { snapshot: () => premiseWizardSnapshot(root), preview, apply };
}

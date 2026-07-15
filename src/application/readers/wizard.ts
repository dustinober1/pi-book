import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { readBook } from "../../project/store.js";
import type { WizardProposalEnvelope } from "../../wizard/types.js";
import type { WizardWorkflowHandler } from "../wizard.js";
import { previewReaderImport } from "./csv.js";
import { createReaderKit, previewReaderKit } from "./kit.js";
import { mergeReaderImport } from "./merge.js";
import { migrateReaderEvidenceV1ToV2 } from "./migrate.js";
import type { ReaderImportPreview, ReaderKitPreview, ReaderKitProposal, ReaderMergeProposal } from "./types.js";

interface KitEntry { kind: "kit"; value: ReaderKitPreview }
interface ImportEntry { kind: "import"; value: ReaderImportPreview }
type PreviewEntry = KitEntry | ImportEntry;

export interface ReaderWizardOptions {
  resolveSource?(sourceId: string): { absolutePath: string } | null;
}

function previewId(): string { return `reader-preview-${randomBytes(18).toString("base64url")}`; }

export function createReaderWizardHandler(root: string, options: ReaderWizardOptions = {}): WizardWorkflowHandler {
  const previews = new Map<string, PreviewEntry>();
  return {
    preview(action, payload) {
      const input = payload as Record<string, unknown>;
      if (action === "kit") {
        const proposal = input.proposal as ReaderKitProposal;
        if (!proposal) throw new Error("Reader kit preview requires a proposal.");
        const value = previewReaderKit(root, proposal);
        const id = previewId();
        previews.set(id, { kind: "kit", value });
        return { preview_id: id, ...value };
      }
      if (action === "csv") {
        const experimentId = String(input.experiment_id ?? "");
        const bookId = readBook(root).book_id;
        let source: string;
        if (typeof input.csv_text === "string") source = input.csv_text;
        else if (typeof input.source_id === "string") {
          const resolved = options.resolveSource?.(input.source_id);
          if (!resolved) throw new Error(`Unknown or expired reader CSV source: ${input.source_id}`);
          source = readFileSync(resolved.absolutePath, "utf8");
        } else throw new Error("Reader CSV preview requires csv_text or a session source ID.");
        const value = previewReaderImport(root, bookId, experimentId, source, input.mapping as never);
        const id = previewId();
        previews.set(id, { kind: "import", value });
        return { preview_id: id, ...value };
      }
      throw new Error(`Unknown reader preview action: ${action}`);
    },
    async apply(envelope: WizardProposalEnvelope) {
      const payload = envelope.payload as Record<string, unknown>;
      if (envelope.action === "migrate-v1.1") return migrateReaderEvidenceV1ToV2(root);
      const id = String(payload.preview_id ?? "");
      const entry = previews.get(id);
      if (!entry) throw new Error(`Unknown or expired reader preview: ${id}`);
      if (envelope.action === "create-kit") {
        if (entry.kind !== "kit") throw new Error("Reader preview does not contain a kit proposal.");
        const result = createReaderKit(root, entry.value.proposal);
        previews.delete(id);
        return result;
      }
      if (envelope.action === "import-csv") {
        if (entry.kind !== "import") throw new Error("Reader preview does not contain a CSV import.");
        const result = await mergeReaderImport(root, readBook(root).book_id, entry.value, { decisions: (payload.decisions ?? {}) as ReaderMergeProposal["decisions"] });
        previews.delete(id);
        return result;
      }
      throw new Error(`Unknown reader apply action: ${envelope.action}`);
    },
  };
}

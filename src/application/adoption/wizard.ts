import { readBook } from "../../project/store.js";
import type { WizardProposalEnvelope } from "../../wizard/types.js";
import type { WizardWorkflowHandler } from "../wizard.js";
import { applyAdoption } from "./apply.js";
import { discoverAdoptionPreview } from "./discover.js";
import { applyMapping, validateAdoptionMapping } from "./mapping.js";
import { AdoptionPreviewStore } from "./preview-store.js";
import { resolveAdoptionSource, type AdoptionSourceRef, type AdoptionSourceResolver } from "./source.js";
import type { AdoptionMappingProposal, AdoptionPreview, MappedAdoption } from "./types.js";

function publicPreview(preview: AdoptionPreview) {
  return {
    ...preview,
    assets: preview.assets.map(({ bytes: _bytes, ...asset }) => ({ ...asset, byteSize: _bytes.byteLength })),
  };
}

function publicMapping(mapped: MappedAdoption, bookId: string) {
  return {
    ...mapped,
    assets: mapped.assets.map(({ bytes: _bytes, ...asset }) => ({ ...asset, byteSize: _bytes.byteLength })),
    findings: validateAdoptionMapping(mapped, bookId),
  };
}

export function createAdoptionWizardHandler(root: string, resolver: AdoptionSourceResolver): WizardWorkflowHandler {
  const store = new AdoptionPreviewStore();
  return {
    async preview(action, payload) {
      const value = payload as Record<string, unknown>;
      if (action === "discover") {
        const ref = value.source as AdoptionSourceRef;
        if (!ref || (ref.kind !== "upload" && ref.kind !== "authorized-path")) throw new Error("Adoption discovery requires an authorized source reference.");
        const source = resolveAdoptionSource(ref, resolver);
        const preview = await discoverAdoptionPreview(source, { preferPandoc: value.prefer_pandoc !== false });
        store.put(preview);
        return publicPreview(preview);
      }
      if (action === "map") {
        const preview = store.get(String(value.preview_id ?? ""));
        const mapped = applyMapping(preview, (value.mapping ?? { operations: [] }) as AdoptionMappingProposal);
        return publicMapping(mapped, readBook(root).book_id);
      }
      throw new Error(`Unknown adoption preview action: ${action}`);
    },
    apply(envelope: WizardProposalEnvelope) {
      if (envelope.action !== "adopt") throw new Error(`Unknown adoption apply action: ${envelope.action}`);
      const value = envelope.payload as Record<string, unknown>;
      const previewId = String(value.preview_id ?? "");
      const preview = store.get(previewId);
      const mapped = applyMapping(preview, (value.mapping ?? { operations: [] }) as AdoptionMappingProposal);
      const result = applyAdoption(root, preview, mapped);
      store.delete(previewId);
      return result;
    },
  };
}

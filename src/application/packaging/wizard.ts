import type { MarketingMetadata, PublishingMetadata } from "../../domain/v1-2-schemas.js";
import { stringifyYaml } from "../../infrastructure/yaml.js";
import { readBook } from "../../project/store.js";
import type { WizardProposalEnvelope } from "../../wizard/types.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import { buildPackagingChecklist } from "../package-checklist.js";
import type { WizardWorkflowHandler } from "../wizard.js";
import { applyPackageArtifacts } from "./apply.js";
import { buildPackageArtifacts } from "./export.js";
import { readMarketingMetadata, readPublishingMetadata } from "./metadata.js";

export function createPackagingWizardHandler(root: string): WizardWorkflowHandler {
  return {
    async preview(action, payload) {
      const book = readBook(root);
      if (action === "checklist") return buildPackagingChecklist(root);
      if (action === "metadata") return { publishing: readPublishingMetadata(root, book.book_id), marketing: readMarketingMetadata(root, book.book_id) };
      if (action === "artifacts") {
        const input = payload as Record<string, unknown>;
        const built = await buildPackageArtifacts(root, { preferPandoc: input.prefer_pandoc !== false });
        return { source_hash: built.sourceHash, engine: built.engine, chapters: built.chapters, words: built.words, outputs: built.changes.map((change) => ({ path: change.path, binary: typeof change.content !== "string", bytes: typeof change.content === "string" ? Buffer.byteLength(change.content) : change.content.byteLength })) };
      }
      throw new Error(`Unknown packaging preview action: ${action}`);
    },
    async apply(envelope: WizardProposalEnvelope) {
      const book = readBook(root);
      const payload = envelope.payload as Record<string, unknown>;
      if (envelope.action === "update-metadata") {
        const changes: Array<{ path: string; content: string }> = [];
        if (payload.publishing) changes.push({ path: `books/${book.book_id}/publishing.yaml`, content: stringifyYaml(payload.publishing as PublishingMetadata) });
        if (payload.marketing) changes.push({ path: `books/${book.book_id}/marketing.yaml`, content: stringifyYaml(payload.marketing as MarketingMetadata) });
        if (!changes.length) throw new Error("Metadata update requires publishing or marketing content.");
        return applyGuidedProjectEvent(root, changes, `Novel Forge: update packaging metadata for ${book.book_id}`, { lastAction: `Updated packaging metadata for ${book.book_id}` });
      }
      if (envelope.action === "generate-package") {
        return applyPackageArtifacts(root, { preferPandoc: payload.prefer_pandoc !== false, regenerate: payload.regenerate === true });
      }
      throw new Error(`Unknown packaging apply action: ${envelope.action}`);
    },
  };
}

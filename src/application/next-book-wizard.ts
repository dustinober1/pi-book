import type { WizardProposalEnvelope } from "../wizard/types.js";
import { buildNextBookInheritanceProposal, createNextBookFromDecision, type NextBookDecision } from "./next-book.js";
import type { WizardWorkflowHandler } from "./wizard.js";

export function createNextBookWizardHandler(root: string): WizardWorkflowHandler {
  return {
    preview(action) {
      if (action !== "inheritance") throw new Error(`Unknown next-book preview action: ${action}`);
      return buildNextBookInheritanceProposal(root);
    },
    apply(envelope: WizardProposalEnvelope) {
      if (envelope.action !== "create") throw new Error(`Unknown next-book apply action: ${envelope.action}`);
      return createNextBookFromDecision(root, envelope.payload as NextBookDecision);
    },
  };
}

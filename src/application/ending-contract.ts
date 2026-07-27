import type { GenreConfig } from "../domain/schemas.js";
import type { BookStrategy } from "../domain/v1-3-schemas.js";

/**
 * Romantasy declares an ending contract (hea | hfn | series-progress |
 * tragic-by-design) in genre.yaml, but nothing previously checked that the
 * finished manuscript actually delivers it — endingRules were prose guidance
 * only. This is deliberately not an automated read of the manuscript: whether
 * a scene reads as HEA is a human judgment, not a deterministic check. What
 * is deterministic is whether the writer has declared what was delivered,
 * and whether that declaration matches the contract the book was sold on.
 */

export interface EndingContractFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

const REMEDY = "Record the delivered ending through a research-update event that sets book-strategy.yaml delivered_ending. If the manuscript's ending is what you intended, either revise the ending to honor the declared contract or change the declared contract itself with a plan-change event before packaging.";

export function endingContractFindings(genre: GenreConfig, strategy: BookStrategy): EndingContractFinding[] {
  if (genre.profile !== "romantasy") return [];
  const declared = genre.settings.ending_contract;
  const delivered = strategy.delivered_ending;

  if (!delivered) {
    return [{
      severity: "blocker",
      code: "no-delivered-ending-declared",
      message: `This book declared an ending contract of "${declared}" but no delivered ending has been recorded. Romance readers judge a book primarily on whether it keeps this promise. ${REMEDY}`,
    }];
  }

  if (delivered.disposition !== declared) {
    return [{
      severity: "blocker",
      code: "ending-contract-mismatch",
      message: `The declared ending contract is "${declared}" but the recorded delivered ending is "${delivered.disposition}"${delivered.note.trim() ? ` (${delivered.note.trim()})` : ""}. A mismatch here is exactly the broken promise romance readers rate a book on. ${REMEDY}`,
    }];
  }

  return [];
}

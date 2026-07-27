import { countWords } from "../infrastructure/files.js";

/**
 * A chapter packet declares `target_words`, but before v1.10.0 only the guarded
 * scene path ever compared a draft against it: the chapter contract compiler
 * derives a 85%-to-110% word range and the deterministic scene validator
 * enforces it. A plain `draft-chapter` event had no equivalent check, so a book
 * planned at 9,000 words per chapter could accumulate 5,000-word chapters with
 * neither the tool nor the author agent's own summary showing the shortfall.
 *
 * The advisory band matches the guarded path exactly. The blocking band is
 * deliberately much wider: a modest overshoot or a deliberately compressed
 * chapter is a craft decision, but a draft under 60% or over 150% of plan is a
 * different chapter from the one the packet describes, and silently accepting
 * it drifts the book away from its own plot grid.
 */
export const DRAFT_LENGTH_ADVISORY_FLOOR = 0.85;
export const DRAFT_LENGTH_ADVISORY_CEILING = 1.1;
export const DRAFT_LENGTH_BLOCKING_FLOOR = 0.6;
export const DRAFT_LENGTH_BLOCKING_CEILING = 1.5;

export interface DraftLengthFinding {
  severity: "advisory" | "blocker";
  chapter: number;
  targetWords: number;
  actualWords: number;
  message: string;
}

function band(targetWords: number, ratio: number): string {
  return `${Math.round(targetWords * ratio).toLocaleString("en-US")} words`;
}

/**
 * Compares one submitted chapter draft against its packet target. Returns null
 * when the draft sits inside the same range the guarded scene path would accept.
 */
export function draftLengthFinding(chapter: number, targetWords: number, text: string): DraftLengthFinding | null {
  if (!Number.isFinite(targetWords) || targetWords <= 0) return null;
  const actualWords = countWords(text);
  const ratio = actualWords / targetWords;
  if (ratio >= DRAFT_LENGTH_ADVISORY_FLOOR && ratio <= DRAFT_LENGTH_ADVISORY_CEILING) return null;

  const percent = Math.round(ratio * 100);
  const counts = `${actualWords.toLocaleString("en-US")} words against a packet target of ${targetWords.toLocaleString("en-US")} (${percent}%)`;
  const short = ratio < 1;

  if (ratio < DRAFT_LENGTH_BLOCKING_FLOOR || ratio > DRAFT_LENGTH_BLOCKING_CEILING) {
    const direction = short
      ? `Draft the chapter the packet describes, or change target_words through a plan-change event if the plan is what is wrong.`
      : `Split the material across packets, or raise target_words through a plan-change event if the plan is what is wrong.`;
    return {
      severity: "blocker",
      chapter,
      targetWords,
      actualWords,
      message: `Chapter ${chapter} draft is ${counts}. That is outside the accepted range of ${band(targetWords, DRAFT_LENGTH_BLOCKING_FLOOR)} to ${band(targetWords, DRAFT_LENGTH_BLOCKING_CEILING)}. ${direction}`,
    };
  }

  return {
    severity: "advisory",
    chapter,
    targetWords,
    actualWords,
    message: `Chapter ${chapter} draft is ${counts}, outside the planned range of ${band(targetWords, DRAFT_LENGTH_ADVISORY_FLOOR)} to ${band(targetWords, DRAFT_LENGTH_ADVISORY_CEILING)} that guarded scene execution enforces. The event was accepted; report this ${short ? "shortfall" : "overrun"} to the writer.`,
  };
}

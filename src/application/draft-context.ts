import { buildProjectRepetitionMemory } from "./repetition-memory.js";

/**
 * Drafting constraints derived from the chapters already written.
 *
 * `buildProjectRepetitionMemory` computes sentence openings, dialogue tags,
 * gestures, metaphors, chapter openings and scene endings deterministically from
 * the manuscript, but its output only ever reached the guarded scene path
 * through the style card and context capsule. A chapter drafted through the
 * plain event path had no idea which habits the book had already formed, so the
 * same openings and the same closing shapes accumulated unchecked.
 *
 * These are prompt constraints, not validation. Repetition that a writer intends
 * is legitimate; the point is that the drafter should know it is repeating.
 */

/** Avoid-list entries carried into a drafting prompt. */
const MAX_CONSTRAINTS = 8;

export function draftRepetitionConstraints(root: string): string[] {
  let avoid: readonly string[];
  try {
    avoid = buildProjectRepetitionMemory(root).avoid_list;
  } catch {
    // No chapters yet, or an unreadable manuscript. A first chapter has nothing
    // to repeat, and drafting must not depend on this being available.
    return [];
  }
  const selected = avoid.slice(0, MAX_CONSTRAINTS).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (selected.length === 0) return [];
  return [
    `Recent chapters already lean on these patterns; do not reuse them here unless the scene genuinely requires it: ${selected.map((item) => `“${item}”`).join(", ")}.`,
  ];
}

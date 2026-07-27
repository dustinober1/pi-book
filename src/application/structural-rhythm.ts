import type { ChapterQueueState } from "../domain/schemas.js";
import type { PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";

/**
 * Structural rhythm checks for a book plan.
 *
 * A novel that is metronomic at the structural level reads generated however
 * good its sentences are: every chapter the same length, POV rotating on a fixed
 * cycle, every chapter turning on the same causal joint, every chapter ending on
 * the same kind of beat.
 *
 * This check exists partly to correct a tension introduced by the v1.10.0 draft
 * length band. That band holds a chapter to 85%–110% of its packet target, which
 * is right — but if every packet carries the same target, the band now enforces
 * uniform chapter lengths. Variance has to live in the plan, so it is checked
 * where the plan is approved rather than where the prose is written.
 */

export interface StructuralRhythmFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

/** Below this many chapters, dispersion measures say nothing useful. */
const MINIMUM_CHAPTERS = 5;
/** Coefficient of variation below this is flat enough to be worth reporting. */
const LOW_VARIATION = 0.1;
/** One causal joint covering more than this share of chapters is monotony. */
const CAUSALITY_DOMINANCE = 0.8;
/** Distinct ending beats below this share of chapters is repetition. */
const ENDING_VARIETY_FLOOR = 0.5;
/** POV periodicity needs a long enough run to be a pattern rather than a coincidence. */
const MINIMUM_POV_CHAPTERS = 6;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / mean;
}

function isPeriodic(values: readonly string[], period: number): boolean {
  if (period < 1 || values.length < period * 2) return false;
  return values.every((value, index) => value === values[index % period]);
}

function dominantShare(values: readonly string[]): { value: string; share: number } | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const [top] = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en-US"));
  if (top === undefined) return null;
  return { value: top[0], share: top[1] / values.length };
}

function chapterLengthFindings(queue: ChapterQueueState): StructuralRhythmFinding[] {
  const packets = [...queue.packets].sort((left, right) => left.chapter - right.chapter);
  if (packets.length < MINIMUM_CHAPTERS) return [];
  const targets = packets.map((packet) => packet.target_words);

  const first = targets[0];
  if (first !== undefined && targets.every((value) => value === first)) {
    return [{
      severity: "blocker",
      code: "uniform-chapter-length",
      message: `All ${targets.length} planned chapters carry the same target of ${first.toLocaleString("en-US")} words. Chapter drafts are held to 85%–110% of their target, so an entirely uniform plan enforces metronomic pacing on the finished book. Vary target_words so the plan reflects the shape of the story — a chapter that turns quickly should be shorter than one that carries a sustained set piece.`,
    }];
  }

  const variation = coefficientOfVariation(targets);
  if (variation < LOW_VARIATION) {
    return [{
      severity: "warning",
      code: "low-chapter-length-variance",
      message: `Planned chapter lengths vary by only ${(variation * 100).toFixed(1)}% around their mean across ${targets.length} chapters. Combined with the 85%–110% draft band this produces near-uniform chapter lengths. Consider whether the story's shape justifies more variation.`,
    }];
  }
  return [];
}

function povFindings(queue: ChapterQueueState): StructuralRhythmFinding[] {
  const packets = [...queue.packets].sort((left, right) => left.chapter - right.chapter);
  if (packets.length < MINIMUM_POV_CHAPTERS) return [];
  const povs = packets.map((packet) => normalize(packet.pov)).filter(Boolean);
  const distinct = new Set(povs).size;
  if (distinct < 2 || povs.length < MINIMUM_POV_CHAPTERS) return [];
  if (!isPeriodic(povs, distinct)) return [];
  return [{
    severity: "warning",
    code: "periodic-pov-rotation",
    message: `POV rotates on a fixed ${distinct}-chapter cycle for all ${povs.length} planned chapters. A perfectly predictable rotation tells the reader where they will be next and removes the plan's ability to stay with a thread that has momentum. Break the cycle where the story needs it.`,
  }];
}

function causalityFindings(plot: PlotGridPhase4): StructuralRhythmFinding[] {
  const causality = plot.chapters.map((chapter) => normalize(chapter.causality)).filter(Boolean);
  if (causality.length < MINIMUM_CHAPTERS) return [];
  const dominant = dominantShare(causality);
  if (dominant === null || dominant.share <= CAUSALITY_DOMINANCE) return [];
  return [{
    severity: "warning",
    code: "uniform-causality",
    message: `${Math.round(dominant.share * 100)}% of planned chapters turn on the same causal joint (“${dominant.value}”). Alternating consequence and reversal is what keeps a plot from reading as a list of events.`,
  }];
}

function endingFindings(queue: ChapterQueueState): StructuralRhythmFinding[] {
  const hooks = queue.packets.map((packet) => normalize(packet.ending_hook)).filter(Boolean);
  if (hooks.length < MINIMUM_CHAPTERS) return [];
  const variety = new Set(hooks).size / hooks.length;
  if (variety >= ENDING_VARIETY_FLOOR) return [];
  return [{
    severity: "warning",
    code: "uniform-chapter-endings",
    message: `The ${hooks.length} planned chapters use only ${new Set(hooks).size} distinct ending beats. Chapters that all close the same way train the reader to stop feeling the ending.`,
  }];
}

export function structuralRhythmFindings(queue: ChapterQueueState, plot: PlotGridPhase4): StructuralRhythmFinding[] {
  return [
    ...chapterLengthFindings(queue),
    ...povFindings(queue),
    ...causalityFindings(plot),
    ...endingFindings(queue),
  ];
}

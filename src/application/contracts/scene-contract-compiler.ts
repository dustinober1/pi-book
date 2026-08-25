import {
  MAXIMUM_SCENES_PER_CHAPTER,
  type ChapterContract,
  type SceneBeat,
} from "../../domain/chapter-contract.js";
import type { SceneContract } from "../../domain/scene-contract.js";
import { assertValidSceneContracts } from "./scene-contract-validator.js";

/**
 * Compile a chapter contract into the scene contracts a small model executes.
 *
 * This used to divide a chapter by dealing its `required_beats` round-robin
 * into N piles. Those beats are five descriptions of the whole chapter on five
 * unlike axes, not an ordered sequence, so the division produced scene briefs
 * like this one — every field the same eight-word string, and a genre label
 * standing where an objective belongs:
 *
 * ```text
 *   objective: SCENE ENGINE: interrogation
 *   conflict : Opposition prevents immediate completion of scene engine: interrogation
 *   turn     : SCENE ENGINE: interrogation
 *   ending   : SCENE ENGINE: interrogation
 * ```
 *
 * The scene contract is the only structure a scene-drafting model receives, and
 * everything downstream — the plan job, the draft job, the five critics, the
 * state-delta extractor — is measured against it. Dealing also scrambled order,
 * putting a relationship beat in scene 1 ahead of the character beat in scene 4
 * that motivated it, and left later scenes with no active threads at all, which
 * silently forbade the state-delta job from reporting thread movement there.
 *
 * Scene structure is now authored on the chapter contract as `scene_beats` and
 * mapped one-to-one. Nothing is dealt and nothing is fabricated. A chapter with
 * no authored scene structure compiles to a single scene derived from *named*
 * chapter fields — purpose, the beat list, the ending hook — and carrying the
 * chapter's beats whole rather than a share of them. When a chapter is too long
 * to be one scene and says nothing about its scenes, this
 * refuses to compile, exactly as `assertSmallModelChapterContract` refuses a
 * contract missing its other judgement fields. An honest failure at the
 * readiness check beats a hollow contract executed at inference time.
 */

/**
 * The largest chapter that compiles to one scene without authored structure.
 * Matches the per-scene sizing the pipeline has always assumed and keeps a
 * single scene inside the reserved output budget of a small model.
 */
export const SINGLE_SCENE_MAXIMUM_WORDS = 1_000;

/** `SceneContractSchema.target_words.minimum`; a split below it cannot validate. */
const MINIMUM_SCENE_WORDS = 150;

export const MISSING_SCENE_BEATS_REMEDY = `A chapter longer than ${SINGLE_SCENE_MAXIMUM_WORDS} words must say what its scenes are. Supply scene_beats through novel_complete_chapter_contract — for each scene, what the viewpoint is trying to do, what stops it, and what has changed by the end.`;

function distribute(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Compares briefs by what they say, not by punctuation or spacing. */
function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[.!?;:,]+$/, "").toLocaleLowerCase("en-US");
}

/**
 * The single scene a chapter with no authored structure compiles to.
 *
 * Every value comes from a named chapter field, so this maps rather than
 * guesses, and the scene carries the chapter's `required_beats` whole rather
 * than a share of them. That is why this is not the defect the dealing was: a
 * lone scene covering every beat withholds nothing, even where two of its three
 * summary fields end up saying similar things.
 */
export function derivedSingleSceneBeat(contract: ChapterContract): SceneBeat {
  const objective = contract.purpose;
  const beats = contract.required_beats;
  const conflict = beats.find((beat) => normalized(beat) !== normalized(objective)) ?? contract.ending_hook;
  const turn = [...beats].reverse().find((beat) => normalized(beat) !== normalized(objective) && normalized(beat) !== normalized(conflict))
    ?? contract.ending_hook;
  return { objective, conflict, turn };
}

/**
 * A scene brief whose objective, conflict and turn are not three different
 * things cannot be executed: it names one fact three times. Reported rather
 * than repaired, because only the author can say what the missing two are.
 *
 * `strictness` differs by where the brief came from. An authored scene's three
 * fields are its *entire* brief — the drafting model sees nothing else about
 * that scene — so all three must differ. The single derived scene also carries
 * the chapter's whole beat list, so only a total collapse, where one string
 * stands for all three, leaves the model with nothing.
 */
export function degenerateSceneBeatFindings(
  beats: readonly SceneBeat[],
  strictness: "authored" | "derived" = "authored",
): string[] {
  const findings: string[] = [];
  beats.forEach((beat, index) => {
    if (strictness === "derived") {
      if (normalized(beat.objective) === normalized(beat.conflict) && normalized(beat.conflict) === normalized(beat.turn)) {
        findings.push(`Chapter purpose, beats and ending hook all reduce to one statement: "${beat.objective.trim()}". There is nothing for a scene to be about.`);
      }
      return;
    }
    const pairs: Array<[string, string, string, string]> = [
      ["objective", "conflict", beat.objective, beat.conflict],
      ["objective", "turn", beat.objective, beat.turn],
      ["conflict", "turn", beat.conflict, beat.turn],
    ];
    for (const [leftName, rightName, left, right] of pairs) {
      if (normalized(left) === normalized(right)) {
        findings.push(`Scene ${index + 1} states the same thing as its ${leftName} and its ${rightName}: "${left.trim()}". A scene needs an objective, something that stops it, and a change by the end.`);
      }
    }
  });
  return findings;
}

/** The scene structure a contract will compile with, authored or derived. */
export function effectiveSceneBeats(contract: ChapterContract): SceneBeat[] {
  const authored = contract.scene_beats;
  if (authored && authored.length) return authored.map((beat) => ({ ...beat }));
  return [derivedSingleSceneBeat(contract)];
}

/**
 * Why this contract cannot compile to scenes, or an empty list. Used by the
 * readiness check so the writer learns at contract time, not mid-run.
 */
export function sceneStructureFindings(contract: ChapterContract): string[] {
  const authored = contract.scene_beats;
  if (!authored || authored.length === 0) {
    if (contract.target_words.maximum > SINGLE_SCENE_MAXIMUM_WORDS) {
      return [`Chapter ${contract.chapter} targets up to ${contract.target_words.maximum} words but declares no scene structure. ${MISSING_SCENE_BEATS_REMEDY}`];
    }
    return degenerateSceneBeatFindings([derivedSingleSceneBeat(contract)], "derived");
  }
  const findings = degenerateSceneBeatFindings(authored);
  const chapterThreads = new Set(contract.active_thread_ids);
  const seen = new Map<string, number>();
  authored.forEach((beat, index) => {
    for (const threadId of beat.thread_ids ?? []) {
      if (!chapterThreads.has(threadId)) findings.push(`Scene ${index + 1} names thread ${threadId}, which is not one of the chapter's active threads.`);
    }
    // Two scenes with the same brief are one scene written twice, which is how
    // a chapter acquires a middle that repeats itself.
    const signature = [beat.objective, beat.conflict, beat.turn].map(normalized).join("\u0000");
    const first = seen.get(signature);
    if (first !== undefined) findings.push(`Scene ${index + 1} repeats the brief of scene ${first}. Two scenes with the same objective, conflict and turn are one scene written twice.`);
    else seen.set(signature, index + 1);
  });
  findings.push(...wordSplitFindings(contract, authored.length));
  return findings;
}

function wordSplitFindings(contract: ChapterContract, count: number): string[] {
  const minimums = distribute(contract.target_words.minimum, count);
  const smallest = Math.min(...minimums);
  if (smallest < MINIMUM_SCENE_WORDS) {
    return [`Splitting ${contract.target_words.minimum} minimum words across ${count} scenes leaves ${smallest} words for one of them, below the ${MINIMUM_SCENE_WORDS}-word floor a scene contract can carry. Use fewer scenes or raise the chapter's target words through a plan-change event.`];
  }
  return [];
}

export function compileSceneContracts(contract: ChapterContract, requestedCount?: number): SceneContract[] {
  if (!contract.small_model_ready) throw new Error(`Chapter contract ${contract.contract_id} is not small-model ready.`);

  const structureFindings = sceneStructureFindings(contract);
  if (structureFindings.length) {
    throw new Error(`Chapter contract ${contract.contract_id} has no executable scene structure:\n${structureFindings.map((item) => `- ${item}`).join("\n")}`);
  }

  const authored = contract.scene_beats?.length ? contract.scene_beats : null;
  const beats = effectiveSceneBeats(contract);
  const count = beats.length;
  if (requestedCount !== undefined && requestedCount !== count) {
    throw new Error(`Chapter contract ${contract.contract_id} declares ${count} scene${count === 1 ? "" : "s"}; a scene count of ${requestedCount} was requested. Scene count is the contract's decision, not the caller's — change scene_beats through novel_complete_chapter_contract.`);
  }
  if (!Number.isInteger(count) || count < 1 || count > MAXIMUM_SCENES_PER_CHAPTER) {
    throw new Error(`Scene count must be an integer from 1 to ${MAXIMUM_SCENES_PER_CHAPTER}.`);
  }

  const minimums = distribute(contract.target_words.minimum, count);
  const maximums = distribute(contract.target_words.maximum, count);

  const scenes = beats.map((beat, index) => {
    const sequence = index + 1;
    const isFinal = index === count - 1;
    return {
      schema_version: "1.0.0",
      scene_id: `${contract.contract_id}-SC-${String(sequence).padStart(2, "0")}-V${contract.version}`,
      chapter_contract_id: contract.contract_id,
      chapter_contract_version: contract.version,
      sequence,
      pov: contract.pov,
      objective: beat.objective,
      conflict: beat.conflict,
      turn: beat.turn,
      // An authored scene plans its own three movements, in the order they
      // happen — not a share of the chapter's axes. The single derived scene
      // *is* the chapter, so it carries the chapter's beats whole; splitting
      // them was the defect, but a lone scene covering all of them is not a
      // split.
      required_beats: authored ? [beat.objective, beat.conflict, beat.turn] : [...contract.required_beats],
      // Every chapter thread is live unless the author narrowed this scene. A
      // scene with no active threads cannot report thread movement at all.
      active_thread_ids: beat.thread_ids ? [...beat.thread_ids] : [...contract.active_thread_ids],
      required_record_ids: contract.required_record_ids,
      start_state_ids: contract.start_state_ids,
      expected_state_delta: isFinal ? contract.required_end_state : [],
      forbidden_changes: contract.forbidden_changes,
      knowledge_boundary_ids: contract.knowledge_boundary_ids,
      target_words: { minimum: minimums[index]!, maximum: maximums[index]! },
      // The chapter's hook belongs to the chapter's last scene. Every earlier
      // scene ends on its own turn.
      ending_requirement: isFinal ? contract.ending_hook : beat.turn,
    } satisfies SceneContract;
  });

  assertValidSceneContracts(contract, scenes);
  return scenes;
}

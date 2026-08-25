import { MAXIMUM_SCENES_PER_CHAPTER, type ChapterContract } from "../../domain/chapter-contract.js";
import type { SceneContract } from "../../domain/scene-contract.js";

/**
 * Post-conditions on a compiled scene set.
 *
 * These ran nowhere until scene structure became authored: `compileSceneContracts`
 * dealt beats round-robin and nothing checked the result, so a scene whose
 * objective, conflict and turn were one repeated string compiled cleanly and
 * reached the drafting model. The compiler now asserts these on every call.
 *
 * The beat-coverage rule differs by how the scenes were produced. Where the
 * chapter authored `scene_beats`, coverage is structural: one scene per
 * authored beat, each carrying that beat's three movements in order. Where it
 * did not, the single derived scene must still account for the chapter's own
 * beats, which is the check that existed before.
 */
export function sceneContractFindings(chapter: ChapterContract, scenes: readonly SceneContract[]): string[] {
  const findings: string[] = [];
  if (scenes.length < 1 || scenes.length > MAXIMUM_SCENES_PER_CHAPTER) findings.push(`A chapter must compile to one through ${MAXIMUM_SCENES_PER_CHAPTER} scenes.`);
  const sceneIds = new Set<string>();
  const chapterThreads = new Set(chapter.active_thread_ids);
  for (const scene of scenes) {
    if (sceneIds.has(scene.scene_id)) findings.push(`Duplicate scene ID ${scene.scene_id}.`);
    sceneIds.add(scene.scene_id);
    if (scene.chapter_contract_id !== chapter.contract_id || scene.chapter_contract_version !== chapter.version) findings.push(`${scene.scene_id} references the wrong chapter contract version.`);
    for (const forbidden of chapter.forbidden_changes) if (!scene.forbidden_changes.includes(forbidden)) findings.push(`${scene.scene_id} dropped forbidden change: ${forbidden}`);
    for (const boundary of scene.knowledge_boundary_ids) if (!chapter.knowledge_boundary_ids.includes(boundary)) findings.push(`${scene.scene_id} references unknown knowledge boundary ${boundary}.`);
    for (const threadId of scene.active_thread_ids) if (!chapterThreads.has(threadId)) findings.push(`${scene.scene_id} references thread ${threadId}, which is not active in the chapter.`);
    // The invariant the dealing violated: three fields, three different facts.
    // A brief that names one fact three times cannot be drafted against.
    if (scene.objective === scene.turn && scene.turn === scene.ending_requirement) {
      findings.push(`${scene.scene_id} has the same objective, turn and ending requirement: "${scene.objective}". A scene brief that repeats one fact gives a drafting model nothing to execute.`);
    }
  }

  const authored = chapter.scene_beats;
  if (authored && authored.length) {
    if (scenes.length !== authored.length) {
      findings.push(`The chapter authored ${authored.length} scene beat(s) but compiled to ${scenes.length} scene(s).`);
    } else {
      authored.forEach((beat, index) => {
        const scene = scenes[index]!;
        const expected = [beat.objective, beat.conflict, beat.turn];
        if (scene.required_beats.length !== expected.length || expected.some((item, position) => scene.required_beats[position] !== item)) {
          findings.push(`${scene.scene_id} does not carry the authored beats for scene ${index + 1}.`);
        }
      });
    }
  } else {
    const assignedBeats = scenes.flatMap((scene) => scene.required_beats);
    for (const beat of chapter.required_beats) {
      if (!assignedBeats.includes(beat)) findings.push(`Required chapter beat was not assigned: ${beat}`);
    }
  }

  const minimum = scenes.reduce((sum, scene) => sum + scene.target_words.minimum, 0);
  const maximum = scenes.reduce((sum, scene) => sum + scene.target_words.maximum, 0);
  if (minimum !== chapter.target_words.minimum || maximum !== chapter.target_words.maximum) findings.push("Scene word ranges do not cover the chapter target range exactly.");
  return findings;
}

export function assertValidSceneContracts(chapter: ChapterContract, scenes: readonly SceneContract[]): void {
  const findings = sceneContractFindings(chapter, scenes);
  if (findings.length) throw new Error(`Scene contract validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
}

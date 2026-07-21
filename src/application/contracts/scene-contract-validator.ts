import type { ChapterContract } from "../../domain/chapter-contract.js";
import type { SceneContract } from "../../domain/scene-contract.js";

export function sceneContractFindings(chapter: ChapterContract, scenes: readonly SceneContract[]): string[] {
  const findings: string[] = [];
  if (scenes.length < 1 || scenes.length > 5) findings.push("A chapter must compile to one through five scenes.");
  const sceneIds = new Set<string>();
  for (const scene of scenes) {
    if (sceneIds.has(scene.scene_id)) findings.push(`Duplicate scene ID ${scene.scene_id}.`);
    sceneIds.add(scene.scene_id);
    if (scene.chapter_contract_id !== chapter.contract_id || scene.chapter_contract_version !== chapter.version) findings.push(`${scene.scene_id} references the wrong chapter contract version.`);
    for (const forbidden of chapter.forbidden_changes) if (!scene.forbidden_changes.includes(forbidden)) findings.push(`${scene.scene_id} dropped forbidden change: ${forbidden}`);
    for (const boundary of scene.knowledge_boundary_ids) if (!chapter.knowledge_boundary_ids.includes(boundary)) findings.push(`${scene.scene_id} references unknown knowledge boundary ${boundary}.`);
  }
  const assignedBeats = scenes.flatMap((scene) => scene.required_beats);
  for (const beat of chapter.required_beats) if (!assignedBeats.includes(beat)) findings.push(`Required chapter beat was not assigned: ${beat}`);
  const minimum = scenes.reduce((sum, scene) => sum + scene.target_words.minimum, 0);
  const maximum = scenes.reduce((sum, scene) => sum + scene.target_words.maximum, 0);
  if (minimum !== chapter.target_words.minimum || maximum !== chapter.target_words.maximum) findings.push("Scene word ranges do not cover the chapter target range exactly.");
  return findings;
}

export function assertValidSceneContracts(chapter: ChapterContract, scenes: readonly SceneContract[]): void {
  const findings = sceneContractFindings(chapter, scenes);
  if (findings.length) throw new Error(`Scene contract validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
}

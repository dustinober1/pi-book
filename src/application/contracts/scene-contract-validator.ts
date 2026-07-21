import type { ChapterContract } from "../../domain/chapter-contract.js";
import type { SceneContract } from "../../domain/scene-contract.js";

export interface KnowledgeBoundaryDescriptor {
  id: string;
  pov_refs: string[];
}

export interface SceneContractFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  scene_ids: string[];
  record_ids: string[];
}

export function sceneContractFindings(
  chapter: ChapterContract,
  scenes: readonly SceneContract[],
  knowledgeBoundaries: readonly KnowledgeBoundaryDescriptor[],
): SceneContractFinding[] {
  const findings: SceneContractFinding[] = [];
  const blocker = (code: string, message: string, sceneIds: string[] = [], recordIds: string[] = []) => findings.push({
    severity: "blocker",
    code,
    message,
    scene_ids: sceneIds,
    record_ids: recordIds,
  });
  if (scenes.length < 1 || scenes.length > 5) blocker("invalid-scene-count", "A chapter must compile to one through five scenes.");
  const ids = scenes.map((scene) => scene.scene_id);
  if (new Set(ids).size !== ids.length) blocker("duplicate-scene-id", "Scene contract IDs must be unique.", ids);
  if (JSON.stringify(ids) !== JSON.stringify(chapter.scene_ids)) {
    blocker("scene-id-mismatch", "Compiled scene IDs must match the approved chapter contract order.", ids, chapter.scene_ids);
  }
  const orders = scenes.map((scene) => scene.order);
  if (!orders.every((order, index) => order === index + 1)) blocker("invalid-scene-order", "Scene order must be contiguous from one.", ids);
  const totalMinimum = scenes.reduce((sum, scene) => sum + scene.target_words.minimum, 0);
  const totalMaximum = scenes.reduce((sum, scene) => sum + scene.target_words.maximum, 0);
  if (totalMinimum > chapter.target_words.minimum || totalMaximum < chapter.target_words.maximum) {
    blocker(
      "chapter-word-range-not-covered",
      `Scene ranges ${totalMinimum}-${totalMaximum} do not cover chapter range ${chapter.target_words.minimum}-${chapter.target_words.maximum}.`,
      ids,
    );
  }
  const coveredBeats = new Set(scenes.flatMap((scene) => scene.required_beat_ids));
  for (const beat of chapter.required_beat_ids) {
    if (!coveredBeats.has(beat)) blocker("uncovered-required-beat", `Required beat ${beat} is not assigned to a scene.`, [], [beat]);
  }
  const chapterBeats = new Set(chapter.required_beat_ids);
  const chapterThreads = new Set(chapter.active_thread_ids);
  const chapterResearch = new Set(chapter.required_research_ids);
  const boundaries = new Map(knowledgeBoundaries.map((item) => [item.id, item]));
  for (const scene of scenes) {
    if (scene.chapter_contract_id !== chapter.contract_id) blocker("chapter-contract-mismatch", `${scene.scene_id} names ${scene.chapter_contract_id}, not ${chapter.contract_id}.`, [scene.scene_id]);
    if (scene.pov !== chapter.pov) blocker("scene-pov-mismatch", `${scene.scene_id} changes POV outside the chapter contract.`, [scene.scene_id], [scene.pov]);
    if (scene.target_words.maximum < scene.target_words.minimum) blocker("invalid-scene-word-range", `${scene.scene_id} maximum words are below minimum words.`, [scene.scene_id]);
    for (const beat of scene.required_beat_ids) if (!chapterBeats.has(beat)) blocker("unknown-scene-beat", `${scene.scene_id} references beat ${beat} outside the chapter contract.`, [scene.scene_id], [beat]);
    for (const lock of chapter.forbidden_change_ids) if (!scene.forbidden_change_ids.includes(lock)) blocker("dropped-forbidden-change", `${scene.scene_id} drops protected change ${lock}.`, [scene.scene_id], [lock]);
    for (const thread of scene.active_thread_ids) if (!chapterThreads.has(thread)) blocker("inactive-scene-thread", `${scene.scene_id} activates thread ${thread} outside the chapter contract.`, [scene.scene_id], [thread]);
    for (const research of scene.required_research_ids) if (!chapterResearch.has(research)) blocker("unapproved-scene-research", `${scene.scene_id} requests research ${research} outside the chapter contract.`, [scene.scene_id], [research]);
    for (const boundaryId of scene.knowledge_boundary_ids) {
      const boundary = boundaries.get(boundaryId);
      if (!boundary) blocker("unknown-knowledge-boundary", `${scene.scene_id} references unknown knowledge boundary ${boundaryId}.`, [scene.scene_id], [boundaryId]);
      else if (!boundary.pov_refs.includes(scene.pov)) blocker("knowledge-boundary-pov-mismatch", `${boundaryId} does not apply to scene POV ${scene.pov}.`, [scene.scene_id], [boundaryId, scene.pov]);
    }
  }
  return findings;
}

export function assertSceneContractsValid(
  chapter: ChapterContract,
  scenes: readonly SceneContract[],
  knowledgeBoundaries: readonly KnowledgeBoundaryDescriptor[],
): void {
  const blockers = sceneContractFindings(chapter, scenes, knowledgeBoundaries).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Scene contracts for ${chapter.contract_id} are invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

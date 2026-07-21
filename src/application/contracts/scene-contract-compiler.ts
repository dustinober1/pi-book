import { Value } from "@sinclair/typebox/value";
import type { ChapterContract, StateExpectation } from "../../domain/chapter-contract.js";
import { SceneContractSchema, type SceneContract } from "../../domain/scene-contract.js";
import {
  sceneContractFindings,
  type KnowledgeBoundaryDescriptor,
} from "./scene-contract-validator.js";

export { sceneContractFindings } from "./scene-contract-validator.js";

export interface SceneContractInput {
  objective: string;
  conflict: string;
  turn: string;
  location_ref: string | null;
  time_ref: string | null;
  required_beat_ids: string[];
  expected_delta: StateExpectation[];
  target_words: { minimum: number; maximum: number };
  start_state_refs?: string[];
  knowledge_boundary_ids?: string[];
  active_thread_ids?: string[];
  required_research_ids?: string[];
  allowed_invention_rules?: string[];
  acceptance_tests?: SceneContract["acceptance_tests"];
  stop_conditions?: string[];
}

export interface CompileSceneContractsInput {
  chapter: ChapterContract;
  scenes: SceneContractInput[];
  knowledgeBoundaries: KnowledgeBoundaryDescriptor[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value.trim())).map((value) => value.trim()))];
}

export function compileSceneContracts(input: CompileSceneContractsInput): SceneContract[] {
  if (input.scenes.length < 1 || input.scenes.length > 5) throw new Error("Scene compilation requires one through five scene descriptions.");
  if (input.chapter.scene_ids.length !== input.scenes.length) {
    throw new Error(`Chapter contract ${input.chapter.contract_id} declares ${input.chapter.scene_ids.length} scene IDs but ${input.scenes.length} scenes were supplied.`);
  }
  const scenes = input.scenes.map<SceneContract>((source, index) => {
    const sceneId = input.chapter.scene_ids[index]!;
    const acceptance = source.acceptance_tests ?? [
      {
        id: `TEST-${sceneId}-BEATS`,
        category: "required-beat",
        description: `Scene ${sceneId} includes its required beats without changing their meaning.`,
        record_ids: unique(source.required_beat_ids),
      },
      {
        id: `TEST-${sceneId}-WORDS`,
        category: "word-range",
        description: `Scene ${sceneId} remains between ${source.target_words.minimum} and ${source.target_words.maximum} words.`,
        record_ids: [],
      },
    ];
    const scene: SceneContract = {
      schema_version: "1.0.0",
      scene_id: sceneId,
      chapter_contract_id: input.chapter.contract_id,
      order: index + 1,
      pov: input.chapter.pov,
      location_ref: source.location_ref,
      time_ref: source.time_ref,
      objective: source.objective.trim(),
      conflict: source.conflict.trim(),
      turn: source.turn.trim(),
      start_state_refs: unique(source.start_state_refs ?? input.chapter.start_state_refs),
      expected_delta: structuredClone(source.expected_delta),
      required_beat_ids: unique(source.required_beat_ids),
      forbidden_change_ids: [...input.chapter.forbidden_change_ids],
      knowledge_boundary_ids: unique(source.knowledge_boundary_ids ?? input.chapter.knowledge_boundary_ids),
      active_thread_ids: unique(source.active_thread_ids ?? input.chapter.active_thread_ids),
      required_research_ids: unique(source.required_research_ids ?? input.chapter.required_research_ids),
      allowed_invention_rules: unique(source.allowed_invention_rules ?? input.chapter.allowed_invention_rules),
      target_words: { ...source.target_words },
      acceptance_tests: structuredClone(acceptance),
      stop_conditions: [...(source.stop_conditions ?? input.chapter.stop_conditions)],
    };
    if (!Value.Check(SceneContractSchema, scene)) throw new Error(`Compiled scene contract ${sceneId} failed schema validation.`);
    return scene;
  });
  return scenes;
}

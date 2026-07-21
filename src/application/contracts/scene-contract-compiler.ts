import type { ChapterContract } from "../../domain/chapter-contract.js";
import type { SceneContract } from "../../domain/scene-contract.js";

function distribute(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function groups<T>(items: readonly T[], count: number): T[][] {
  const result = Array.from({ length: count }, () => [] as T[]);
  items.forEach((item, index) => result[index % count]!.push(item));
  return result;
}

export function compileSceneContracts(contract: ChapterContract, requestedCount?: number): SceneContract[] {
  if (!contract.small_model_ready) throw new Error(`Chapter contract ${contract.contract_id} is not small-model ready.`);
  const count = requestedCount ?? Math.min(5, Math.max(1, Math.ceil(contract.target_words.maximum / 1000)));
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error("Scene count must be an integer from 1 to 5.");
  if (contract.required_beats.length < count) throw new Error("Each scene requires at least one chapter beat.");

  const beatGroups = groups(contract.required_beats, count);
  const minimums = distribute(contract.target_words.minimum, count);
  const maximums = distribute(contract.target_words.maximum, count);
  const threadGroups = groups(contract.active_thread_ids, count);

  return beatGroups.map((requiredBeats, index) => {
    const sequence = index + 1;
    return {
      schema_version: "1.0.0",
      scene_id: `${contract.contract_id}-SC-${String(sequence).padStart(2, "0")}-V${contract.version}`,
      chapter_contract_id: contract.contract_id,
      chapter_contract_version: contract.version,
      sequence,
      pov: contract.pov,
      objective: requiredBeats[0]!,
      conflict: requiredBeats[1] ?? `Opposition prevents immediate completion of ${requiredBeats[0]!.toLowerCase()}`,
      turn: requiredBeats.at(-1)!,
      required_beats: requiredBeats,
      active_thread_ids: threadGroups[index] ?? [],
      required_record_ids: contract.required_record_ids,
      start_state_ids: contract.start_state_ids,
      expected_state_delta: index === count - 1 ? contract.required_end_state : [],
      forbidden_changes: contract.forbidden_changes,
      knowledge_boundary_ids: contract.knowledge_boundary_ids,
      target_words: { minimum: minimums[index]!, maximum: maximums[index]! },
      ending_requirement: index === count - 1 ? contract.ending_hook : requiredBeats.at(-1)!,
    } satisfies SceneContract;
  });
}

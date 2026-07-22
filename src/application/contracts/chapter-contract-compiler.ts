import { createHash } from "node:crypto";
import type { ChapterPacket } from "../../domain/schemas.js";
import type { ChapterContract } from "../../domain/chapter-contract.js";

function normalizedHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requiredBeats(packet: ChapterPacket): string[] {
  return [
    packet.purpose,
    packet.scene_engine,
    packet.pressure_movement,
    packet.character_movement,
    packet.relationship_movement,
  ].map((item) => item.trim()).filter(Boolean);
}

export interface LegacyChapterContractCompileOptions {
  activeThreadIds?: readonly string[];
}

function activeThreads(packet: ChapterPacket, options: LegacyChapterContractCompileOptions): string[] {
  const explicit = [...new Set(packet.story_thread_refs)];
  if (options.activeThreadIds === undefined) return explicit;
  const scheduled = [...new Set(options.activeThreadIds)];
  for (const threadId of explicit) {
    if (!scheduled.includes(threadId)) throw new Error(`Chapter thread schedule omitted explicit packet thread ${threadId}.`);
  }
  return scheduled;
}

export function compileLegacyChapterContract(
  packet: ChapterPacket,
  options: LegacyChapterContractCompileOptions = {},
): ChapterContract {
  const minimum = Math.max(300, Math.floor(packet.target_words * 0.85));
  const maximum = Math.max(minimum, Math.ceil(packet.target_words * 1.1));
  const missing = ["start_state_ids", "required_end_state", "forbidden_changes", "knowledge_boundary_ids"];
  const activeThreadIds = activeThreads(packet, options);
  return {
    schema_version: "2.0.0",
    contract_id: `CH-${String(packet.chapter).padStart(3, "0")}`,
    version: 1,
    chapter: packet.chapter,
    title: packet.title,
    source_kind: "legacy-packet",
    source_packet_hash: normalizedHash(packet),
    pov: packet.pov,
    purpose: packet.purpose,
    required_beats: requiredBeats(packet),
    active_thread_ids: activeThreadIds,
    required_record_ids: [...new Set([...packet.continuity_refs, ...packet.character_refs, ...activeThreadIds, ...packet.required_research])],
    start_state_ids: [],
    required_end_state: [],
    forbidden_changes: [],
    knowledge_boundary_ids: [],
    target_words: { minimum, maximum },
    ending_hook: packet.ending_hook,
    small_model_ready: false,
    missing_small_model_fields: missing,
  };
}

export function assertSmallModelChapterContract(contract: ChapterContract): void {
  if (!contract.small_model_ready || contract.missing_small_model_fields.length > 0) {
    throw new Error(`Chapter contract ${contract.contract_id} is not small-model ready: ${contract.missing_small_model_fields.join(", ")}.`);
  }
  if (contract.required_record_ids.length === 0) throw new Error(`Chapter contract ${contract.contract_id} has no required record IDs.`);
}

import { Value } from "@sinclair/typebox/value";
import {
  ChapterContractSchema,
  type ChapterContract,
} from "../../domain/chapter-contract.js";
import type { ChapterPacket } from "../../domain/schemas.js";

export interface CompileLegacyChapterContractInput {
  packet: ChapterPacket;
  sourcePacketHash: string;
}

export interface ChapterContractFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))]
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contractId(chapter: number): string {
  return `CH-${String(chapter).padStart(3, "0")}`;
}

function defaultStyleCardRef(pov: string): string {
  const normalized = pov.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `STYLE-${normalized || "POV"}`;
}

export function compileLegacyChapterContract(input: CompileLegacyChapterContractInput): ChapterContract {
  if (!/^[a-f0-9]{64}$/.test(input.sourcePacketHash)) throw new Error("Legacy chapter contract requires a SHA-256 source packet hash.");
  const profile = input.packet.profile_fields;
  const tense = profile["tense"] === "present" ? "present" : "past";
  const minimum = Math.max(100, Math.floor(input.packet.target_words * 0.8));
  const maximum = Math.max(minimum, Math.ceil(input.packet.target_words * 1.2));
  const contract: ChapterContract = {
    schema_version: "2.0.0",
    contract_id: contractId(input.packet.chapter),
    chapter: input.packet.chapter,
    title: input.packet.title,
    status: "draft",
    pov: input.packet.pov,
    tense,
    purpose: input.packet.purpose,
    start_state_refs: [...new Set([...input.packet.continuity_refs, ...input.packet.character_refs])],
    required_end_state: [],
    required_beat_ids: strings(profile["required_beat_ids"]),
    forbidden_change_ids: strings(profile["forbidden_change_ids"]),
    knowledge_boundary_ids: strings(profile["knowledge_boundary_ids"] ?? (profile["knowledge_boundary"] ? [profile["knowledge_boundary"]] : [])),
    allowed_invention_rules: strings(profile["allowed_invention_rules"]),
    active_thread_ids: [...new Set(input.packet.story_thread_refs)],
    required_research_ids: [...new Set(input.packet.required_research)],
    scene_ids: strings(profile["scene_ids"]),
    style_card_ref: stringValue(profile["style_card_ref"]) ?? defaultStyleCardRef(input.packet.pov),
    target_words: { minimum, maximum },
    acceptance_tests: [{
      id: `TEST-${String(input.packet.chapter).padStart(3, "0")}-WORDS`,
      category: "word-range",
      description: `Chapter prose remains between ${minimum} and ${maximum} words.`,
      record_ids: [],
    }],
    stop_conditions: [
      "Stop if required canon is missing or contradictory.",
      "Stop if completing the chapter would violate a protected reveal or knowledge boundary.",
    ],
    source_packet_hash: input.sourcePacketHash,
  };
  if (!Value.Check(ChapterContractSchema, contract)) throw new Error("Compiled legacy chapter contract failed schema validation.");
  return contract;
}

export function chapterContractFindings(
  contract: ChapterContract,
  options: { smallModel: boolean },
): ChapterContractFinding[] {
  const findings: ChapterContractFinding[] = [];
  const blocker = (code: string, message: string, recordIds: string[] = []) => findings.push({
    severity: "blocker",
    code,
    message,
    record_ids: recordIds,
  });
  if (!Value.Check(ChapterContractSchema, contract)) blocker("invalid-contract-schema", "Chapter contract does not match schema 2.");
  if (contract.target_words.maximum < contract.target_words.minimum) blocker("invalid-word-range", "Chapter contract maximum words are below minimum words.");
  if (options.smallModel) {
    if (contract.status !== "approved") blocker("contract-not-approved", `Chapter contract ${contract.contract_id} is ${contract.status}, not approved.`);
    if (!contract.start_state_refs.length) blocker("missing-start-state", "Small-model drafting requires explicit start-state references.");
    if (!contract.required_end_state.length) blocker("missing-end-state", "Small-model drafting requires an explicit required ending state.");
    if (!contract.required_beat_ids.length) blocker("missing-required-beats", "Small-model drafting requires explicit required beat IDs.");
    if (!contract.forbidden_change_ids.length) blocker("missing-forbidden-changes", "Small-model drafting requires explicit forbidden-change IDs.");
    if (!contract.knowledge_boundary_ids.length) blocker("missing-knowledge-boundaries", "Small-model drafting requires explicit knowledge-boundary IDs.");
    if (!contract.scene_ids.length) blocker("missing-scene-ids", "Small-model drafting requires compiled scene IDs.");
    if (!contract.acceptance_tests.length) blocker("missing-acceptance-tests", "Small-model drafting requires machine-verifiable acceptance tests.");
  }
  return findings;
}

export function assertChapterContractDraftable(
  contract: ChapterContract,
  options: { smallModel: boolean },
): void {
  const blockers = chapterContractFindings(contract, options).filter((finding) => finding.severity === "blocker");
  if (blockers.length) {
    throw new Error(`Chapter contract ${contract.contract_id} is not draftable:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
  }
}

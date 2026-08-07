import type { ChapterPacket } from "../../domain/schemas.js";
import type { KnowledgeLedger } from "../../domain/knowledge-ledger.js";
import type { StateLedger } from "../../domain/state-ledger.js";
import { establishedKnowledgeRecords } from "../knowledge-ledger.js";
import { establishedStateRecords } from "../state-ledger.js";

/**
 * Derive the chapter-contract fields the story graph already determines.
 *
 * `chapter-queue` compiles a contract skeleton and correctly refuses to invent
 * the four judgement fields, because a plausible-looking value would make
 * guarded execution appear available while running against a hollow contract.
 * That refusal is right — but it left the four hardest fields in the workflow
 * to the weakest component in the system, and an incomplete contract is exactly
 * what sends drafting down the unguarded fallback path where no critic runs.
 *
 * Two of the four are not judgement at all:
 *
 *  - `start_state_ids` is "which established state records describe the people
 *    and things this chapter is about" — a query over the state ledger.
 *  - `knowledge_boundary_ids` is "what has this POV established knowledge of"
 *    — a query over the knowledge ledger.
 *
 * Deriving them is not inventing them: every returned ID names a record that
 * already exists with an established status. Nothing is fabricated, and a
 * project with empty ledgers derives nothing rather than guessing.
 *
 * The other two stay with the author. `required_end_state` is what this chapter
 * must change, and `forbidden_changes` is what it must not touch: both are
 * decisions about the story, not facts about the graph, and no amount of
 * querying produces them.
 */

export const DERIVABLE_CONTRACT_FIELDS = ["start_state_ids", "knowledge_boundary_ids"] as const;
export const AUTHORED_CONTRACT_FIELDS = ["required_end_state", "forbidden_changes"] as const;

export interface DerivedContractFields {
  startStateIds: string[];
  knowledgeBoundaryIds: string[];
  /** Which subjects each derivation actually resolved against, for reporting. */
  provenance: {
    subjects: string[];
    stateRecordsConsidered: number;
    knowledgeRecordsConsidered: number;
  };
}

/**
 * The entities a chapter is about: its POV plus every character and continuity
 * record the packet already names. Derivation is scoped to these, so a chapter
 * never starts from the whole ledger.
 */
export function contractSubjects(packet: ChapterPacket): string[] {
  return [...new Set([packet.pov, ...packet.character_refs, ...packet.continuity_refs].map((item) => item.trim()).filter(Boolean))];
}

export function deriveContractFields(
  packet: ChapterPacket,
  ledgers: { state?: StateLedger | null; knowledge?: KnowledgeLedger | null },
): DerivedContractFields {
  const subjects = contractSubjects(packet);
  const subjectSet = new Set(subjects);

  const stateRecords = ledgers.state ? establishedStateRecords(ledgers.state) : [];
  const startStateIds = [...new Set(
    stateRecords.filter((record) => subjectSet.has(record.subject_id)).map((record) => record.id),
  )].sort();

  const knowledgeRecords = ledgers.knowledge ? establishedKnowledgeRecords(ledgers.knowledge) : [];
  // Scoped to the POV: a knowledge boundary is what this viewpoint may know,
  // not what every character in the chapter collectively knows.
  const knowledgeBoundaryIds = [...new Set(
    knowledgeRecords.filter((record) => record.knower_id === packet.pov).map((record) => record.id),
  )].sort();

  return {
    startStateIds,
    knowledgeBoundaryIds,
    provenance: {
      subjects,
      stateRecordsConsidered: stateRecords.length,
      knowledgeRecordsConsidered: knowledgeRecords.length,
    },
  };
}

/**
 * The fields still missing after derivation. A derived field that resolved to
 * nothing stays missing: an empty `start_state_ids` on a project with a
 * populated ledger means the query found nothing to stand on, and claiming
 * readiness there would be the hollow-contract failure in a new costume.
 */
export function remainingContractFields(
  derived: DerivedContractFields,
  authored: { requiredEndState?: readonly unknown[]; forbiddenChanges?: readonly unknown[] } = {},
): string[] {
  const missing: string[] = [];
  if (derived.startStateIds.length === 0) missing.push("start_state_ids");
  if (authored.requiredEndState === undefined || authored.requiredEndState.length === 0) missing.push("required_end_state");
  if (authored.forbiddenChanges === undefined) missing.push("forbidden_changes");
  if (derived.knowledgeBoundaryIds.length === 0) missing.push("knowledge_boundary_ids");
  return missing;
}

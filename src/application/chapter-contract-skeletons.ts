import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../domain/knowledge-ledger.js";
import type { ChapterQueueState } from "../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { compileLegacyChapterContract } from "./contracts/chapter-contract-compiler.js";
import { sceneStructureFindings } from "./contracts/scene-contract-compiler.js";

/**
 * Chapter contract skeletons for every ready packet.
 *
 * Guarded scene execution — scene planning, five critics, targeted repair,
 * ordered acceptance — is reachable only through an executable chapter contract.
 * When `contracts/chapters/` is empty an agent lists it, finds nothing, and
 * drops to a plain `draft-chapter` event, which silently disables the context
 * capsule, the style card, the repetition memory and every critic at once. That
 * single fallback is why none of the quality machinery ran in practice.
 *
 * Nothing semantic is invented here. Generating plausible-looking values would
 * make guarded execution appear available while executing against a hollow
 * contract, which is worse than an honest failure.
 *
 * Two of the four semantic fields are not judgement, though: `start_state_ids`
 * and `knowledge_boundary_ids` are queries over the state and knowledge
 * ledgers, and every ID they return names a record that already exists with an
 * established status. Those are derived. `required_end_state` and
 * `forbidden_changes` — what this chapter must change and must not touch — are
 * decisions about the story that no query produces, and stay with the author,
 * who supplies them through a typed tool call rather than by hand-writing YAML.
 */

/** Ledgers are optional: a project without them derives nothing and says so. */
function readLedgers(root: string): { state: StateLedger | null; knowledge: KnowledgeLedger | null } {
  const read = <T>(path: string, schema: Parameters<typeof parseYaml<T>>[1]): T | null => {
    const text = readText(join(root, path));
    if (text === null) return null;
    try { return parseYaml<T>(text, schema, path); } catch { return null; }
  };
  return {
    state: read<StateLedger>("series/state-ledger.yaml", StateLedgerSchema),
    knowledge: read<KnowledgeLedger>("series/knowledge-ledger.yaml", KnowledgeLedgerSchema),
  };
}

const EXECUTABLE_REMEDY = "Complete them in a chapter-queue event, which allowlists that path, then set small_model_ready: true with an empty missing_small_model_fields. Until then this chapter can only be drafted with a draft-chapter event, without scene critics, targeted repair, or ordered acceptance.";

function readContract(root: string, changes: readonly FileChange[], path: string): ChapterContract | null {
  const submitted = changes.find((change) => change.path === path);
  const text = submitted?.content ?? readText(join(root, path));
  if (text === null || text === undefined) return null;
  try {
    return parseYaml<ChapterContract>(text, ChapterContractSchema, path);
  } catch {
    return null;
  }
}

/**
 * Writes a compiled skeleton for every ready packet that has no contract yet.
 * An existing contract — on disk or submitted with this event — is never
 * overwritten; authored judgement always wins over compilation.
 */
export function appendChapterContractSkeletons(
  root: string,
  changes: FileChange[],
  bookId: string,
  queue: ChapterQueueState,
): string[] {
  const created: string[] = [];
  const ledgers = readLedgers(root);
  for (const packet of queue.packets) {
    if (packet.status !== "ready") continue;
    const path = chapterContractPath(bookId, packet.chapter);
    if (changes.some((change) => change.path === path)) continue;
    if (readText(join(root, path)) !== null) continue;

    const contract = compileLegacyChapterContract(packet, { ledgers });
    if (!Value.Check(ChapterContractSchema, contract)) continue;
    changes.push({ path, content: stringifyYaml(contract) });
    created.push(path);
  }
  return created;
}

/**
 * Reports which ready packets still lack an executable contract. Runs during
 * validation so a dry run and a real apply say the same thing.
 */
export function chapterContractReadinessAdvisories(
  root: string,
  changes: readonly FileChange[],
  bookId: string,
  queue: ChapterQueueState,
): string[] {
  const incomplete: string[] = [];
  for (const packet of queue.packets) {
    if (packet.status !== "ready") continue;
    const path = chapterContractPath(bookId, packet.chapter);
    const contract = readContract(root, changes, path);
    if (contract === null) {
      incomplete.push(`chapter ${packet.chapter} (${path}, to be compiled by this event)`);
      continue;
    }
    if (!contract.small_model_ready) {
      const missing = contract.missing_small_model_fields.join(", ") || "executable fields";
      incomplete.push(`chapter ${packet.chapter} (${path}, missing ${missing})`);
      continue;
    }
    // Readiness is recomputed rather than taken from the stored flag. A
    // contract written before scene structure was authored says it is ready and
    // is not, and trusting the flag would defer that discovery to the middle of
    // a run instead of reporting it here, where the remedy is one tool call.
    const structure = sceneStructureFindings(contract);
    if (structure.length) incomplete.push(`chapter ${packet.chapter} (${path}, ${structure.join("; ")})`);
  }
  if (incomplete.length === 0) return [];
  return [
    `These ready packets have no executable chapter contract yet, so novel_advance_chapter_step cannot run for them: ${incomplete.join("; ")}. ${EXECUTABLE_REMEDY}`,
  ];
}

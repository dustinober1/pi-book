import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import type { ChapterQueueState } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { compileLegacyChapterContract } from "./contracts/chapter-contract-compiler.js";

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
 * The four semantic fields (`start_state_ids`, `required_end_state`,
 * `forbidden_changes`, `knowledge_boundary_ids`) are deliberately NOT invented
 * here. Generating plausible-looking values would make guarded execution appear
 * available while executing against a hollow contract, which is worse than the
 * current honest failure. What is derivable from the packet is compiled; what
 * requires judgement is named as missing, so the directory is never empty and
 * the remaining work is explicit.
 */

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
  for (const packet of queue.packets) {
    if (packet.status !== "ready") continue;
    const path = chapterContractPath(bookId, packet.chapter);
    if (changes.some((change) => change.path === path)) continue;
    if (readText(join(root, path)) !== null) continue;

    const contract = compileLegacyChapterContract(packet);
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
    }
  }
  if (incomplete.length === 0) return [];
  return [
    `These ready packets have no executable chapter contract yet, so novel_advance_chapter_step cannot run for them: ${incomplete.join("; ")}. ${EXECUTABLE_REMEDY}`,
  ];
}

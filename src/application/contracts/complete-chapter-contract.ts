import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema, chapterContractPath, type ChapterContract, type StateMutation } from "../../domain/chapter-contract.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../../domain/knowledge-ledger.js";
import { ChapterQueueSchema, type ChapterQueueState } from "../../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../../domain/state-ledger.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { readBook } from "../../project/store.js";
import { deriveContractFields, remainingContractFields } from "./contract-field-derivation.js";

/**
 * Complete a chapter contract from typed input.
 *
 * `SKILL.md` is roughly five thousand words of normative contract that a weak
 * host model has to hold while hand-authoring schema-exact YAML, where one
 * unquoted `: ` in a prose field rejects the whole file and burns the single
 * permitted retry. The document documents its own trap. The fix is not a
 * shorter skill: it is to stop asking the model for YAML.
 *
 * This is that change applied to the highest-value case. The model supplies the
 * two decisions that are genuinely its own — what this chapter must change, and
 * what it must not touch — as typed values. Everything else is derived from the
 * packet and the ledgers, and the serialisation is done here, so a malformed
 * scalar is impossible rather than merely discouraged.
 *
 * The transaction is unchanged: this produces file content for the existing
 * guarded `chapter-queue` event, which still validates schema, references and
 * allowlists and still ends in one commit. Typing the input removes a failure
 * mode; it does not remove a check.
 */

export interface CompleteChapterContractInput {
  chapter: number;
  /** What this chapter must have changed by its end. */
  requiredEndState: readonly StateMutation[];
  /** What this chapter must not change, in the author's own words. */
  forbiddenChanges: readonly string[];
  /**
   * Optional overrides for the derived fields. Supplying them is authoring, not
   * derivation, so every ID is still checked against the ledgers.
   */
  startStateIds?: readonly string[];
  knowledgeBoundaryIds?: readonly string[];
}

export interface CompleteChapterContractResult {
  path: string;
  content: string;
  /**
   * The complete file set for the guarded event. A `chapter-queue` event
   * validates its whole required output, so the unchanged queue travels with
   * the contract; submitting the contract alone is a missing-required-output
   * rejection.
   */
  files: Array<{ path: string; content: string }>;
  contract: ChapterContract;
  /** Which fields the graph resolved, so the writer can see what was not asked of the model. */
  derivedFields: string[];
  /** Empty when the contract is executable. */
  stillMissing: string[];
}

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

function requireQueue(root: string, bookId: string): ChapterQueueState {
  const path = `books/${bookId}/chapter-queue.yaml`;
  const text = readText(join(root, path));
  if (text === null) throw new Error(`Completing a chapter contract requires ${path}.`);
  return parseYaml<ChapterQueueState>(text, ChapterQueueSchema, path);
}

function requireContract(root: string, bookId: string, chapter: number): ChapterContract {
  const path = chapterContractPath(bookId, chapter);
  const text = readText(join(root, path));
  if (text === null) {
    throw new Error(`No chapter contract skeleton exists at ${path}. A chapter-queue event compiles one for every ready packet; run that first.`);
  }
  return parseYaml<ChapterContract>(text, ChapterContractSchema, path);
}

/**
 * Every referenced ID must name a record that exists. This is the check that
 * makes a typed call safe: without it, typing the input would only move the
 * invention from malformed YAML into well-formed nonsense.
 */
function assertKnownIds(
  label: string,
  ids: readonly string[],
  known: ReadonlySet<string>,
  remedy: string,
): void {
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`${label} names ${unknown.length === 1 ? "a record" : "records"} that do not exist: ${unknown.join(", ")}. ${remedy}`);
}

export function completeChapterContract(root: string, input: CompleteChapterContractInput): CompleteChapterContractResult {
  const book = readBook(root);
  const queue = requireQueue(root, book.book_id);
  const packet = queue.packets.find((item) => item.chapter === input.chapter);
  if (!packet) throw new Error(`Chapter ${input.chapter} has no packet in the active chapter queue.`);
  const existing = requireContract(root, book.book_id, input.chapter);

  const ledgers = readLedgers(root);
  const derived = deriveContractFields(packet, ledgers);
  const stateIds = new Set((ledgers.state?.records ?? []).map((record) => record.id));
  const knowledgeIds = new Set((ledgers.knowledge?.records ?? []).map((record) => record.id));

  const startStateIds = [...new Set(input.startStateIds ?? derived.startStateIds)];
  const knowledgeBoundaryIds = [...new Set(input.knowledgeBoundaryIds ?? derived.knowledgeBoundaryIds)];
  assertKnownIds("start_state_ids", startStateIds, stateIds, "Every start state must name a record in series/state-ledger.yaml.");
  assertKnownIds("knowledge_boundary_ids", knowledgeBoundaryIds, knowledgeIds, "Every knowledge boundary must name a record in series/knowledge-ledger.yaml.");

  const requiredEndState = input.requiredEndState.map((mutation) => ({ ...mutation }));
  if (requiredEndState.length === 0) {
    throw new Error("required_end_state must name at least one state change: a chapter that changes nothing has no executable contract. Say what this chapter must have altered by its end.");
  }
  assertKnownIds(
    "required_end_state",
    requiredEndState.map((mutation) => mutation.record_id),
    stateIds,
    "Every required end state must name a record in series/state-ledger.yaml.",
  );

  const contract: ChapterContract = {
    ...existing,
    // Authoring a contract supersedes the compiled skeleton.
    source_kind: "approved-contract",
    version: existing.version + 1,
    start_state_ids: [...startStateIds].sort(),
    required_end_state: requiredEndState,
    forbidden_changes: [...input.forbiddenChanges],
    knowledge_boundary_ids: [...knowledgeBoundaryIds].sort(),
    small_model_ready: false,
    missing_small_model_fields: [],
  };
  const stillMissing = remainingContractFields(
    { ...derived, startStateIds, knowledgeBoundaryIds },
    { requiredEndState, forbiddenChanges: contract.forbidden_changes },
  );
  contract.small_model_ready = stillMissing.length === 0;
  contract.missing_small_model_fields = stillMissing;

  if (!Value.Check(ChapterContractSchema, contract)) {
    throw new Error("The completed chapter contract failed schema validation before serialisation.");
  }

  const derivedFields: string[] = [];
  if (input.startStateIds === undefined && startStateIds.length) derivedFields.push("start_state_ids");
  if (input.knowledgeBoundaryIds === undefined && knowledgeBoundaryIds.length) derivedFields.push("knowledge_boundary_ids");

  const path = chapterContractPath(book.book_id, input.chapter);
  const content = stringifyYaml(contract);
  const queuePath = `books/${book.book_id}/chapter-queue.yaml`;
  return {
    path,
    content,
    files: [
      { path: queuePath, content: readText(join(root, queuePath)) ?? stringifyYaml(queue) },
      { path, content },
    ],
    contract,
    derivedFields,
    stillMissing,
  };
}

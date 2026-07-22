import { join, relative } from "node:path";
import { ChapterContractSchema, type ChapterContract } from "../domain/chapter-contract.js";
import { EntityRegistrySchema, type EntityRegistry } from "../domain/entity-registry.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../domain/knowledge-ledger.js";
import { CanonSchema, StoryThreadsSchema, type BookState, type CanonState, type StoryThreadsState } from "../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { ResearchLedgerSchema, type ResearchLedger } from "../domain/v1-3-schemas.js";
import { listFilesRecursive, readText } from "../infrastructure/files.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { assertCanonicalStoryIntegrity } from "./canonical-story-integrity.js";
import type { NovelEventInput } from "./events.js";

const ENTITY_PATH = "series/entity-registry.yaml";
const STATE_PATH = "series/state-ledger.yaml";
const KNOWLEDGE_PATH = "series/knowledge-ledger.yaml";

function normalized(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function overlay(root: string, files: readonly FileChange[], path: string): string | null {
  return files.find((file) => normalized(file.path) === path)?.content ?? readText(join(root, path));
}

function parseRequired<T>(root: string, files: readonly FileChange[], path: string, schema: object): T {
  const content = overlay(root, files, path);
  if (content === null) throw new Error(`Missing required canonical story state: ${path}.`);
  return parseYaml<T>(content, schema as never, path);
}

function parseOptional<T>(root: string, files: readonly FileChange[], path: string, schema: object, fallback: T): T {
  const content = overlay(root, files, path);
  return content === null ? fallback : parseYaml<T>(content, schema as never, path);
}

function contractPattern(bookId: string): RegExp {
  const escaped = bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^books/${escaped}/contracts/chapters/CH-[0-9]{3}\\.yaml$`);
}

function contractPaths(root: string, files: readonly FileChange[], bookId: string): string[] {
  const pattern = contractPattern(bookId);
  const stored = listFilesRecursive(join(root, "books", bookId, "contracts", "chapters"), (path) => /\.yaml$/i.test(path))
    .map((path) => normalizedRelative(root, path))
    .filter((path) => pattern.test(path));
  const changed = files.map((file) => normalized(file.path)).filter((path) => pattern.test(path));
  return [...new Set([...stored, ...changed])].sort();
}

function hasCanonicalStoryState(root: string, files: readonly FileChange[], bookId: string): boolean {
  return [ENTITY_PATH, STATE_PATH, KNOWLEDGE_PATH].some((path) => overlay(root, files, path) !== null)
    || contractPaths(root, files, bookId).length > 0;
}

export function validateCanonicalStoryEvent(root: string, input: NovelEventInput, book: BookState): void {
  if (!(input.eventType === "series-plan" || input.eventType === "book-plan" || input.eventType === "chapter-queue" || input.eventType === "canon-lock")) return;
  if (!hasCanonicalStoryState(root, input.files, book.book_id)) return;

  const entities = parseOptional<EntityRegistry>(root, input.files, ENTITY_PATH, EntityRegistrySchema, {
    schema_version: "1.0.0",
    entities: [],
  });
  const state = parseOptional<StateLedger>(root, input.files, STATE_PATH, StateLedgerSchema, {
    schema_version: "1.0.0",
    records: [],
  });
  const knowledge = parseOptional<KnowledgeLedger>(root, input.files, KNOWLEDGE_PATH, KnowledgeLedgerSchema, {
    schema_version: "1.0.0",
    records: [],
  });
  const canon = parseRequired<CanonState>(root, input.files, "series/canon.yaml", CanonSchema);
  const threads = parseRequired<StoryThreadsState>(root, input.files, "series/story-threads.yaml", StoryThreadsSchema);
  const research = parseRequired<ResearchLedger>(root, input.files, `books/${book.book_id}/research-ledger.yaml`, ResearchLedgerSchema);
  const plot = parseRequired<PlotGridPhase4>(root, input.files, `books/${book.book_id}/plot-grid.yaml`, PlotGridPhase4Schema);
  const contracts = contractPaths(root, input.files, book.book_id).map((path): { path: string; contract: ChapterContract } => ({
    path,
    contract: parseRequired<ChapterContract>(root, input.files, path, ChapterContractSchema),
  }));

  assertCanonicalStoryIntegrity({ entities, state, knowledge, canon, threads, research, plot, contracts });
}

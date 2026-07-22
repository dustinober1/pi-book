import { join, relative } from "node:path";
import { ChapterContractSchema, type ChapterContract } from "../domain/chapter-contract.js";
import { EntityRegistrySchema, type EntityRegistry } from "../domain/entity-registry.js";
import { KnowledgeLedgerSchema, type KnowledgeLedger } from "../domain/knowledge-ledger.js";
import { CanonSchema, StoryThreadsSchema, type CanonState, type StoryThreadsState } from "../domain/schemas.js";
import { StateLedgerSchema, type StateLedger } from "../domain/state-ledger.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { ResearchLedgerSchema, type ResearchLedger } from "../domain/v1-3-schemas.js";
import { listFilesRecursive, readText } from "../infrastructure/files.js";
import type { TransactionFileChange } from "../infrastructure/transaction.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { assertCanonicalStoryIntegrity } from "./canonical-story-integrity.js";

const ENTITY_PATH = "series/entity-registry.yaml";
const STATE_PATH = "series/state-ledger.yaml";
const KNOWLEDGE_PATH = "series/knowledge-ledger.yaml";
const CANON_PATH = "series/canon.yaml";
const THREADS_PATH = "series/story-threads.yaml";

function normalized(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function textChange(changes: readonly TransactionFileChange[], path: string): string | null | undefined {
  const change = changes.find((item) => normalized(item.path) === path);
  if (!change) return undefined;
  return typeof change.content === "string" ? change.content : null;
}

function overlay(root: string, changes: readonly TransactionFileChange[], path: string): string | null {
  const changed = textChange(changes, path);
  if (changed !== undefined) return changed;
  return readText(join(root, path));
}

function parseRequired<T>(root: string, changes: readonly TransactionFileChange[], path: string, schema: object): T {
  const content = overlay(root, changes, path);
  if (content === null) throw new Error(`Missing required canonical story state: ${path}.`);
  return parseYaml<T>(content, schema as never, path);
}

function parseOptional<T>(root: string, changes: readonly TransactionFileChange[], path: string, schema: object, fallback: T): T {
  const content = overlay(root, changes, path);
  return content === null ? fallback : parseYaml<T>(content, schema as never, path);
}

function resolveBookId(root: string, changes: readonly TransactionFileChange[]): string | null {
  for (const change of changes) {
    const match = normalized(change.path).match(/^books\/(book-[0-9]{2})\//);
    if (match?.[1]) return match[1];
  }
  const projectText = overlay(root, changes, "PROJECT.yaml");
  if (projectText === null) return null;
  const project = parseYaml<Record<string, unknown>>(projectText, undefined, "PROJECT.yaml");
  return typeof project["active_book"] === "string" && /^book-[0-9]{2}$/.test(project["active_book"])
    ? project["active_book"]
    : null;
}

function contractPattern(bookId: string): RegExp {
  const escaped = bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^books/${escaped}/contracts/chapters/CH-[0-9]{3}\\.yaml$`);
}

function contractPaths(root: string, changes: readonly TransactionFileChange[], bookId: string): string[] {
  const pattern = contractPattern(bookId);
  const stored = listFilesRecursive(join(root, "books", bookId, "contracts", "chapters"), (path) => /\.yaml$/i.test(path))
    .map((path) => normalizedRelative(root, path))
    .filter((path) => pattern.test(path));
  const changed = changes.map((item) => normalized(item.path)).filter((path) => pattern.test(path));
  return [...new Set([...stored, ...changed])].sort();
}

function hasCanonicalStoryState(root: string, changes: readonly TransactionFileChange[], bookId: string): boolean {
  return [ENTITY_PATH, STATE_PATH, KNOWLEDGE_PATH].some((path) => overlay(root, changes, path) !== null)
    || contractPaths(root, changes, bookId).length > 0;
}

function touchesStorySemantics(changes: readonly TransactionFileChange[], bookId: string): boolean {
  const watched = new Set([
    ENTITY_PATH,
    STATE_PATH,
    KNOWLEDGE_PATH,
    CANON_PATH,
    THREADS_PATH,
    `books/${bookId}/plot-grid.yaml`,
    `books/${bookId}/research-ledger.yaml`,
  ]);
  const pattern = contractPattern(bookId);
  return changes.some((change) => watched.has(normalized(change.path)) || pattern.test(normalized(change.path)));
}

export function validateCanonicalStoryTransaction(root: string, changes: readonly TransactionFileChange[]): void {
  const bookId = resolveBookId(root, changes);
  if (!bookId || !touchesStorySemantics(changes, bookId) || !hasCanonicalStoryState(root, changes, bookId)) return;

  const entities = parseOptional<EntityRegistry>(root, changes, ENTITY_PATH, EntityRegistrySchema, {
    schema_version: "1.0.0",
    entities: [],
  });
  const state = parseOptional<StateLedger>(root, changes, STATE_PATH, StateLedgerSchema, {
    schema_version: "1.0.0",
    records: [],
  });
  const knowledge = parseOptional<KnowledgeLedger>(root, changes, KNOWLEDGE_PATH, KnowledgeLedgerSchema, {
    schema_version: "1.0.0",
    records: [],
  });
  const canon = parseRequired<CanonState>(root, changes, CANON_PATH, CanonSchema);
  const threads = parseRequired<StoryThreadsState>(root, changes, THREADS_PATH, StoryThreadsSchema);
  const research = parseRequired<ResearchLedger>(root, changes, `books/${bookId}/research-ledger.yaml`, ResearchLedgerSchema);
  const plot = parseRequired<PlotGridPhase4>(root, changes, `books/${bookId}/plot-grid.yaml`, PlotGridPhase4Schema);
  const contracts = contractPaths(root, changes, bookId).map((path): { path: string; contract: ChapterContract } => ({
    path,
    contract: parseRequired<ChapterContract>(root, changes, path, ChapterContractSchema),
  }));

  assertCanonicalStoryIntegrity({ entities, state, knowledge, canon, threads, research, plot, contracts });
}

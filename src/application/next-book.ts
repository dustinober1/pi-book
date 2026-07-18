import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CanonSchema, SeriesArcSchema, StoryThreadsSchema, isProfileId, type CanonFact, type CanonState, type ProfileId, type SeriesArcState, type StoryThread, type StoryThreadsState } from "../domain/schemas.js";
import type { InheritedContext } from "../domain/v1-2-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { bookTemplateFiles } from "../project/templates.js";
import { readBook, readProject } from "../project/store.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { readReaderExperiment, readReaderIndex } from "./readers/store.js";

export type NextBookRelationship = "direct-continuation" | "adjacent-story" | "prequel" | "later-installment" | "other";

export interface NextBookInheritanceProposal {
  bookId: string;
  previousBook: string;
  previousTitle: string;
  profile: ProfileId;
  targetWords: number;
  canon: CanonFact[];
  openThreads: StoryThread[];
  readerFindings: string[];
  seriesRole: string;
}

export interface NextBookDecision {
  title: string;
  role: string;
  relationship: NextBookRelationship;
  profile: ProfileId;
  targetWords: number;
  protagonist: string;
  continuingThreadIds: string[];
  deferredThreadIds: string[];
  inheritedCanonIds: string[];
  immutableFacts: string[];
  optionalContext: string[];
  excludedContext: string[];
  force?: boolean;
}

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function readState<T>(root: string, path: string, schema: object): { value: T; text: string } {
  const text = readText(join(root, path));
  if (!text) throw new Error(`${path} is required.`);
  return { value: parseYaml<T>(text, schema as never, path), text };
}

function nextBookId(root: string): { bookId: string; number: number } {
  const rootPath = join(root, "books");
  const numbers = existsSync(rootPath)
    ? readdirSync(rootPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^book-\d{2}$/.test(entry.name)).map((entry) => Number.parseInt(entry.name.slice(5), 10))
    : [];
  const number = numbers.reduce((maximum, value) => Math.max(maximum, value), 0) + 1;
  if (number > 99) throw new Error("Novel Forge supports up to 99 books in one workspace.");
  return { bookId: `book-${String(number).padStart(2, "0")}`, number };
}

function readerFindings(root: string, bookId: string): string[] {
  const index = readReaderIndex(root, bookId);
  return index.experiments.flatMap((entry) => {
    const experiment = readReaderExperiment(root, bookId, entry.id);
    return [
      ...experiment.limitations.map((value) => `${experiment.id} limitation: ${value}`),
      ...experiment.supported_claims.map((value) => `${experiment.id} supported claim: ${value}`),
    ];
  });
}

export function buildNextBookInheritanceProposal(root: string): NextBookInheritanceProposal {
  const project = readProject(root);
  const book = readBook(root);
  if (!book.canon_locked && !["locked", "packaged"].includes(book.status)) throw new Error("Lock or package the current book before creating the next book.");
  const { bookId } = nextBookId(root);
  const canon = readState<CanonState>(root, "series/canon.yaml", CanonSchema).value;
  const threads = readState<StoryThreadsState>(root, "series/story-threads.yaml", StoryThreadsSchema).value;
  const arc = readState<SeriesArcState>(root, "series/series-arc.yaml", SeriesArcSchema).value;
  const current = arc.books.find((item) => item.id === book.book_id);
  return {
    bookId,
    previousBook: book.book_id,
    previousTitle: book.title,
    profile: project.default_profile,
    targetWords: book.target_words,
    canon: canon.facts.filter((fact) => fact.status === "locked"),
    openThreads: threads.threads.filter((thread) => ["planned", "open", "advanced"].includes(thread.status)),
    readerFindings: readerFindings(root, book.book_id),
    seriesRole: current?.role ?? "continue the established series promise",
  };
}

function unique(values: string[], label: string): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (new Set(cleaned).size !== cleaned.length) throw new Error(`${label} contains duplicate values.`);
  return cleaned;
}

export function createNextBookFromDecision(root: string, input: NextBookDecision) {
  const proposal = buildNextBookInheritanceProposal(root);
  const project = structuredClone(readProject(root));
  const previousBook = readBook(root);
  if (!input.title.trim()) throw new Error("The next book requires a title or working title.");
  if (!input.role.trim()) throw new Error("The next book requires a role in the series.");
  if (!input.protagonist.trim()) throw new Error("The next book requires a protagonist or primary viewpoint.");
  if (!isProfileId(input.profile)) throw new Error(`Unknown novel profile: ${String(input.profile)}`);
  if (!Number.isInteger(input.targetWords) || input.targetWords < 1000) throw new Error("Target words must be an integer of at least 1000.");

  const canonState = readState<CanonState>(root, "series/canon.yaml", CanonSchema);
  const threadState = readState<StoryThreadsState>(root, "series/story-threads.yaml", StoryThreadsSchema);
  const arcState = readState<SeriesArcState>(root, "series/series-arc.yaml", SeriesArcSchema);
  const inheritedCanonIds = unique(input.inheritedCanonIds, "Inherited canon IDs");
  const continuingThreadIds = unique(input.continuingThreadIds, "Continuing thread IDs");
  const deferredThreadIds = unique(input.deferredThreadIds, "Deferred thread IDs");
  const canonIds = new Set(canonState.value.facts.filter((fact) => fact.status === "locked").map((fact) => fact.id));
  const availableThreadIds = new Set(threadState.value.threads.filter((thread) => ["planned", "open", "advanced"].includes(thread.status)).map((thread) => thread.id));
  for (const id of inheritedCanonIds) if (!canonIds.has(id)) throw new Error(`Inherited canon ID is not locked and available: ${id}`);
  for (const id of [...continuingThreadIds, ...deferredThreadIds]) if (!availableThreadIds.has(id)) throw new Error(`Inherited thread ID is not open and available: ${id}`);
  const overlap = continuingThreadIds.filter((id) => deferredThreadIds.includes(id));
  if (overlap.length) throw new Error(`Threads cannot be both continuing and deferred: ${overlap.join(", ")}`);

  const { bookId, number } = nextBookId(root);
  if (bookId !== proposal.bookId) throw new Error("Next-book proposal is stale; reload before creating the book.");
  const templates = bookTemplateFiles(bookId, number, input.profile, input.targetWords);
  const book = parseYaml<any>(templates[`books/${bookId}/BOOK.yaml`]!, undefined, "BOOK.yaml");
  book.title = input.title.trim();
  templates[`books/${bookId}/BOOK.yaml`] = stringifyYaml(book);

  const inherited: InheritedContext = {
    schema_version: "1.0.0",
    from_book: previousBook.book_id,
    relationship: input.relationship,
    series_role: input.role.trim(),
    protagonist: input.protagonist.trim(),
    inherited_canon_ids: inheritedCanonIds,
    continuing_thread_ids: continuingThreadIds,
    deferred_thread_ids: deferredThreadIds,
    optional_context: unique(input.optionalContext, "Optional context"),
    excluded_context: unique(input.excludedContext, "Excluded context"),
    immutable_facts: unique(input.immutableFacts, "Immutable facts"),
    decisions_required: [],
    source_hashes: {
      canon: hash(canonState.text),
      story_threads: hash(threadState.text),
      series_arc: hash(arcState.text),
      previous_book: hash(readText(join(root, `books/${previousBook.book_id}/BOOK.yaml`)) ?? ""),
    },
  };
  const selectedCanon = canonState.value.facts.filter((fact) => inheritedCanonIds.includes(fact.id));
  const selectedThreads = threadState.value.threads.filter((thread) => continuingThreadIds.includes(thread.id) || deferredThreadIds.includes(thread.id));
  const report = [
    "# Next-Book Inheritance Report",
    "",
    `- New book: ${bookId} — ${input.title.trim()}`,
    `- Previous book: ${previousBook.book_id} — ${previousBook.title}`,
    `- Relationship: ${input.relationship}`,
    `- Series role: ${input.role.trim()}`,
    `- Protagonist or primary viewpoint: ${input.protagonist.trim()}`,
    `- Profile: ${input.profile}`,
    `- Target words: ${input.targetWords}`,
    "",
    "## Accepted inherited canon",
    "",
    ...(selectedCanon.length ? selectedCanon.map((fact) => `- ${fact.id}: ${fact.fact}`) : ["- None selected."]),
    "",
    "## Continuing threads",
    "",
    ...(selectedThreads.filter((thread) => continuingThreadIds.includes(thread.id)).map((thread) => `- ${thread.id}: ${thread.setup}`) || []),
    ...(continuingThreadIds.length ? [] : ["- None selected."]),
    "",
    "## Deferred threads",
    "",
    ...(selectedThreads.filter((thread) => deferredThreadIds.includes(thread.id)).map((thread) => `- ${thread.id}: ${thread.setup}`) || []),
    ...(deferredThreadIds.length ? [] : ["- None selected."]),
    "",
    "## Immutable facts",
    "",
    ...(inherited.immutable_facts.length ? inherited.immutable_facts.map((value) => `- ${value}`) : ["- None recorded."]),
    "",
    "## Explicitly excluded context",
    "",
    ...(inherited.excluded_context.length ? inherited.excluded_context.map((value) => `- ${value}`) : ["- None recorded."]),
    "",
    "No plot solution, character outcome, reader result, or new canon fact was invented during this handoff.",
    "",
  ].join("\n");

  const arc = structuredClone(arcState.value);
  const previousArc = arc.books.find((item) => item.id === previousBook.book_id);
  if (previousArc) previousArc.status = previousBook.canon_locked ? "locked" : input.force ? "superseded-by-force" : previousArc.status;
  arc.books.push({ id: bookId, status: "active", role: input.role.trim(), closes: [], carries: continuingThreadIds });
  project.active_book = bookId;
  project.project_type = project.project_type === "standalone" ? "open-ended-series" : project.project_type;
  project.default_profile = input.profile;
  project.current_stage = "book-planning";
  project.next_gate = "book-plan-approval";
  for (const gate of ["book-plan-approval", "first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-approval", "package-approval"]) project.gates[gate] = "open";

  const changes = [
    { path: "PROJECT.yaml", content: stringifyYaml(project) },
    { path: "series/series-arc.yaml", content: stringifyYaml(arc) },
    ...Object.entries(templates).map(([path, content]) => ({ path, content })),
    { path: `books/${bookId}/inherited-context.yaml`, content: stringifyYaml(inherited) },
    { path: `books/${bookId}/inheritance-report.md`, content: report },
    { path: `books/${bookId}/manuscript/chapters/.gitkeep`, content: "" },
  ];
  const event = applyGuidedProjectEvent(root, changes, `Novel Forge: create ${bookId} from inherited context`, { lastAction: `Created ${bookId} with approved inherited context` });
  return { bookId, changed: event.changed, inherited };
}

import { existsSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
  CanonSchema,
  ChapterQueueSchema,
  StoryThreadsSchema,
  type CanonState,
  type ChapterQueueState,
  type StoryThreadsState,
} from "../../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../../domain/v1-3-architecture-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../../domain/v1-3-research-schemas.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../../domain/v1-3-schemas.js";
import { listChapterFiles, listFilesRecursive, readText } from "../../infrastructure/files.js";
import { parseYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import { normalizeDocument } from "./normalize.js";
import { mechanicalRules } from "./rules/mechanics.js";
import { projectConsistencyRules } from "./rules/project-consistency.js";
import { repetitionRules } from "./rules/repetition.js";
import { stylePatternRules } from "./rules/style-patterns.js";
import type { ProjectLintContext, ProseLintInput } from "./types.js";

const numericCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function portable(path: string): string {
  return path.replace(/\\/g, "/");
}

function chapterNumber(path: string): number | null {
  const value = Number.parseInt(basename(path).match(/^0*(\d+)(?:[-_ .]|$)/)?.[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function orderedFiles(root: string, files: readonly string[]): Array<{ absolute: string; path: string; number: number | null }> {
  return files.map((absolute) => {
    const path = portable(relative(root, absolute));
    return { absolute, path, number: chapterNumber(path) };
  }).sort((left, right) => {
    if (left.number !== null && right.number !== null && left.number !== right.number) return left.number - right.number;
    if (left.number !== null && right.number === null) return -1;
    if (left.number === null && right.number !== null) return 1;
    return numericCollator.compare(left.path, right.path);
  });
}

function readYaml<T>(path: string, schema: Parameters<typeof parseYaml<T>>[1], fallback: T): T {
  const text = readText(path);
  return text === null ? fallback : parseYaml<T>(text, schema, portable(path));
}

function documentsFor(files: readonly { absolute: string; path: string }[]) {
  return files.map((file, index) => {
    const text = readText(file.absolute);
    if (text === null) throw new Error(`Cannot read prose-lint manuscript: ${file.path}`);
    return normalizeDocument(file.path, text, index + 1);
  });
}

function contextFor(root: string, bookId: string, chapterFiles: readonly { path: string; number: number | null }[]): ProjectLintContext {
  const bookRoot = join(root, "books", bookId);
  const canon = readYaml<CanonState>(join(root, "series", "canon.yaml"), CanonSchema, { schema_version: "1.0.0", facts: [], relationships: [] });
  const threads = readYaml<StoryThreadsState>(join(root, "series", "story-threads.yaml"), StoryThreadsSchema, { schema_version: "1.0.0", threads: [] });
  const sources = readYaml<SourceRegisterV13>(join(root, "research", "source-register.yaml"), SourceRegisterV13Schema, { schema_version: "1.0.0", sources: [] });
  const queue = readYaml<ChapterQueueState>(join(bookRoot, "chapter-queue.yaml"), ChapterQueueSchema, { schema_version: "1.0.0", active_window: "", packets: [] });
  const plot = readYaml<PlotGridPhase4>(join(bookRoot, "plot-grid.yaml"), PlotGridPhase4Schema, { schema_version: "1.0.0", acts: [], chapters: [] });
  const canonNames = [...new Set([
    ...canon.facts.map((fact) => fact.subject.trim()),
    ...canon.relationships.flatMap((relationship) => relationship.characters.map((name) => name.trim())),
  ].filter(Boolean))];

  return {
    projectRoot: root,
    bookId,
    chapterFiles,
    canonEntries: canon.facts.map((fact) => ({ id: fact.id, subject: fact.subject, fact: fact.fact, locked: fact.status === "locked" })),
    canonNames,
    canonIds: [...canon.facts.map((fact) => fact.id), ...canon.relationships.map((relationship) => relationship.id)],
    threadIds: threads.threads.map((thread) => thread.id),
    sourceIds: sources.sources.map((source) => source.id),
    packetReferences: queue.packets.flatMap((packet) => [
      ...packet.continuity_refs.map((id) => ({ chapter: packet.chapter, kind: "canon" as const, id })),
      ...packet.story_thread_refs.map((id) => ({ chapter: packet.chapter, kind: "thread" as const, id })),
      ...packet.required_research.map((id) => ({ chapter: packet.chapter, kind: "source" as const, id })),
    ]),
    plotThreadReferences: plot.chapters.flatMap((chapter) => [...chapter.setup_ids, ...chapter.payoff_ids].map((id) => ({ chapter: chapter.chapter, id }))),
  };
}

function defaultRules() {
  return [
    ...mechanicalRules,
    ...projectConsistencyRules,
    ...repetitionRules,
    ...stylePatternRules,
  ];
}

export function loadProseLintInput(target: string, _options: { scope?: string } = {}): ProseLintInput {
  const resolved = resolve(target);
  try {
    if (!statSync(resolved).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error(`Cannot read prose-lint target: ${target}`);
  }

  if (existsSync(join(resolved, "PROJECT.yaml"))) {
    const project = readProject(resolved);
    const book = readBook(resolved, project.active_book);
    const chapterRoot = join(resolved, "books", book.book_id, "manuscript", "chapters");
    const files = orderedFiles(chapterRoot, listChapterFiles(join(resolved, "books", book.book_id)));
    if (files.length === 0) throw new Error(`No Markdown files found for active book ${book.book_id}.`);
    const guardrailText = readText(join(resolved, "series", "voice-guardrails.yaml"));
    const baselineMetrics = guardrailText === null
      ? {}
      : Object.fromEntries(Object.entries(parseYaml<VoiceGuardrails>(guardrailText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml").baseline.metrics)
        .filter(([, value]) => Number.isFinite(value)));
    const chapterFiles = files.map(({ path, number }) => ({ path, number }));
    return {
      documents: documentsFor(files),
      baselineMetrics,
      projectContext: contextFor(resolved, book.book_id, chapterFiles),
      rules: defaultRules(),
    };
  }

  let markdownFiles: string[];
  try {
    markdownFiles = listFilesRecursive(resolved, (path) => /\.md$/i.test(path));
  } catch {
    throw new Error(`Cannot read prose-lint target: ${target}`);
  }
  const files = orderedFiles(resolved, markdownFiles);
  if (files.length === 0) throw new Error(`No Markdown files found in prose-lint target: ${target}`);
  return { documents: documentsFor(files), rules: defaultRules() };
}
